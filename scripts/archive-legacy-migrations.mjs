// Move prisma/migrations/<legacy> into prisma/migrations-archived-legacy/ (byte-preserving)
// so the ACTIVE map (prisma/migrations) keeps only migration_lock.toml + the new baseline.
// The legacy SQL files are NOT modified/appended/deleted — only relocated.
// usage: node scripts/archive-legacy-migrations.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationsDir = path.join(root, "prisma", "migrations")
const archiveDir = path.join(root, "prisma", "migrations-archived-legacy")

fs.mkdirSync(archiveDir, { recursive: true })

let moved = 0
for (const ent of fs.readdirSync(migrationsDir, { withFileTypes: true })) {
  if (ent.name === "migration_lock.toml") continue // keep in active map
  if (!ent.isDirectory()) continue
  const src = path.join(migrationsDir, ent.name)
  const dst = path.join(archiveDir, ent.name)
  if (fs.existsSync(path.join(dst, "migration.sql"))) throw new Error(`Archive already contains ${ent.name}`)
  // move the whole directory (preserves migration.sql bytes exactly)
  fs.renameSync(src, dst)
  moved++
}
console.log("MOVED_LEGACY_DIRS=" + moved)
// write the archive README
fs.writeFileSync(
  path.join(archiveDir, "ARCHIVED.md"),
  [
    "# Archived legacy migration history",
    "",
    "These 42 migrations form the ORIGINAL MARKEC migration chain (2025-10 → 2026-12).",
    "They are archived OUTSIDE the active map (prisma/migrations/) on purpose:",
    "- a fresh install must not run them (the chain was a db-push backfill and is not buildable from scratch);",
    "- Prisma's `migrate deploy` reads ONLY prisma/migrations/, which now holds the single `00000000000000_baseline`.",
    "",
    "They are preserved byte-identical (SHA-256 manifest in the git commit / _probe_prisma_migrations_before.sha256)",
    "and are NOT modified, renumbered or deleted. They serve as the historical/audit reference.",
    "",
    "Future migrations: add them to prisma/migrations/ AFTER 00000000000000_baseline.",
    "",
  ].join("\n")
)
console.log("ARCHIVE_README_WRITTEN")