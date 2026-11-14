import NextAuth, { DefaultSession, CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { rateLimit, getClientIp, loginLimits } from "@/lib/rate-limit"

// Custom error for email not verified
class EmailNotVerifiedError extends CredentialsSignin {
  code = "EMAIL_NOT_VERIFIED"
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    organizationId?: string | null
  }
}

// `unstable_update` omogoča server actionom osvežitev JWT seje (nova
// vloga/povezana organizacija) brez ponovne prijave — uporablja onboarding
// #40: obstoječ račun, ki ustvari podjetje, dobi organizationId + role ADMIN
// v ISTI seji (dashboard takoj dostopen).
export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  // F2.2.2 P1-6 (dev okolje): brez nastavljenega trustHost je NextAuth
  // middleware v dev krepil req.url na NEXTAUTH_URL pin (http://localhost:3000)
  // → zaščitena preusmeritev je bila na port 3000, ko strežnik teče na
  // 3001 (ERR_CONNECTION_REFUSED). V dev zaupamo dejanskemu request
  // hostu; v produkciji je vedenje nespremenjeno (env usmerja, fail-closed).
  trustHost: process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // Google OAuth (prijava z Google računom). Fail-closed: provider je vpisan
    // SAMO, če sta ID in Secret nastavljena v okolju — sicer gumba niti ne
    // prikažemo (ni fake prijave). Auth.js v5 lahko prebere AUTH_GOOGLE_* sam,
    // a zaradi mešanih konvencij env v tem repo-ju preberemo eksplicitno.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        // Rate-limit prijave (točka 1): per IP in per e-pošta, DB-backed.
        // Blokiranim poskusom javimo "Invalid credentials" brez namiga, kaj
        // je narobe (ne razkrijemo obstoja e-pošte). Fail-open: ob izpadu
        // števca se prijava nadaljuje (rate limit je zaščita, ne avtorizacija).
        const email = String(credentials.email).trim().toLowerCase()
        const { limit, windowMs } = loginLimits()
        const ip = await getClientIp()
        const [ipCheck, emailCheck] = await Promise.all([
          rateLimit({ scope: "login:ip", key: ip, limit, windowMs }),
          rateLimit({ scope: "login:email", key: email, limit, windowMs }),
        ])
        if (!ipCheck.ok || !emailCheck.ok) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        // Block login if email is not verified
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError()
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    // Google OAuth: brez Prisma adapterja ta callback preslika Google račun na
    // lokalnega uporabnika (find-or-create po verified e-pošti) in poveže Account.
    // Credentials prijavo to ne zadeva (preskočimo, vrnemo true).
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true

      const googleEmail = (profile?.email ?? user?.email ?? "").trim().toLowerCase()
      if (!googleEmail) return true

      try {
        let dbUser = await prisma.user.findUnique({ where: { email: googleEmail } })

        // Ni obstoječega računa → ustvari novega (Google je potrdil e-pošto).
        if (!dbUser) {
          const name =
            typeof profile?.name === "string" && profile.name.trim()
              ? profile.name.trim()
              : (user?.name ?? null)
          dbUser = await prisma.user.create({
            data: {
              name,
              email: googleEmail,
              emailVerified: new Date(), // Google nam jamči lastništvo e-pošte
              image: typeof profile?.picture === "string" ? profile.picture : user?.image ?? null,
              role: "CLIENTE",
              customer: { create: { name: name ?? googleEmail, email: googleEmail } },
            },
          })
        } else if (user?.image) {
          // Obstoječemu dopolni/sinhroniziraj Google avatar (če ga še nima).
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { image: dbUser.image ?? user.image },
          })
        }

        // Poveži Account (provider+providerAccountId → userId) varno z upsert.
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: String(account.providerAccountId),
            },
          },
          create: {
            userId: dbUser.id,
            type: account.type ?? "oauth",
            provider: "google",
            providerAccountId: String(account.providerAccountId),
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
          },
          update: { userId: dbUser.id },
        })

        // Prepiši lokalne podatke v `user`, da jwt callback napolni token pravilno.
        user.id = dbUser.id
        user.role = dbUser.role
        ;(user as { organizationId?: string | null }).organizationId =
          dbUser.organizationId ?? null
        return true
      } catch (error) {
        // Fail-open v smislu varnosti: če preslikava pade, NE pusti delovati
        // prijave brez lokalnega računa — raje zavrnemo (prijava ne uspe).
        console.error("[auth] google signIn mapping failed:", error)
        return false
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId ?? null
      }
      // #40: server action (unstable_update) pošlje sveže vrednosti kot
      // user patch — prepiši token polja, da seja odraža novo stanje računa.
      if (trigger === "update" && session) {
        const patch = session.user as
          | { role?: UserRole; organizationId?: string | null }
          | undefined
        if (patch) {
          if (typeof patch.role !== "undefined") token.role = patch.role
          if (typeof patch.organizationId !== "undefined") {
            token.organizationId = patch.organizationId
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.organizationId = (token.organizationId as string | null) ?? null
      }
      return session
    },
  },
})
