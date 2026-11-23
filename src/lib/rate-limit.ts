// ============================================================
// RATE LIMIT (točka 1 — varnost in higiena)
//
// Enoten, deljen števec za omejevanje hitrosti občutljivih dejanj
// (prijava, registracija, pozaba/ponastavitev gesla, ponoven email).
// Remote-shared (ne in-memory): platforma teče serverless (Vercel),
// in-memory števec bi se ponastavil ob hladnem zagonu in se ne bi
// delil med instancami — zato je shramba v bazi (model RateLimit).
//
// Fiksno okno (fixed window): windowStart = now, zaokrožen na okno.
// Prednost: determinističen, brez dodatnih stolpcev za drseči curek;
// primeren za ta tip omejitev (login/register/verifikacija).
//
// PRAVILA:
//  - rate limit je NEODVISEN od uspeha/neuspeha poskusa — štejemo
//    vsak prihod (npr. login limit 10/15 min na IP). Uspešna prijava
//    mestoma kdaj pomiri IP, a ohranjamo preprostost in varnost.
//  - limits so nastavljivi prek okoljskih spremenljivk (sane defaulti).
//  - Napaka baze nikoli ne sme ONEMOGOČITI login/registracijo: ob
//    izpadu števca vedno PROPUSTIMO (fail-open za dostopnost, ker je
//    rate limit zaščita, ne avtorizacija). Opozarjamo v log.
// ============================================================

import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

export type RateLimitScope = "login:ip" | "login:email" | "register:ip" | "forgot:ip" | "forgot:email" | "reset:ip" | "resend:ip" | "inquiry:ip" | "promo:ip" | "booking:ip" | "checkout:ip" | "chat:ip" | "upload:user"

/**
 * Pridobi naslov odjemalca iz request konteksta (server action / route).
 * Na Vercel/shared-gateway je odjemalski IP v `x-forwarded-for` (prvi naslov).
 * Odpove fail-soft: če IP ni berljiv, vrnemo stabilen "unknown" (brez klica).
 */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    const fwd = h.get("x-forwarded-for") ?? h.get("x-real-ip")
    if (fwd) return fwd.split(",")[0].trim()
  } catch {
    // headers() ni na voljo (npr. izven request konteksta) — ignoriraj.
  }
  return "unknown"
}

export interface RateLimitOptions {
  scope: RateLimitScope
  key: string
  /** Največje število dogodkov v oknu. */
  limit: number
  /** Dolžina okna v milisekundah. */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Koliko ms do konca okna (0, če ok). */
  retryAfterMs: number
}

/** Fiksno okno: čas, zamaknjen na začetek okna, ki vsebuje `now`. */
export function floorWindow(now: number, windowMs: number): Date {
  return new Date(Math.floor(now / windowMs) * windowMs)
}

/**
 * Čista odločitvena logika (testabilna brez baze).
 * Vrne objekt, ki pove, kaj treba narediti za dano vrstico.
 */
export function decideRateLimit(
  row: { windowStart: Date; count: number } | null,
  opts: { limit: number; windowMs: number; now: number }
): "reset" | "increment" | { blocked: true; retryAfterMs: number } {
  const currentWindow = floorWindow(opts.now, opts.windowMs)
  if (!row || row.windowStart.getTime() < currentWindow.getTime()) return "reset"
  if (row.count >= opts.limit) {
    // Blokiran do konca trenutnega okna.
    const retryAfterMs = Math.max(0, currentWindow.getTime() + opts.windowMs - opts.now)
    return { blocked: true, retryAfterMs }
  }
  return "increment"
}

/**
 * Preveri in poveča števec za dan scope+key v fiksnem oknu.
 * Transakcija: upsert vrstice, nato branje + odločanje (zaklenjeno).
 */
