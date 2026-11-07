import { z } from "zod"

export const loginSchema = z.object({
  // #OBOJE: e-pošta ALI uporabniško ime (prijava z geslom + uporabniškim imenom).
  login: z
    .string()
    .min(1, "Vnesite e-pošto ali uporabniško ime")
    .min(2, "Vnesite e-pošto ali uporabniško ime"),
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
    password: z
      .string()
      .min(1, "Geslo je obvezno")
      .min(8, "Geslo mora imeti vsaj 8 znakov")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Geslo mora vsebovati vsaj eno veliko črko, eno malo črko in eno številko"
      ),
    confirmPassword: z.string().min(1, "Potrdite svoje geslo"),
    // #OBOJE: uporabniško ime je neobvezno — če ni podano, ga strežnik
    // izpelje iz e-pošte. Dovoljeni znaki: črke, številke, pika, podčrtaj,
    // vezaj (3–20 znakov).
    username: z
      .union([
        z.literal(""),
        z
          .string()
          .min(3, "Uporabniško ime mora imeti vsaj 3 znake")
          .max(20, "Uporabniško ime je lahko dolgo največ 20 znakov")
          .regex(
            /^[a-zA-Z0-9_.-]+$/,
            "Dovoljeni so le črke, številke, pika, podčrtaj in vezaj"
          ),
      ])
      .optional(),
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
