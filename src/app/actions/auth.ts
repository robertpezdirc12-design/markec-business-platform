"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import {
  forgotPasswordSchema,
  ForgotPasswordInput,
  RegisterInput,
  registerSchema,
  resetPasswordSchema,
  ResetPasswordInput,
} from "@/lib/validations/auth"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email/password-reset"
import { sendVerificationEmail } from "@/lib/email/email-verification"
import { sendAccountActivatedEmail } from "@/lib/email/account-activated"
import { allowVerificationFallback, isEmailServiceConfigured } from "@/lib/email/config"
import { hashResetToken, resetTokenLookupValues } from "@/lib/auth/reset-token"
import {
  rateLimit,
  getClientIp,
  registerLimits,
  forgotLimits,
} from "@/lib/rate-limit"
import {
  resolveLoginToEmail,
  normalizeUsername,
} from "@/lib/auth/login-resolution"

/** Pomožnik: vnese rate-limit v določeno akcijo. */
async function blockedOrNull(
  r: Awaited<ReturnType<typeof rateLimit>>
): Promise<{ success: boolean; errors: { message: string }[] } | null> {
  if (r.ok) return null
  return {
    success: false,
    errors: [
      {
        message:
          "Preveč poskusov. Počakajte nekaj minut in poskusite znova.",
      },
    ],
  }
}

// Server action to handle user registration
export async function registerUser(data: RegisterInput) {
  const validatedData = registerSchema.safeParse(data)

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.issues }
  }

  // Rate-limit: registracija na IP (omeji botnete), fail-open za dostopnost.
  const ip = await getClientIp()
  const blocked = await blockedOrNull(
    await rateLimit({ scope: "register:ip", key: ip, ...registerLimits() })
  )
  if (blocked) return blocked

  try {
    const { name, password } = validatedData.data
    // E-pošta je po dogovoru NEOBJUTLJIVA na velikost črk. Brez
    // normalizacije bi se "Foo@Example.com" shranil drugače kot prijava
    // (ki lowercasa) in uporabnik se ne bi mogel prijaviti.
    const email = validatedData.data.email.trim().toLowerCase()
    // Optional username: normalize lowercase + trim skozi skupno pomočniko.
    const username = normalizeUsername(validatedData.data.username)
    const hashedPassword = await bcrypt.hash(password, 10)

    // Če je uporabnik izbral uporabniško ime, mora biti edinstveno
    // (prisma @@unique) — preverimo naprej za prijazen error.
    if (username) {
      const taken = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (taken) {
        return {
          success: false,
          errors: [{ message: "To uporabniško ime je že zasedeno." }],
        }
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (existingUser) {
      // M14 (audit 2026-11): nevtralen odgovor — ne razkrijemo, ali
      // račun obstaja (nasprotuje nevtralnim odgovorom forgot/resend).
      // Enako sporočilo kot pri drugih napakah registracije.
      return {
        success: false,
        errors: [
          { message: "Registracija ni uspela. Preverite podatke in poskusite znova." },
        ],
      }
    }

    // Check if there's an existing Customer with this email (from a deleted account)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        userId: null, // Customer exists but has no linked User
      },
    })

    let newUser

    if (existingCustomer) {
      // Link existing Customer to new User (preserves appointment/order history)
      newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          username,
          customer: {
            connect: { id: existingCustomer.id },
          },
        },
      })

      // Update customer name in case it changed
      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { name },
      })
    } else {
      // Create new User with new Customer
      newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          username,
          customer: {
            create: {
              name,
              email,
            },
          },
        },
      })
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")

    // Store token in database (expires in 24 hours)
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: new Date(Date.now() + 86400000), // 24 hours
      },
    })

    // Send verification email in background (non-blocking)
    after(async () => {
      await sendVerificationEmail(email, verificationToken)
    })
    revalidatePath("/dashboard/users")

    // Brez konfiguriranega e-poštnega servisa sporočilo nikoli ne prispe —
    // vrni povezavo, da UI lahko uporabniku pokaze dostopen način potrditve.
    if (!isEmailServiceConfigured() && allowVerificationFallback()) {
      return {
        success: true,
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        verificationUrl: `/verify-email?token=${verificationToken}`,
        emailSent: false,
      }
    }

    return {
      success: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      emailSent: true,
    }
  } catch (error) {
    console.error("Registration error:", error)
    return {
      success: false,
      errors: [{ message: "Prišlo je do napake. Poskusite znova." }],
    }
  }
}

