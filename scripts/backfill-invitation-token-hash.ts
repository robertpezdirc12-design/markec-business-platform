// F2.2.1 — one-time backfill: convert legacy PLAINTEXT invitation tokens to
// SHA-256 hashes in place. Idempotent: rows whose `token` already looks like a
// 64-char hex SHA-256 are left untouched; short/plaintext tokens get hashed.
// Only touches OrganizationInvitation; never users/orgs/products.
import { PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"

const p = new PrismaClient()
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const looksLikeHash = (s: string) => /^[a-f0-9]{64}$/.test(s)

async function main() {
  const rows = await p.organizationInvitation.findMany({
    select: { id: true, token: true },
  })
  let converted = 0
  let skipped = 0
  for (const row of rows) {
    if (looksLikeHash(row.token)) {
      skipped++
      continue
    }
    const tokenHash = sha256(row.token)
    await p.organizationInvitation.update({
      where: { id: row.id },
      data: { token: tokenHash },
    })
    converted++
  }
  console.log(
    `Invitations: total=${rows.length} converted=${converted} already-hash/skipped=${skipped}`
  )
}
main()
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
