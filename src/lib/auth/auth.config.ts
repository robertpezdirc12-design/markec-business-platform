// ============================================================
// EDGE-SAFE AUTH CONFIG (NextAuth v5 "split config")
//
// Everything the middleware needs and nothing it doesn't. The
// middleware only READS the session out of the JWT cookie
// (role / organizationId for redirects) — it never authenticates.
//
// Why this file exists: importing the full NextAuth instance from
// `auth.ts` pulled bcryptjs + Prisma Client + the DB-backed rate
// limiter into the edge bundle. That bundle reached 1.11 MB and
// Vercel refuses to deploy an Edge Function over 1 MB:
//   "The Edge Function \"middleware\" size is 1.11 MB and your
//    plan size limit is 1 MB."
// (Cloudflare tolerated it, Vercel — which we also deploy to while
// the product is being built — did not.)
//
// HARD RULE for this file: no Prisma, no bcrypt, no Node built-ins,
// no next/headers. Providers and their DB-touching callbacks stay
// in `auth.ts`. Keep the `session` callback here — the main config
// reuses it via spread, so the two runtimes cannot drift apart.
// ============================================================

import type { NextAuthConfig } from "next-auth"
import type { UserRole } from "@prisma/client"

export const authConfig = {
  // F2.2.2 P1-6 (dev okolje): brez nastavljenega trustHost je NextAuth
  // middleware v dev krepil req.url na NEXTAUTH_URL pin (http://localhost:3000)
  // → zaščitena preusmeritev je bila na port 3000, ko strežnik teče na
  // 3001 (ERR_CONNECTION_REFUSED). V dev zaupamo dejanskemu request
  // hostu. V produkciji je vedenje fail-closed: hostu zaupamo le, kadar je
  // to izrecno omogočeno (AUTH_TRUST_HOST=true) ali ko je Auth.js na
  // zaupanja vrednem platformnem hostu (VERCEL=1 — samo Vercel). Prej je
  // bilo `trustHost: NODE_ENV !== "production"` trdno zakodirano na false v
  // vseh produkcijskih načinih, kar je onemogočalo prijavo v next start in
  // na Vercel brez spremembe kode.
  trustHost:
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_TRUST_HOST === "true" ||
    process.env.VERCEL === "1",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
    // P1 #107: NextAuth privzeta stran za odjavo je angleška ("Sign out").
    // Preusmerimo jo na lastno slovensko stran /logout.
    signOut: "/logout",
  },
  // Middleware only verifies/reads a session — it must not carry the
  // credentials provider (bcrypt + Prisma) or the OAuth provider.
  providers: [] as NextAuthConfig["providers"],
  callbacks: {
    // Session shape is the contract between the two configs: the JWT
    // callback in auth.ts writes these claims, this callback maps them
    // onto `session.user`.
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.organizationId = (token.organizationId as string | null) ?? null
      }
      return session
    },
  },
} satisfies NextAuthConfig