export async function rateLimit({ scope, key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now()
  const currentWindow = floorWindow(now, windowMs)
  const windowEnd = currentWindow.getTime() + windowMs

  try {
    return await prisma.$transaction(async (tx) => {
      // Obstaja vrstica za to okno? Upsert jo ustvari, če je ni.
      const row = await tx.rateLimit.upsert({
        where: { scope_key: { scope, key } },
        create: {
          scope,
          key,
          windowStart: currentWindow,
          count: 1,
          expiresAt: new Date(windowEnd),
        },
        update: {},
      })

      const decision = decideRateLimit(row, { limit, windowMs, now })

      // Novo okno → ponastavi in štej 1.
      if (decision === "reset") {
        await tx.rateLimit.update({
          where: { id: row.id },
          data: { windowStart: currentWindow, count: 1, expiresAt: new Date(windowEnd) },
        })
        return { ok: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 } as const
      }

      // Prekoračitev — blokiraj, povej, kdaj poteče okno.
      if (decision !== "increment") {
        return { ok: false, remaining: 0, retryAfterMs: decision.retryAfterMs } as const
      }

      // Dvigni števec in vrni preostanek.
      const next = await tx.rateLimit.update({
        where: { id: row.id },
        data: { count: { increment: 1 } },
      })
      return { ok: true, remaining: Math.max(0, limit - next.count), retryAfterMs: 0 } as const
    })
  } catch (error) {
    // Fail-open: izpad baze ne sme zapreti uporabnika ven.
    console.error("[rate-limit] failed open:", scope, key, error)
    return { ok: true, remaining: 1, retryAfterMs: 0 }
  }
}

/**
 * Počisti zastarele vrstice (kliče cron). Ne briše aktivnih oken.
 */
export async function purgeExpiredRateLimits(now = Date.now()): Promise<number> {
  const res = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
  return res.count
}

/** Predlogi (sane defaulti, prekrižljivi z env). */
export const AUTH_RATE_LIMITS = {
  LOGIN_IP: { limit: 10, windowMs: 15 * 60_000 },
  LOGIN_EMAIL: { limit: 10, windowMs: 15 * 60_000 },
  REGISTER_IP: { limit: 5, windowMs: 60 * 60_000 },
  FORGOT_IP: { limit: 5, windowMs: 60 * 60_000 },
  FORGOT_EMAIL: { limit: 3, windowMs: 60 * 60_000 },
  RESET_IP: { limit: 10, windowMs: 60 * 60_000 },
  RESEND_IP: { limit: 5, windowMs: 60 * 60_000 },
  // Javni obrazci (povpraševanja) per IP — omeji spam/botnete, ne da bi
  // legitimnega obiskovalca blokiral (4 / 10 min ≈ redke oddaje).
  INQUIRY_IP: { limit: 4, windowMs: 10 * 60_000 },
  // EPIC 5: javni chat recepcionista — 30 sporočil / 10 min je poln
  // pogovor s prvim predlogom; legitimni obiskovalec se nikoli ne omeji.
  CHAT_IP: { limit: 30, windowMs: 10 * 60_000 },
} as const

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function loginLimits() {
  return {
    limit: envInt("RATE_LIMIT_LOGIN", AUTH_RATE_LIMITS.LOGIN_IP.limit),
    windowMs: envInt("RATE_LIMIT_LOGIN_WINDOW_MS", AUTH_RATE_LIMITS.LOGIN_IP.windowMs),
  }
}

export function registerLimits() {
  return {
    limit: envInt("RATE_LIMIT_REGISTER", AUTH_RATE_LIMITS.REGISTER_IP.limit),
    windowMs: envInt("RATE_LIMIT_REGISTER_WINDOW_MS", AUTH_RATE_LIMITS.REGISTER_IP.windowMs),
  }
}

export function forgotLimits() {
  return {
    limit: envInt("RATE_LIMIT_FORGOT", AUTH_RATE_LIMITS.FORGOT_IP.limit),
    windowMs: envInt("RATE_LIMIT_FORGOT_WINDOW_MS", AUTH_RATE_LIMITS.FORGOT_IP.windowMs),
  }
}

export function inquiryLimits() {
  return {
    limit: envInt("RATE_LIMIT_INQUIRY", AUTH_RATE_LIMITS.INQUIRY_IP.limit),
    windowMs: envInt("RATE_LIMIT_INQUIRY_WINDOW_MS", AUTH_RATE_LIMITS.INQUIRY_IP.windowMs),
  }
}

export function chatLimits() {
  return {
    limit: envInt("RATE_LIMIT_CHAT", AUTH_RATE_LIMITS.CHAT_IP.limit),
    windowMs: envInt("RATE_LIMIT_CHAT_WINDOW_MS", AUTH_RATE_LIMITS.CHAT_IP.windowMs),
  }
}