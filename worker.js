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
  fetch: openNextWorker.fetch,

  // Inerten, dokler wrangler.jsonc nima "triggers" (timer ima Vercel).
  async scheduled(controller, env) {
    await runCronTick(controller.cron, env)
  },
}
