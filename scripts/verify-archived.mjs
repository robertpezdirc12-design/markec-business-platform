// F5.5.4.4.2z — LF-normalized comparison of archived migrations vs git HEAD blobs (accounts for autocrlf).
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const archive = path.join(root, "prisma", "migrations-archived-legacy")
const dirs = fs.readdirSync(archive, { withFileTypes: true }).filter((d) => d.isDirectory())

let headTracked = 0, lfMatch = 0, lfMiss = 0, notInHead = 0
for (const d of dirs) {
  const file = path.join(archive, d.name, "migration.sql")
  const localRaw = fs.readFileSync(file, "utf8")
  const localLf = localRaw.replace(/\r\n/g, "\n") // normalize for comparison
  let head
  try {
    head = execSync(`git show HEAD:prisma/migrations/${d.name}/migration.sql`, { encoding: "utf8", cwd: root, stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    notInHead++
    continue
  }
  headTracked++
  const headLf = head.replace(/\r\n/g, "\n")
  if (localLf === headLf) lfMatch++
  else { lfMiss++; console.log("LF_MISMATCH", d.name) }
}
console.log("ARCHIVE_DIRS=" + dirs.length + " TRACKED_IN_HEAD=" + headTracked + " LF_EQUAL_HEAD=" + lfMatch + " LF_MISS=" + lfMiss + " UNTRACKED_PRIOR=" + notInHead)