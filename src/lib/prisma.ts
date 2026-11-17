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
// AsyncLocalStorage hrani instanco za trajanje zahteve; Proxy
// posreduje vse klice (vključno z $transaction) pravilnemu clientu.
// Nobena obstoječa klicna točka se ne spremeni.
//
// POMBEMBNO (Turbopack): NE uvažamo `node:async_hooks` statično —
// Turbopack bi modul potegnil v client chunk (prek "use server"
// action uvozov) in build bi padel z "does not support external
// modules (request: node:async_hooks)". Next.js in OpenNext že
// izpostavita `globalThis.AsyncLocalStorage` (glej
// next/dist/server/node-environment-baseline.js in OpenNext banner),
// zato uporabimo global. V čistem Node/test okolju brez globala
// pademo nazaj na en client (tam ni Workers omejitve med zahtevami).
// ============================================================

type ScopedStorage<T> = {
  getStore(): T | undefined
  enterWith(value: T): void
}

type ALSConstructor = new <T>() => ScopedStorage<T>

type WithALS = typeof globalThis & {
  AsyncLocalStorage?: ALSConstructor
}

let requestStorage: ScopedStorage<PrismaClient> | undefined
let nodeFallbackClient: PrismaClient | undefined

function getStorage(): ScopedStorage<PrismaClient> | undefined {
  if (requestStorage) return requestStorage
  const ALS = (globalThis as WithALS).AsyncLocalStorage
  if (typeof ALS !== "function") return undefined
  requestStorage = new ALS<PrismaClient>()
  return requestStorage
}

// Prepreči globalno predpomnjenje fetch povezav med zahtevami.
neonConfig.fetchConnectionCache = false

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
  const storage = getStorage()
  if (storage) {
    const existing = storage.getStore()
    if (existing) return existing

    const created = createPrismaClient()
    storage.enterWith(created)
    return created
  }

  // Node/test brez globalnega AsyncLocalStorage: en client, saj tu ne velja
  // Workers pravilo o I/O med različnimi zahtevami.
  if (!nodeFallbackClient) nodeFallbackClient = createPrismaClient()
  return nodeFallbackClient
}

/**
 * Prisma client, varen za Cloudflare Workers.
 *
 * Proxy leno ustvari client ob prvem dostopu znotraj zahteve in ga
 * zadrži v AsyncLocalStorage za celotno življenje te zahteve.
 * Vsaka nova zahteva dobi svež client → ni več cross-request I/O.
 *
 * Vse metode so vezane na client, da `this` ostane pravilen.
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
  const storage = getStorage()
  const client = storage?.getStore() ?? nodeFallbackClient
  if (client) {
    await client.$disconnect().catch(() => undefined)
  }
}