// Server action to send a fresh verification email to an EXISTING, unverified
// account. 2D-4: safe resend — only existing unverified emails; never reveals
// whether an address exists (neutral response shape); a 24h cooldown prevents
// abuse; each resend invalidates the previous token (single-use preserved).
export async function resendVerification(data: { login?: string; email?: string }) {
  // Sprejme `login` (email ali username); podpremo tudi staro `email` obliko.
  const rawLogin = String(data?.login ?? data?.email ?? "").trim()
  if (!rawLogin) {
    return { success: false, errors: [{ message: "E-poštni naslov ali uporabniško ime je obvezno." }] }
  }
  const isEmail = rawLogin.includes("@")
  const email = isEmail
    ? rawLogin.toLowerCase()
    : (await resolveLoginToEmail(rawLogin)) ?? ""
  if (!email) {
    // Ne razkrijemo, ali login obstaja: za neznan email vrni "uspeh" kot spodaj.
    return { success: true, emailSent: false, ignored: true }
  }

  // Rate-limit: ponovno pošiljanje na IP (poleg obstoječega 60s cooldowna).
  const blocked = await blockedOrNull(
    await rateLimit({ scope: "resend:ip", key: await getClientIp(), limit: 5, windowMs: 60 * 60_000 })
  )
  if (blocked) return blocked

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Ne razkrij, ali e-pošta obstaja (enako forgotPassword): vedno vračaj
    // "uspeh", ko e-pošta ne obstaja ali je že verificirana.
    if (!user || user.emailVerified) {
      return { success: true, emailSent: false, ignored: true }
    }

    // Cooldown: prepogoste prošnje (≤60s od zadnjega posljetka) se zavrnejo,
    // da onemogočimo spam. Tok prestan po 60s, ko uporabnik lahko legitimno
    // zaprosi za novo povezavo (stara se ob tem izbrise). Nove tokenje izda
    // 24-urni enkratni mehanizem (kot registerUser).
    const existing = await prisma.verificationToken.findFirst({
      where: { identifier: email },
      orderBy: { expires: "desc" },
      select: { expires: true },
    })
    if (existing) {
      // issuedAt = expires - 24h (token je izdan z 24-urnim TTL).
      const issuedAt = existing.expires.getTime() - 86400000
      if (issuedAt > Date.now() - 60_000) {
        return { success: true, emailSent: false, ignored: true }
      }
    }

    // Star (morebiten še nepretečen) token izbrišemo, tako da stara povezava
    // ne da več dostopa in se ne kopiči.
    await prisma.verificationToken.deleteMany({ where: { identifier: email } })

    const token = crypto.randomBytes(32).toString("hex")
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires: new Date(Date.now() + 86400000) },
    })

    after(async () => {
      await sendVerificationEmail(email, token)
    })

    if (!isEmailServiceConfigured() && allowVerificationFallback()) {
      return { success: true, verificationUrl: `/verify-email?token=${token}`, emailSent: false }
    }
    return { success: true, emailSent: true }
  } catch (error) {
    console.error("Resend verification error:", error)
    return {
      success: false,
      errors: [{ message: "Prišlo je do napake. Poskusite znova." }],
    }
  }
}

