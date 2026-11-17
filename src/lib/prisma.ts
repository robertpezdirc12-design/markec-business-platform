import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"

// ============================================================
// CLOUDFLARE WORKERS — REQUEST-SCOPED PRISMA CLIENT
//
// Živi logi (wrangler tail, 2026-11-17) so pokazali:
//   "Cannot perform I/O on behalf of a different request"
//   "Connection terminated"
//
// Vzrok: modulski singleton PrismaClient z WebSocket `PrismaNeon`
// poolom. Pool se ustvari v kontekstu prve zahteve, nato ga
// naslednje zahteve ponovno uporabijo — Workers to prepove, ker
// je I/O objekt vezan na zahtevo, ki ga je ustvarila.
//
// Popravek: vsaka zahteva dobi SVOJ PrismaClient (in svoj pool).
//
// POMBEMBNO — workerd AsyncLocalStorage:
//   workerd implementira `run()` in `getStore()`, NE pa `enterWith()`.
//   Zato ME UPOBLJAMO enterWith(). Namesto tega worker.js ob vsaki
//   zahtevi ustvari svež "holder" objekt in zavije klic v
//   `als.run(holder, () => openNextWorker.fetch(...))`. Mi samo
//   preberemo holder iz iste instanceof prek global symbola in vanj
//   leno ustvarimo client ob prvem dostopu.
//
// Turbopack: NE uvažamo `node:async_hooks` statično — potegnilo bi se
// v client chunk (prek "use server" uvozov) in build bi padel. ALS
// instanco da na globalThis worker.js.
// ============================================================

type RequestHolder = { client?: PrismaClient }

type ScopedStorage<T> = {
  getStore(): T | undefined
}

const PRISMA_ALS_KEY = Symbol.for("markec.prisma.als")

let requestStorage: ScopedStorage<RequestHolder> | undefined
let nodeFallbackClient: PrismaClient | undefined
let serverSingletonClient: PrismaClient | undefined

/**
 * Ali tečemo na Cloudflare Workers?
 *
 * Workers prepovedujejo I/O med zahtevami, zato tam VEDNO rabimo
 * client na zahtevo. Vercel/Node pa je nasproten primer: modulski
 * obseg živi med zahtevami in en sam client je priporočeni vzorec
 * (ponovna uporaba povezav namesto novega pool-a na vsako zahtevo).
 *
 * Zaznava: `RUNTIME=workers` (wrangler.jsonc vars) ali UA, ki ga
 * postavi Workers runtime. Funkcija je čista, da jo je mogoče testirati.
 */
export function isWorkersRuntime(
  runtimeFlag: string | undefined = process.env.RUNTIME,
  userAgent: string | undefined = typeof navigator !== "undefined"
    ? navigator.userAgent
    : undefined
): boolean {
  if (runtimeFlag === "workers") return true
  return userAgent === "Cloudflare-Workers"
}

const onWorkers = isWorkersRuntime()

function getStorage(): ScopedStorage<RequestHolder> | undefined {
  if (requestStorage) return requestStorage
  // worker.js ustvari ALS instanco in vsako zahtevo zavije v als.run(holder, …).
  // Mi samo BEREMO — workerd nima enterWith(), zato ga nikoli ne kličemo.
  const als = (
    globalThis as unknown as Record<symbol, ScopedStorage<RequestHolder> | undefined>
  )[PRISMA_ALS_KEY]
  if (!als || typeof als.getStore !== "function") return undefined
  requestStorage = als
  return requestStorage
}

// Workers: onemogoči predpomnjenje fetch povezav med zahtevami.
// Vercel/Node: predpomnjenje je zaželeno (manj handshake-ov).
if (onWorkers) {
  neonConfig.fetchConnectionCache = false
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL

  // Neon na Workers/edge — WebSocket adapter z lastnim poolom ZA TO zahtevo.
  if (databaseUrl && (databaseUrl.includes("neon.tech") || databaseUrl.includes("neon"))) {
    const adapter = new PrismaNeon({ connectionString: databaseUrl })
    return new PrismaClient({ adapter })
  }

  // Lokalni razvoj / Node (standardni TCP client).
  return new PrismaClient()
}

function getClient(): PrismaClient {
  // Vercel/Node: EN client za življenje procesa. Ustvarjanje clienta (in
  // WebSocket pool-a) na vsako zahtevo je bilo potrebno samo zaradi
  // Workers pravil — tu bi pomenilo nov pool na vsak obisk.
  if (!onWorkers) {
    if (!serverSingletonClient) serverSingletonClient = createPrismaClient()
    return serverSingletonClient
  }

  const storage = getStorage()
  if (storage) {
    const holder = storage.getStore()
    if (holder) {
      if (!holder.client) holder.client = createPrismaClient()
      return holder.client
    }
  }

  // Workers brez aktivnega request-holderja (npr. cron/self-fetch izven
  // fetch ovijalke): en client kot varni fallback.
  if (!nodeFallbackClient) nodeFallbackClient = createPrismaClient()
  return nodeFallbackClient
}

/**
 * Prisma client.
 *
 * Workers: proxy leno ustvari client v request-holderju (ki ga worker.js
 * postavi prek als.run) — vsaka zahteva dobi svež client, zato ni
 * cross-request I/O napak. Vse metode so vezane na client (`this`).
 *
 * Vercel/Node: en sam modulski client, ki živi med zahtevami.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client, prop, client)
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
})

/**
 * Počistimo aktivni client ob koncu zahteve, da sprostimo vire.
 * GC poskrbi za preostanek ob koncu izolata.
 */
export async function releasePrisma(): Promise<void> {
  // Vercel/Node: singletona NE prekinemo — prav zato, da naslednja zahteva
  // podeduje obstoječi pool. Prekinitev bi pomenila nov pool na vsak obisk.
  if (!onWorkers) return

  const storage = getStorage()
  const holder = storage?.getStore()
  const client = holder?.client ?? nodeFallbackClient
  if (client) {
    await client.$disconnect().catch(() => undefined)
  }
}
