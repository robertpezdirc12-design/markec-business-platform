// ============================================================
// CLOUDFLARE WORKER ENTRY POINT — OpenNext handler + cron trigger
//
// `wrangler.jsonc` points `main` here (not straight to
// `.open-next/worker.js`) so the Worker can expose a `scheduled`
// handler. Everything request-related is still OpenNext's handler —
// this file adds only the timer.
//
// The only system timer in the product is `/api/cron/tick`
// (reminders, stale PENDING expiry, no-show marking, marketing,
// daily digest, rate-limit purge, billing grace).
//
// IMPORTANT (2026-11-17): the schedule is owned by VERCEL CRON
// (`vercel.json`, daily 03:00 UTC) because Vercel is the primary
// deployer — Cloudflare is the secondary one. `wrangler.jsonc` has
// NO "triggers" block on purpose: two schedulers at the same minute
// would run the reminder/marketing jobs twice and could send
// duplicate e-mail. The `scheduled` handler below is therefore
// INERT until a triggers block is added back.
//
// The handler calls the route through the WORKER_SELF_REFERENCE
// service binding (declared in wrangler.jsonc) with the same
// `Authorization: Bearer $CRON_SECRET` the route already requires —
// no separate code path, so the cron hits exactly the code path
// that is tested.
//
// NOTE: `.open-next/worker.js` only exists after a build. That is
// why this file is plain JavaScript and not imported from any
// TypeScript file — `tsc --noEmit` runs before the build in CI.
// ============================================================

import openNextWorker from "./.open-next/worker.js"

// ============================================================
// REQUEST-SCOPED PRISMA (Cloudflare Workers)
//
// workerd's AsyncLocalStorage implements `run()` and `getStore()` but NOT
// `enterWith()`. So the per-request Prisma client cannot be created lazily
// via enterWith inside src/lib/prisma.ts — it throws:
//   "asyncLocalStorage.enterWith() is not implemented"
//
// Instead we establish the request scope HERE at the Worker boundary:
// every fetch gets a fresh mutable holder, and openNextWorker.fetch runs
// inside als.run(holder, ...). Prisma reads the same instance from
// globalThis and lazily creates the client into the holder on first use.
//
// This is what fixes "Cannot perform I/O on behalf of a different request":
// each request owns its Neon WebSocket pool, never shared across requests.
// ============================================================
const PRISMA_ALS_KEY = Symbol.for("markec.prisma.als")

function getRequestStorage() {
  const ALS = globalThis.AsyncLocalStorage
  if (typeof ALS !== "function") return null
  let als = globalThis[PRISMA_ALS_KEY]
  if (!als) {
    als = new ALS()
    globalThis[PRISMA_ALS_KEY] = als
  }
  // workerd implements run()/getStore() but not enterWith(); run() is enough.
  return typeof als.run === "function" ? als : null
}

async function handleFetch(request, env, ctx) {
  const als = getRequestStorage()
  if (!als) {
    // Runtime without ALS (e.g. local Node): fall back to the shared client.
    return openNextWorker.fetch(request, env, ctx)
  }
  return als.run({ client: undefined }, () =>
    openNextWorker.fetch(request, env, ctx)
  )
}

// Durable Object classes are resolved by wrangler through the
// entry point's exports — keep re-exporting them.
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js"

const DEFAULT_APP_URL =
  "https://markec-business-platform.robert-pezdirc12.workers.dev"

/** Calls the app's cron route through the self service binding. */
async function runCronTick(cron, env) {
  const secret = env.CRON_SECRET

  // Fail loud but harmless: without the secret the route answers 401,
  // so there is nothing to gain from calling it.
  if (!secret) {
    console.log("[cron] CRON_SECRET is not set — skipping tick")
    return
  }

  const base = env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
  const url = new URL("/api/cron/tick", base)
  const startedAt = Date.now()

  const response = await env.WORKER_SELF_REFERENCE.fetch(
    new Request(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
    })
  )

  const body = await response.text().catch(() => "")
  const elapsed = Date.now() - startedAt
  console.log(
    `[cron] ${cron} ${url.pathname} -> ${response.status} in ${elapsed}ms: ${body.slice(0, 1000)}`
  )

  // A non-2xx marks the cron invocation as failed in Cloudflare
  // analytics instead of looking healthy while jobs silently stop.
  if (!response.ok) {
    throw new Error(`cron tick responded ${response.status}`)
  }
}

export default {
  fetch: handleFetch,

  // Inerten, dokler wrangler.jsonc nima "triggers" (timer ima Vercel).
  async scheduled(controller, env) {
    await runCronTick(controller.cron, env)
  },
}
