// Inventory: list archived migrations, mark tracked-in-HEAD vs untracked, with SHA-256.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const archive = path.join(root, "prisma", "migrations-archived-legacy")
const head = new Set(
  execSync(`git ls-tree --name-only HEAD prisma/migrations/`, { encoding: "utf8", cwd: root })
    .split("\n").map((l) => l.trim()).filter((l) => l.startsWith("prisma/migrations/")).map((l) => path.basename(l))
    .concat(["migration_lock.toml"]).filter((n) => n !== "migration_lock.toml")
)
const dirs = fs.readdirSync(archive, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
const out = dirs.map((name) => {
  const f = path.join(archive, name, "migration.sql")
  const sha = fs.existsSync(f) ? createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16) : "(no sql)"
  const tracked = head.has(name) ? "HEAD" : "F5x"
  return `${tracked}\t${name}\t${sha}`
})
console.log(out.join("\n"))
console.log("TOTAL=" + out.length + " HEAD=" + out.filter((l) => l.startsWith("HEAD")).length + " F5x=" + out.filter((l) => l.startsWith("F5x")).length)