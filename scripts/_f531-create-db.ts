import { PrismaClient } from "@prisma/client"

// F5.3.1.1 — ustvari namensko testno bazo markec_f531_test (če še ne obstaja).
// VARNOSTNA ZAPORA: ustvarjamo le localhost razvojni DB (iz .env), nikoli prod.
const db = new PrismaClient()

async function main() {
  try {
    await db.$executeRawUnsafe('CREATE DATABASE "markec_f531_test"')
    console.log("CREATED markec_f531_test")
  } catch (e) {
    const m = String(e)
    if (/already exists/i.test(m)) console.log("EXISTS markec_f531_test")
    else console.log("ERR", m.slice(0, 300))
  }
  await db.$disconnect()
}
main()