// Server action to send password reset email
export async function forgotPassword(data: ForgotPasswordInput) {
  const validatedData = forgotPasswordSchema.safeParse(data)

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.issues }
  }

  // Rate-limit: pozaba gesla na IP in na e-pošto (prepreči zasmetenje/brute-
  // force obstoja e-pošt). Ne razkrijemo ničesar o obstoju računa (enotna oblika).
  const ip = await getClientIp()
  const { limit, windowMs } = forgotLimits()
  const blockedIp = await blockedOrNull(await rateLimit({ scope: "forgot:ip", key: ip, limit, windowMs }))
  if (blockedIp) return blockedIp
  const blockedEmail = await blockedOrNull(
    await rateLimit({ scope: "forgot:email", key: validatedData.data.email, limit: 3, windowMs: 60 * 60_000 })
  )
  if (blockedEmail) return blockedEmail

  try {
    const email = validatedData.data.email.trim().toLowerCase()

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    // Security: Always return success to not reveal if email exists
    if (!user) {
      return { success: true }
    }

    const token = crypto.randomBytes(32).toString("hex")

    // P0: v bazo gre SAMO hash — surovi žeton odide izključno po e-pošti.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashResetToken(token),
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
      },
    })

    // Send email in background (non-blocking)
    after(async () => {
      await sendPasswordResetEmail(email, token)
    })

    // P0 SECURITY (audit 2026-11): žeton za PONASTAVITEV GESLA se NIKOLI ne
    // vrne v HTTP odgovoru — tudi v razvoju ne. Kdor koli bi lahko brez
    // prijave poklical to akcijo za tuj e-naslov in dobil veljaven žeton
    // (zastavica EMAIL_VERIFICATION_FALLBACK je bila v produkcijski
    // konfiguraciji = prevzem računa). Razvijalcu, ki Resenda nima, se
    // povezava izpiše SAMO v strežniški dnevnik.
    if (!isEmailServiceConfigured()) {
      if (allowVerificationFallback()) {
        console.info(
          `[dev] Ponastavitev gesla za ${email}: /reset-password?token=${token}`
        )
      }
      return { success: true, emailSent: false }
    }

    return { success: true, emailSent: true }
  } catch (error) {
    console.error("Password reset error:", error)
    return {
      success: false,
      errors: [{ message: "Prišlo je do napake. Poskusite znova." }],
    }
  }
}

//Reset password action
export async function resetPassword(data: ResetPasswordInput) {
  const validatedData = resetPasswordSchema.safeParse(data)

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.issues }
  }

  // Rate-limit: ponastavitev gesla na IP (limitira brute-force žetona).
  const blocked = await blockedOrNull(
    await rateLimit({ scope: "reset:ip", key: await getClientIp(), limit: 10, windowMs: 60 * 60_000 })
  )
  if (blocked) return blocked

  try {
    const { token, password } = validatedData.data

    // P0: iskanje po HASHU žetona (s prehodnim fallbackom na surovo vrednost
    // za vrstice, zapisane pred uvedbo hasha).
    const user = await prisma.user.findFirst({
      where: {
        resetToken: { in: resetTokenLookupValues(token) },
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return {
        success: false,
        errors: [{ message: "Neveljaven ali potekel žeton." }],
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Reset password error:", error)

    return {
      success: false,
      errors: [{ message: "Prišlo je do napake. Poskusite znova." }],
    }
  }
}

//Verify email action
export async function verifyEmail(token: string) {
  try {
    // Find the verification token in the database
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    // If token not found
    if (!verificationToken) {
      return {
        success: false,
        errors: [{ message: "Neveljaven ali potekel žeton za potrditev." }],
      }
    }

    // If token expired
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { token },
      })
      return {
        success: false,
        errors: [{ message: "Neveljaven ali potekel žeton za potrditev." }],
      }
    }

    // Mark user's email as verified and get user info
    const user = await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
      select: { name: true, email: true },
    })

    // Delete the used verification token
    await prisma.verificationToken.delete({
      where: { token },
    })

    // Send account activated email in background (non-blocking)
    if (user.email) {
      after(async () => {
        await sendAccountActivatedEmail(user.email!, user.name || undefined)
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Email verification error:", error)
    return {
      success: false,
      errors: [{ message: "Prišlo je do napake. Poskusite znova." }],
    }
  }
}
