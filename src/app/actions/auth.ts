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
import { isEmailServiceConfigured } from "@/lib/email/config"

// #OBOJE: razreši uporabniško ime za nov račun.
//  - če je `provided` podan, preveri edinstvenost (case-insensitive);
//  - sicer izpelje osnovo iz e-pošte in doda niz (ali naključni sufiks),
//    da je vrednost edinstvena;
//  - vrne `null`, če podano ime ni na voljo (klicatelj vrne napako).
// Javno (ponovno uporablja onboarding pri anonimni kreaciji lastnika).
export async function resolveUsername(provided: string | null, email: string): Promise<string | null> {
  if (provided) {
    const candidate = provided.toLowerCase()
    const clash = await prisma.user.findFirst({
      where: { username: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    })
    return clash ? null : candidate
  }

  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .slice(0, 18)
  if (!base) return null

  let candidate = base
  for (let attempt = 0; attempt < 10; attempt++) {
    const clash = await prisma.user.findFirst({
      where: { username: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    })
    if (!clash) return candidate
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`
  }
  return null
}

// Server action to handle user registration
export async function registerUser(data: RegisterInput) {
  const validatedData = registerSchema.safeParse(data)

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.issues }
  }

  try {
    const { name, email, password, username: rawUsername } = validatedData.data
    const hashedPassword = await bcrypt.hash(password, 10)

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return {
        success: false,
        errors: [{ message: "E-poštni naslov je že registriran." }],
      }
    }

    // #OBOJE: uporabniško ime (neobvezno). Če je podano, preverimo
    // edinstvenost; če ni, ga izpeljemo iz e-pošte in zagotovimo
    // edinstveno vrednost.
    const username = await resolveUsername(
      rawUsername && rawUsername.length > 0 ? rawUsername : null,
      email
    )
    if (username === null) {
      return {
        success: false,
        errors: [{ message: "Uporabniško ime je že zasedeno. Izberite drugega." }],
      }
    }

    // Check if there's an existing Customer with this email (from a deleted account)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email,
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
          username,
          password: hashedPassword,
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
          username,
          password: hashedPassword,
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
    if (!isEmailServiceConfigured()) {
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

// Server action to send password reset email
export async function forgotPassword(data: ForgotPasswordInput) {
  const validatedData = forgotPasswordSchema.safeParse(data)

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.issues }
  }

  try {
    const { email } = validatedData.data

    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Security: Always return success to not reveal if email exists
    if (!user) {
      return { success: true }
    }

    const token = crypto.randomBytes(32).toString("hex")

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
      },
    })

    // Send email in background (non-blocking)
    after(async () => {
      await sendPasswordResetEmail(email, token)
    })

    // Brez e-poštnega servisa povezava prikaži v UI (glej registerUser).
    if (!isEmailServiceConfigured()) {
      return { success: true, resetUrl: `/reset-password?token=${token}`, emailSent: false }
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

  try {
    const { token, password } = validatedData.data

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
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
