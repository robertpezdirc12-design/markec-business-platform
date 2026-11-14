// Emit the definitive 42-migration inventory + full SHA-256 manifest to a file.
// usage: node manifest.mjs <outfile>
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const archive = path.join(root, "prisma", "migrations-archived-legacy")
const head = new Set(
  execSync(`git ls-tree --name-only HEAD prisma/migrations/`,{encoding:"utf8",cwd:root})
    .split("\n").map(l=>l.trim()).filter(l=>l.startsWith("prisma/migrations/")).map(l=>path.basename(l))
)
const dirs = fs.readdirSync(archive,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort()
const lines = ["# Definitive MARKEC migration inventory (42)", "# source: prisma/migrations-archived-legacy/", "# tracked = present in git HEAD prisma/migrations/", ""]
let headCount=0, f5Count=0
for (const name of dirs) {
  const f = path.join(archive,name,"migration.sql")
  const sha = createHash("sha256").update(fs.readFileSync(f)).digest("hex")
  const kind = head.has(name) ? "HEAD" : "F5x"
  if (kind==="HEAD") headCount++; else f5Count++
  lines.push(`${kind}\t${name}\t${sha}`)
}
lines.push("")
lines.push(`TOTALS\t${dirs.length}\tHEAD=${headCount}\tF5x=${f5Count}`)
const out = lines.join("\n")+"\n"
if (process.argv[2]) fs.writeFileSync(path.resolve(root, process.argv[2]), out)
console.log(out)
console.log("TOTAL_MIGRATIONS=" + dirs.length + " HEAD=" + headCount + " F5x=" + f5Count)