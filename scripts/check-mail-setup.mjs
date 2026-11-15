// ============================================================
// MAIL SETUP CHECK — read-only preverjanje pripravljenosti pošiljanja.
//
// Točka 1 docs/PLAN.md: preden postavimo ✅ morajo biti izpolnjeni
// RESEND_API_KEY + RESEND_FROM_EMAIL + pravilni DNS zapisi. Skript ne
// pošilja pošte, ne spreminja DNS in nikoli ne izpiše vrednosti ključa.
//
//   node scripts/check-mail-setup.mjs
//   node scripts/check-mail-setup.mjs --domain=rcbeautysalon.org
//   node scripts/check-mail-setup.mjs --json
//
// Izhodne kode: 0 = pripravljeno, 1 = ni pripravljeno, 2 = napaka.
// ============================================================

import { execFileSync } from "node:child_process"
import dns from "node:dns/promises"
import { pathToFileURL } from "node:url"

const PLACEHOLDER_PREFIX = "re_placeholder"

/** Ali je API ključ uporaben (ne prazen, ne placeholder). Ne vrača vrednosti. */
export function isUsableApiKey(key) {
  const k = String(key ?? "").trim()
  return k.length > 0 && !k.startsWith(PLACEHOLDER_PREFIX)
}

/** Izvleče domeno iz e-poštnega naslova; ob neveljavnem naslovu null. */
export function parseSenderDomain(from) {
  const value = String(from ?? "").trim()
  const match = /^[^@\s]+@([^@\s]+)$/.exec(value)
  if (!match) return null
  const host = match[1].toLowerCase().replace(/\.$/, "")
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null
}

/**
 * Registrable domena (zadnji dve labeli). Zadostuje za naše domene;
 * za dvonivojske TLD (co.uk ...) uporabi --domain.
 */
export function registrableDomain(host) {
  const parts = String(host ?? "").toLowerCase().split(".").filter(Boolean)
  return parts.length >= 2 ? parts.slice(-2).join(".") : (parts[0] || "")
}

/** Razvrsti TXT zapise po vsebini. */
export function classifyTxt(records) {
  const rows = (records || []).map((r) => String(r).trim()).filter(Boolean)
  return {
    spf: rows.filter((r) => /^v=spf1\b/i.test(r)),
    dmarc: rows.filter((r) => /^v=DMARC1\b/i.test(r)),
    // DKIM ima dolg base64 `p=` ključ. Kratki `p=none|quarantine|reject`
    // pripadajo DMARC in jih ne smemo šteti za DKIM.
    dkim: rows.filter(
      (r) =>
        !/^v=(spf1|DMARC1)\b/i.test(r) &&
        (/\bp=\s*[A-Za-z0-9+/=]{20,}/i.test(r) || /^v=DKIM1\b/i.test(r))
    ),
  }
}

/**
 * Parser za `nslookup -type=TXT` (Windows in Unix). Vsak zapis se začne
 * z vrstico `... text =`; več narekovajenih kosov istega zapisa združimo.
 * Node `dns.resolveTxt` v nekaterih okoljih (WARP proxy) ne deluje,
 * zato uporabimo to kot rezervni kanal.
 */
export function parseNslookupTxt(output) {
  const records = []
  let current = null
  const quoted = (line) =>
    (String(line).match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1))

  for (const line of String(output ?? "").split(/\r?\n/)) {
    if (/\btext\s*=/i.test(line)) {
      if (current) records.push(current.join(""))
      current = quoted(line)
    } else if (current) {
      current.push(...quoted(line))
    }
  }
  if (current) records.push(current.join(""))
  return records.map((r) => r.trim()).filter(Boolean)
}

/** Prebere MX iz `nslookup -type=MX` izhoda. */
export function parseNslookupMx(output) {
  const found = []
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const m = /mail exchanger\s*=\s*([^\s,]+)/i.exec(line)
    if (m) found.push(m[1].replace(/\.$/, "").toLowerCase())
  }
  return found
}

/** TXT z Node DNS in rezervnim nslookup kanalom. */
export async function resolveTxtRecords(name) {
  try {
    const rows = await dns.resolveTxt(name)
    return rows.map((parts) => parts.join("")).filter(Boolean)
  } catch {
    try {
      const out = execFileSync("nslookup", ["-type=TXT", name], {
        encoding: "utf8",
        timeout: 15000,
        stdio: ["ignore", "pipe", "pipe"],
      })
      return parseNslookupTxt(out)
    } catch {
      return []
    }
  }
}

/** MX z Node DNS in rezervnim nslookup kanalom. */
export async function resolveMxRecords(name) {
  try {
    const rows = await dns.resolveMx(name)
    return rows.map((r) => String(r.exchange).replace(/\.$/, "").toLowerCase())
  } catch {
    try {
      const out = execFileSync("nslookup", ["-type=MX", name], {
        encoding: "utf8",
        timeout: 15000,
        stdio: ["ignore", "pipe", "pipe"],
      })
      return parseNslookupMx(out)
    } catch {
      return []
    }
  }
}

