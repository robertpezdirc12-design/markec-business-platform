import { z } from "zod"

// Deljeni validator za uporabniško ime (username). Neobvezna vrednost:
// dovoli prazno (uporabnik ga ni izbral) ali veljavno uporabniško ime.
export const usernameField = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || v.length >= 3, {
    message: "Uporabniško ime mora imeti vsaj 3 znake",
  })
  .refine((v) => !v || v.length <= 20, {
    message: "Uporabniško ime lahko ima največ 20 znakov",
  })
  .refine((v) => !v || /^[a-z0-9_]+$/.test(v), {
    message:
      "Uporabniško ime sme vsebovati le male črke, številke in podčrtaj",
  })

// Prijava sprejme e-poštni naslov ALI uporabniško ime v enem polju (login).
// Ne validiramo ga kot e-pošto — authorize razloči po znaku "@".
export const loginSchema = z.object({
  login: z
    .string()
    .min(1, "Vnesite e-poštni naslov ali uporabniško ime")
    .min(3, "Prekratek vnos")
    .max(200, "Predolg vnos"),
  password: z
    .string()
    .min(1, "Geslo je obvezno")
    .min(6, "Geslo mora imeti vsaj 6 znakov"),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, "Ime je obvezno")
      .min(2, "Ime mora imeti vsaj 2 znaka"),
    email: z
      .string()
      .min(1, "E-poštni naslov je obvezen")
      .email("Neveljaven e-poštni naslov"),
    username: usernameField,
    password: z
      .string()
      .min(1, "Geslo je obvezno")
      .min(8, "Geslo mora imeti vsaj 8 znakov")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Geslo mora vsebovati vsaj eno veliko črko, eno malo črko in eno številko"
      ),
    confirmPassword: z.string().min(1, "Potrdite svoje geslo"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Gesli se ne ujemata",
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email("Neveljaven e-poštni naslov"),
})

// Deljeni pravila moči gesla (uporablja reset + admin reset)
export const passwordSchema = z
  .string()
  .min(8, "Geslo mora imeti vsaj 8 znakov")
  .regex(/[A-Z]/, "Geslo mora vsebovati vsaj eno veliko črko")
  .regex(/[a-z]/, "Geslo mora vsebovati vsaj eno malo črko")
  .regex(/[0-9]/, "Geslo mora vsebovati vsaj eno številko")

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Žeton je obvezen"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Gesli se ne ujemata",
    path: ["confirmPassword"],
  })

// Admin nastavi novo geslo članu salona (dashboard/users/[id])
export const adminSetPasswordSchema = z.object({
  userId: z.string().min(1, "Uporabnik je obvezen"),
  password: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Žeton je obvezen"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type AdminSetPasswordInput = z.infer<typeof adminSetPasswordSchema>
