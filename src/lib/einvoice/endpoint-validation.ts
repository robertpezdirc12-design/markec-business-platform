// ============================================================
// ŠIFRIRANJE SSRF ZAŠČITE ZUNANJIH E-RAČUNSKIH KONČNIH TOČK (#1318)
//
// `providerEndpoint` je uporabniško nastavljiv naslov, na katerega strežnik
// pošilja zahteve. Če ga napadalec nadzira, je to vstopna točka SSRF:
//   • localhost / 127.0.0.1
//   • zasebni IP-obsegi (10/8, 172.16/12, 192.168/16)
//   • link-local (169.254/16) in cloud-metadata naslovi
//   • DNS-rebinding: veljavno ime ob shranjevanju → notranji IP ob pošiljanju
//   • preusmeritev HTTP(S) na notranje naslove (fetch po default sledi 3xx)
//
// Ta modul je PURE (ni DB, ni omrežja): `assertPublicHttpsUrl()` preveri, da
// greet URL ne kaže v notranje mreže. Pokliče se OBVENO:
//   1) ob shranjevanju kanala (`saveEinvoiceChannel`),
//   2) neposredno pred vsakim pošiljanjem (transport že sam ne sledi
//      preusmeritvam — `redirect: "manual"` pri fetch; node:https ne sledi).
// ============================================================

import { isIP } from "node:net"

/** Nedovoljeni zasebni / reservirani IPv4-obsegi (109/LinkLocal-added). */
const BLOCKED_V4 = [
  { start: "0.0.0.0", end: "0.255.255.255" }, // this-network
  { start: "10.0.0.0", end: "10.255.255.255" }, // private
  { start: "100.64.0.0", end: "100.127.255.255" }, // CGNAT
  { start: "127.0.0.0", end: "127.255.255.255" }, // loopback
  { start: "169.254.0.0", end: "169.254.255.255" }, // link-local / metadata proxy
  { start: "172.16.0.0", end: "172.31.255.255" }, // private
  { start: "192.168.0.0", end: "192.168.255.255" }, // private
  { start: "198.18.0.0", end: "198.19.255.255" }, // benchmark
  { start: "192.0.0.0", end: "192.0.0.255" }, // IETF protocol / TEST-NET
  { start: "192.0.2.0", end: "192.0.2.255" }, // TEST-NET-1
  { start: "198.51.100.0", end: "198.51.100.255" }, // TEST-NET-2
  { start: "203.0.113.0", end: "203.0.113.255" }, // TEST-NET-3
  { start: "240.0.0.0", end: "255.255.255.255" }, // reserved
] as const

/** Nedovoljeni IPv6-obsegi (loopback ::1, link-local fe80::/10, ULA fc00::/7, unspecified). */
const BLOCKED_V6 = [
  { start: "::", end: "::" }, // unspecified
  { start: "::1", end: "::1" }, // loopback (v4-mapped 0:0:0:0:0:ffff:127.0.0.1 zajame zgoraj)
  { start: "::ffff:127.0.0.0", end: "::ffff:127.255.255.255" }, // v4-mapped loopback
  { start: "fc00::", end: "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // ULA
  { start: "fe80::", end: "febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // link-local
  { start: "ff00::", end: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // multicast
] as const

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0)
}

function isBlockedV4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const n = v4ToInt(ip) >>> 0
  return BLOCKED_V4.some((r) => n >= v4ToInt(r.start) && n <= v4ToInt(r.end))
}

function v6ToBigInt(ip: string): bigint {
  if (ip.includes("%")) ip = ip.split("%")[0] // odvrzi scope-id (fe80::1%eth0)
  // Normaliziraj IPv4-embedded IPv6 (npr. v4-mapped `::ffff:127.0.0.1` ali
  // embedded `::127.0.0.1`) — username IPv4 literal zadnje polje pretvori v
  // heks par, da `split(":")` in BigInt ne crash-ata. To je NORMALIZACIJA za
  // ugotovitev P2 #2: IPv4-mapped IPv6 mora biti primerljiv kot enaka IPv4.
  const m = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (m) {
    const v4 = m[2].split(".").map((o) => Number(o))
    const hex = ((v4[0] << 8) | v4[1]).toString(16).padStart(4, "0")
    const hex2 = ((v4[2] << 8) | v4[3]).toString(16).padStart(4, "0")
    ip = m[1] + hex + ":" + hex2
  }
  const fields = ip.split("::")
  let left = fields[0] ? fields[0].split(":") : []
  const right = fields[1] ? fields[1].split(":") : []
  const missing = 8 - left.length - right.length
  if (missing > 0) left = left.concat(new Array(missing).fill("0"))
  const all = left.concat(right)
  const hex = all.map((h) => h.padStart(4, "0")).join("")
  return BigInt("0x" + hex)
}

/** Izlušči IPv4 iz IPv4-mapped / 6to4 IPv6 naslova (če obstaja). */
function v6EmbeddedV4(ip: string): string | null {
  if (isIP(ip) !== 6) return null
  // v4-mapped ::ffff:a.b.c.d  (RFC 6052/4291)
  let m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (m) return m[1]
  // 6to4 2002:xxxx:xxxx::/32 → a.b.c.d v drugih dveh heks parih
  m = ip.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/i)
  if (m) {
    const [a, b] = m.slice(1, 3).map((h) => parseInt(h, 16))
    return `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`
  }
  return null
}

function isBlockedV6(ip: string): boolean {
  if (isIP(ip) !== 6) return false
  // Normaliziran IPv4-mapped / 6to4 — ovrednoti VSE IPv4 pravila (loopback,
  // zasebni, link-local, CGNAT, metadata), ne samo eksplicitne v6 razpone.
  const v4 = v6EmbeddedV4(ip)
  if (v4 && isBlockedV4(v4)) return true
  const n = v6ToBigInt(ip)
  return BLOCKED_V6.some(
    (r) => n >= v6ToBigInt(r.start) && n <= v6ToBigInt(r.end)
  )
}

