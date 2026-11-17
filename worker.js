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

// ============================================================
// ES module interop polyfill for Cloudflare Workers
// React 19's `__name()` check fails on workerd because
// `Object.prototype.__name` doesn't exist in edge environments.
// Polyfill it globally before any application imports begin.
// ============================================================
Object.prototype.__name = function (name) {
  if (typeof this.name !== "undefined" && typeof Object.getOwnPropertyDescriptor(this, "name") !== "undefined") {
    Object.defineProperty(this, "name", {
      value: name,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return this
}

import openNextWorker, {
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

  if (response.ok) {
    const result = JSON.parse(body)
    console.log(
      "[cron] tick OK (",
      body.includes("error")
        ? body
        : `${result.jobs || "unknown"} jobs in ${elapsed}ms`,
    )
  } else {
    console.error("[cron] tick FAIL status=", response.status, body.slice(0, 200))
  }
}

/** Scheduled cron trigger — currently INERT (Vercel cron owns scheduling). */
export async function scheduled(event, env, ctx) {
  console.log("[scheduled] No scheduled triggers — nothing to do")
  return new Response("OK", { status: 200 })
}

// BucketCachePurge se NE ovija lokalno: že uvožen na vrhu datoteke je
// OpenNextova prava funkcija. Prejšnja lokalna ovojnica je vsebovala
// `await` v ne-async funkciji in je podrla `wrangler deploy`
// ("await can only be used inside an async function").

export default {
  fetch: openNextWorker.fetch,

  /** Crons (INERT — controlled by Vercel). */
  scheduled: runCronTick,

  /** Bucket cache purge (manual / cron). */
  BucketCachePurge,

  // For Vercel CLI / preview builds:
  // `build` function is already inside `.open-next/worker.js` and
  // must NOT be shadowed here — it must be re-exported.
  build: openNextWorker.build,
}