/**
 * Čista evaluacija (brez mreže) — vse odločitve so tu, zato jih lahko
 * testiramo. `dns` vsebuje { rootTxt, sendTxt, dkimTxt, dmarcTxt, sendMx }.
 */
export function evaluateMailSetup({ keyPresent, fromDomain, dns: d }) {
  const checks = []
  const add = (name, ok, detail) => {
    checks.push({ name, ok, detail })
    return ok
  }

  add("RESEND_API_KEY", keyPresent === true, keyPresent ? "nastavljen (vrednost ni izpisana)" : "manjka ali je placeholder")
  add("RESEND_FROM_EMAIL", Boolean(fromDomain), fromDomain ? `domena pošiljatelja: ${fromDomain}` : "manjka ali je neveljaven")

  const root = classifyTxt(d.rootTxt || [])
  const send = classifyTxt(d.sendTxt || [])
  const dkim = classifyTxt(d.dkimTxt || []).dkim
  const dmarc = classifyTxt(d.dmarcTxt || []).dmarc
  const spf = [...root.spf, ...send.spf]

  add(
    "SPF",
    spf.length > 0,
    spf.length === 0
      ? "ni v=spf1 zapisa ne na korenu ne na send.<domena>"
      : `najden ${spf.length} (koren: ${root.spf.length}, send: ${send.spf.length})`
  )
  add("DKIM", dkim.length > 0, dkim.length === 0 ? "ni zapisa na resend._domainkey.<domena>" : `najden ${dkim.length}`)
  add(
    "DMARC",
    dmarc.length === 1,
    dmarc.length === 0
      ? "ni v=DMARC1 zapisa na _dmarc.<domena>"
      : dmarc.length > 1
        ? `nasprotujoči si zapisi: ${dmarc.length} (obdrži natanko enega)`
        : "natanko en zapis"
  )

  const warnings = []
  if (spf.length > 1) warnings.push("Več kot en SPF zapis je neveljaven (RFC 7208) — obdrži enega.")
  if ((d.sendMx || []).length === 0) warnings.push("Ni MX za return-path na send.<domena> (priporočljivo za Resend).")

  const failures = checks.filter((c) => !c.ok).map((c) => c.name)
  return { ok: failures.length === 0, checks, failures, warnings }
}

function argValue(argv, flag, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${flag}=`))
  return hit ? hit.slice(flag.length + 3) : fallback
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const domainOverride = argValue(argv, "domain", "")
  const selector = argValue(argv, "selector", "resend")
  const jsonOut = argv.includes("--json")

  const keyPresent = isUsableApiKey(env.RESEND_API_KEY)
  const fromDomain = parseSenderDomain(env.RESEND_FROM_EMAIL)
  let base = domainOverride || (fromDomain ? registrableDomain(fromDomain) : "")

  if (!base) {
    const admin = String(env.PLATFORM_ADMIN_EMAILS || "").split(",")[0]
    const adminDomain = parseSenderDomain(admin)
    base = adminDomain ? registrableDomain(adminDomain) : ""
  }
  if (!base) throw new Error("Ne morem ugotoviti domene — dodaj --domain=example.org")

  const names = {
    rootTxt: base,
    sendTxt: `send.${base}`,
    dkimTxt: `${selector}._domainkey.${base}`,
    dmarcTxt: `_dmarc.${base}`,
  }

  const dnsResult = {
    rootTxt: await resolveTxtRecords(names.rootTxt),
    sendTxt: await resolveTxtRecords(names.sendTxt),
    dkimTxt: await resolveTxtRecords(names.dkimTxt),
    dmarcTxt: await resolveTxtRecords(names.dmarcTxt),
    sendMx: await resolveMxRecords(names.sendTxt),
  }

  const result = evaluateMailSetup({ keyPresent, fromDomain, dns: dnsResult })

  if (jsonOut) {
    console.log(JSON.stringify({ domain: base, names, ...result }, null, 2))
  } else {
    console.log(`[mail-check] domena: ${base}`)
    console.log(`[mail-check] DKIM selektor: ${selector}._domainkey.${base}`)
    console.log("")
    for (const c of result.checks) {
      console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name.padEnd(18)} ${c.detail}`)
    }
    for (const w of result.warnings) console.log(`WARN ${w}`)
    console.log("")
    console.log(
      result.ok
        ? "[mail-check] PRIPRAVLJENO — poštna domena izpolnjuje pogoje točke 1."
        : `[mail-check] NI PRIPRAVLJENO: ${result.failures.join(", ")}. Glej docs/MAIL-SETUP.md.`
    )
  }
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`[mail-check] Napaka: ${err.message}`)
      process.exit(2)
    })
}