export type EndpointValidation =
  | { ok: true; publicHost: string }
  | { ok: false; error: string }

/** Preveri, da je URL varen zunanji HTTPS cilj (ne SSRF). Ne izvaja omrežja. */
export function assertPublicHttpsUrl(raw: string | null | undefined): EndpointValidation {
  if (!raw) return { ok: false, error: "Endpoint ni podan." }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: "Neveljaven URL naslov." }
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Endpoint mora uporabiti https:// (ali https:// za izjemne sisteme)." }
  }
  // Poslovno: e-pošiljanje gre vedno na HTTPS (ne plain HTTP) v produkciji.
  if (url.protocol === "http:") {
    return { ok: false, error: "Endpoint mora uporabiti https:// — HTTP ni dovoljen za oddajo." }
  }

  const host = url.hostname
  if (!host) return { ok: false, error: "Endpoint nima gostitelja." }

  // IP-naslov zgodaj — ni DNS-rebinding vektorja pri literal IPv4/IPv6.
  if (isIP(host) === 4) {
    if (isBlockedV4(host)) {
      return { ok: false, error: "Endpoint kaže v zasebno/notranjo mrežo — zavrnjeno (SSRF)." }
    }
    return { ok: true, publicHost: host }
  }
  if (isIP(host) === 6) {
    if (isBlockedV6(host)) {
      return { ok: false, error: "Endpoint kaže v zasebno/loopback IPv6 mrežo — zavrnjeno (SSRF)." }
    }
    return { ok: true, publicHost: host }
  }

  // Imenski gostitelj sproži DNS-rebinding rii: localhost-oznake, zaključene
  // na domene/metadata, privzete pa še vedno dovolimo, ker večina testnih
  // ponudnikov uporablja imena.nslookup pa Ni mogoče popolnoma odpraviti brez
  // dogovorjenega DNS-preverjanja pred pošiljanjem (glej hardenRequest()).
  const lower = host.toLowerCase().replace(/\.$/, "")
  const noPort = lower.split(":")[0]
  if (
    noPort === "localhost" ||
    noPort.endsWith(".localhost") ||
    noPort.endsWith(".internal") ||
    noPort.endsWith(".local") ||
    /^0\./.test(lower) ||
    lower === "metadata.google.internal" ||
    lower === "metadata" ||
    /--internal/.test(lower)
  ) {
    return { ok: false, error: "Endpoint uporablja notranje ime — zavrnjeno (SSRF)." }
  }

  return { ok: true, publicHost: host }
}

/**
 * Pred dejanskim pošiljanjem razrešimo DNS in LOCIMO, vsak IP pa znova blokiramo.
 * To pokrije DNS-rebinding (ime se med shranjevanjem in pošiljanjem spremeni),
 * ki ga validacija ob shranjevanju ne more ujeti. Vrne prečiščen hostname ali
 * napako — klic ne sme iti naprej, če kateri koli razrešeni IP pade v blokirano.
 *
 * FAIL-CLOSED DNS: kakršnakoli napaka ali odsotnost razrešitve v produkciji je
 * obravnavana kot zavrnitev (ok:false) — nikoli ne nadaljevanje brez preverjenega
 * IP-ja. Za testne ne-reseljive TLD (npr. `.example`) se DNS injicira prek
 * `__setDnsLookupForTests` (mock lookup → javni IP) in pošiljanje gre skozi mock
 * transport, ne prek pravega resolverja (dolgooumno DODANO GLEJ #1318).
 */
export type DnsLookup = (
  host: string
) => Promise<{ address: string; family: number }[]>

/** Injektabilni DNS resolver — privzeto realni `node:dns/promises.lookup`. */
let dnsLookupImpl: DnsLookup | null = null
export function __setDnsLookupForTests(impl: DnsLookup | null): void {
  dnsLookupImpl = impl
}
async function lookupAll(host: string): Promise<string[]> {
  if (dnsLookupImpl) {
    const r = await dnsLookupImpl(host)
    return r.map((x) => x.address)
  }
  const dns = await import("node:dns/promises")
  return (await dns.lookup(host, { all: true, verbatim: true, family: 0 })).map(
    (r) => r.address
  )
}

export async function resolveAndVerifyEndpoint(
  host: string
): Promise<{ ok: true; ip: string | null } | { ok: false; error: string }> {
  let records: string[]
  try {
    records = await lookupAll(host)
  } catch (err) {
    // FAIL-CLOSED: DNS napaka (ENOTFOUND, resolver down, timeout…) NE pomeni
    // "ni SSRF tveganja" — pomeni "ne moremo preveriti", kar v produkciji
    // prepreči pošiljanje. Testni `.example` TLD mora injicirati mock lookup
    // (glej __setDnsLookupForTests), ne napake.
    return {
      ok: false,
      error: `DNS ni razrešil naslova (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  if (!records.length) {
    return {
      ok: false,
      error: "DNS ni vrnil nobene A/AAAA vrstice (fail-closed) — ni preverjenega IP-ja.",
    }
  }
  for (const ip of records) {
    if (isIP(ip) === 4 && isBlockedV4(ip)) {
      return { ok: false, error: `DNS razrešuje v zasebno IPv4 mrežo (${ip}) — zavrnjeno (SSRF).` }
    }
    if (isIP(ip) === 6 && isBlockedV6(ip)) {
      return { ok: false, error: `DNS razrešuje v notranjo IPv6 mrežo (${ip}) — zavrnjeno (SSRF).` }
    }
  }
  return { ok: true, ip: records[0] }
}