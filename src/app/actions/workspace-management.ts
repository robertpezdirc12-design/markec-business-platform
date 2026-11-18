"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { unstable_update } from "@/lib/auth/auth"
import { revalidatePath } from "next/cache"
import { userHasPermission } from "@/lib/permissions/effective"
import { isReservedSlug, isSlugAvailable, slugify } from "@/lib/tenant"
import { generateIntakeToken } from "@/lib/forms/intake-token"
import { hashInvitationToken } from "@/lib/invitations/hash"
import { listProfileOptions, GENERIC_PROFILE_ID } from "@/lib/profiles/registry"
import { PALETTES } from "@/lib/verticals"

// ============================================================
// #100 F2.2 — UPRAVLJANJE PODJETIJ IN POSLOVNIH PROSTOROV
//
// Uporabnik ima en račun, pod njim pa upravlja več workspaceov.
// Vloga je PER WORKSPACE (OrganizationMember). Akcije so
// org-scoped in fail-closed: samo lasten workspace iz `requireSessionOrg`
// (ali tvoj lasten član v njem), nikoli tuj ali neaktiven.
//
// Ključna pravila:
//  - ustvarjanje: nov workspace → lastnik (ADMIN član) tega uporabnika
//  - člani: vsa mutacija prek org-scoped dovoljenja `staff.manage`
//  - zadnji ADMIN v workspaceu ni mogoče degradirati/odstraniti
//  - isDefault = uporabnikova IZBIRA privzetega; preklop ga ne menja
//  - vse varnostno: verify membership + status + fail-closed
// ============================================================

export interface WorkspaceMember {
  userId: string
  name: string | null
  email: string
  role: string
  isDefault: boolean
  isSelf: boolean
  createdAt: Date
}

export interface WorkspaceBasic {
  id: string
  name: string
  slug: string
  logo: string | null
  vertical: string | null
  verticalLabel: string | null
  status: string
  role: string
  isDefault: boolean
}

// ------------------------------------------------------------
// POVABILA — token se v DB hrani SAMO kot SHA-256 hash (F2.2.1).
// Surovi token se vrne klicatelju natanko enkrat ob ustvarjanju;
// nikoli se ne shrani v bazo ali v loge (klineti ga pri rednem
// seznamu ne vidijo). Sprejem/preklic najprej hashira → poišče hash.
// Hash pomožnica: src/lib/invitations/hash.ts ("use server" modul
// sme izvažati samo async akcije — defekt sicer 500-ira /workspaces/manage).
// ------------------------------------------------------------

// ------------------------------------------------------------
// ŽIVLJENJSKI CIKEL
// ------------------------------------------------------------

/** Ustvari nov workspace za prijavljenega uporabnika (postane lastnik/ADMIN). */
export async function createWorkspace(input: {
  name: string
  slug: string
  vertical?: string | null
  palette?: string
}): Promise<{ success: boolean; organizationId?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Prijavite se." }

  const name = (input.name ?? "").trim()
  if (name.length < 2) {
    return { success: false, error: "Ime podjetja mora imeti vsaj 2 znaka." }
  }

  const slug = slugify(input.slug ?? "")
  if (!slug || slug.length < 2) {
    return {
      success: false,
      error: "Vnesite veljaven URL naslov (vsaj 2 znaka).",
    }
  }
  if (isReservedSlug(slug)) {
    return {
      success: false,
      error: "Ta URL naslov je rezerviran. Izberite drugega.",
    }
  }
  if (!(await isSlugAvailable(slug))) {
    return {
      success: false,
      error: "Ta URL naslov je že zaseden. Izberite drugega.",
    }
  }

  const vertical = input.vertical?.trim() ? input.vertical : GENERIC_PROFILE_ID
  const profile = listProfileOptions().find((p) => p.id === vertical)
  if (!profile) return { success: false, error: "Izberite veljavno dejavnost." }

  const palette =
    input.palette && PALETTES[input.palette] ? input.palette : "rose"

  if (
    !session.user.name &&
    !(await prisma.user.findUnique({ where: { id: session.user.id } }))
  ) {
    return { success: false, error: "Račun ni na voljo." }
  }

  try {
    const org = await prisma.organization.create({
      data: {
        slug,
        name,
        vertical,
        palette,
        status: "ACTIVE",
        publishState: "DRAFT",
        verticalChosenAt: new Date(),
        members: {
          create: { userId: session.user.id, role: "ADMIN", isDefault: true },
        },
      },
    })
    // Legacy kazalec + seja gresta na novi workspace (kot createSalonOrganization).
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: "ADMIN", organizationId: org.id },
    })
    await unstable_update({
      user: { role: "ADMIN" as const, organizationId: org.id } as never,
    })
    revalidatePath("/workspaces")
    revalidatePath("/", "layout")
    return { success: true, organizationId: org.id }
  } catch (error) {
    console.error("createWorkspace error:", error)
    return { success: false, error: "Podjetja ni bilo mogoče ustvariti." }
  }
}

/** Uredi osnovne podatke workspacea (ime, logo). Slug/vertical brani: slug spremembe so rizične, vertical prek settings. */
export async function updateWorkspace(input: {
  organizationId: string
  name?: string
  logo?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Prijavite se." }
  const { role, orgStatus } = await membershipWithStatus(input.organizationId)
  if (role !== "ADMIN")
    return { success: false, error: "Le skrbnik lahko ureja poslovni prostor." }
  // F2.2.1: arhiviran workspace je samo za branje — urejanje ni dovoljeno.
  if (orgStatus !== "ACTIVE")
    return {
      success: false,
      error: "Arhiviranega poslovnega prostora ne morete urejati.",
    }

  if (input.name !== undefined) {
    const name = (input.name ?? "").trim()
    if (name.length < 2)
      return { success: false, error: "Ime mora imeti vsaj 2 znaka." }
  }
  if (
    input.logo !== undefined &&
    input.logo !== null &&
    input.logo.length > 4000
  ) {
    return { success: false, error: "Naslov logotipa je predolg." }
  }

  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.logo !== undefined ? { logo: input.logo } : {}),
    },
  })
  revalidatePath("/workspaces")
  return { success: true }
}

/** Arhivira (deaktivira) workspace — ADMIN svojega workspacea. Samo iz ACTIVE. */
export async function archiveWorkspace(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const { role, orgStatus } = await membershipWithStatus(organizationId)
  if (role !== "ADMIN")
    return {
      success: false,
      error: "Le skrbnik lahko arhivira poslovni prostor.",
    }
  if (orgStatus !== "ACTIVE")
    return {
      success: false,
      error: "Le aktiven poslovni prostor lahko arhivirate.",
    }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: "SUSPENDED" },
  })
  revalidatePath("/workspaces")
  revalidatePath("/", "layout")
  return { success: true }
}

/** Ponovno aktivira arhivirani workspace — ADMIN (F2.2.1). Samo iz SUSPENDED. */
export async function activateWorkspace(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const { role, orgStatus } = await membershipWithStatus(organizationId)
  if (role !== "ADMIN")
    return { success: false, error: "Le skrbnik lahko vodi poslovni prostor." }
  if (orgStatus !== "SUSPENDED")
    return {
      success: false,
      error: "Le arhiviran poslovni prostor lahko aktivirate.",
    }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: "ACTIVE" },
  })
  revalidatePath("/workspaces")
  revalidatePath("/", "layout")
  return { success: true }
}

/**
 * Varno brisanje workspacea (F2.2.1).
 *
 * Doovoli TRD izbris samo, če so izpolnjeni VSI pogoji:
 *  1. klicatelj je ADMIN tega workspacea;
 *  2. NI poslovnih podatkov (termini, naročila, storitve, izdelki, stranke,
 *     obrazci, delovna naročila, vnaprej plačana vrednost, dokumenti);
 *  3. ni drugih članov razen klicatelja (lastnik) — ne odstranjujemo tuje
 *     dostope brez objave;
 *  4. klicatelj je PODAL izrecno potrditev (`confirm: true`).
 *
 * Če poslovni podatki obstajajo → zavrnjeno (namig: arhiviraj).
 * Izbris organizacije v transakciji: lastnikovo članstvo in povabila se
 * odstranijo prek `onDelete: Cascade` na `Organization`, vendar se
 * UPORABNIŠKI RAČUN ne izbriše (relacije User-ja so SetNull).
 */
export async function deleteWorkspace(input: {
  organizationId: string
  confirm: boolean
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Prijavite se." }
  const { role, orgStatus } = await membershipWithStatus(input.organizationId)
  if (role !== "ADMIN")
    return {
      success: false,
      error: "Le skrbnik lahko izbriše poslovni prostor.",
    }
  if (!input.confirm) {
    return { success: false, error: "Izbris mora biti izrecno potrjen." }
  }
  // F2.2.1: arhiviran workspace je samo za branje — aktiviraj pred brisanjem.
  if (orgStatus !== "ACTIVE")
    return {
      success: false,
      error:
        "Arhiviranega poslovnega prostora ne morete izbrisati — aktivirajte ga pred brisanjem.",
    }

  // Poslovni podatki (hard gate — brisanje jih ne sme poškodovati).
  const counts = await prisma.$transaction([
    prisma.appointment.count({
      where: { organizationId: input.organizationId },
    }),
    prisma.order.count({ where: { organizationId: input.organizationId } }),
    prisma.service.count({ where: { organizationId: input.organizationId } }),
    prisma.product.count({ where: { organizationId: input.organizationId } }),
    prisma.customer.count({ where: { organizationId: input.organizationId } }),
    prisma.formSubmission.count({
      where: { organizationId: input.organizationId },
    }),
    prisma.workOrder.count({ where: { organizationId: input.organizationId } }),
    prisma.prepaidPurchase.count({
      where: { organizationId: input.organizationId },
    }),
    prisma.document.count({ where: { organizationId: input.organizationId } }),
  ])
  if (counts.some((n) => n > 0)) {
    return {
      success: false,
      error:
        "Poslovni prostor vsebuje poslovne podatke — trdo brisanje je blokirano. Arhivirajte ga namesto tega.",
    }
  }

  // Ostali člani (razen klicatelja) — preprečimo tiho odstranitev njihovega dostopa.
  const otherMembers = await prisma.organizationMember.count({
    where: {
      organizationId: input.organizationId,
      userId: { not: session.user.id },
    },
  })
  if (otherMembers > 0) {
    return {
      success: false,
      error:
        "V poslovnem prostoru so še drugi člani. Odstranite jih ali arhivirajte prostor.",
    }
  }

  // Potrjena ugotovitev: edini član + lastnik + ni poslovnih podatkov.
  // Izbris organizacije kaskadno odstrani lastnikovo OrganizationMember
  // vrstico in povabila; UPORABNIŠKI RAČUN ostane nedotaknjen (SetNull).
  await prisma.$transaction([
    prisma.organizationInvitation.deleteMany({
      where: { organizationId: input.organizationId },
    }),
    prisma.organization.delete({ where: { id: input.organizationId } }),
  ])
  revalidatePath("/workspaces")
  revalidatePath("/", "layout")
  return { success: true }
}

// ------------------------------------------------------------
// ČLANI
// ------------------------------------------------------------

/** Člani workspacea (org-scoped). Zahteva članstvo v tem workspaceu. */
export async function listWorkspaceMembers(
  organizationId: string
): Promise<WorkspaceMember[] | { error: string }> {
  const role = await memberRoleIn(organizationId)
  if (!role) return { error: "Ni tvoj workspace." }
  const session = await auth()
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  return members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    isDefault: m.isDefault,
    isSelf: m.userId === session?.user?.id,
    createdAt: m.createdAt,
  }))
}

/** Spremeni vlogo člana v workspaceu. Skrbnik; zadnji ADMIN ne more biti degradiran. */
export async function updateMemberRole(input: {
  organizationId: string
  userId: string
  role: "ADMIN" | "STAFF"
}): Promise<{ success: boolean; error?: string }> {
  const actorRole = await memberRoleIn(input.organizationId)
  if (actorRole !== "ADMIN")
    return { success: false, error: "Le skrbnik lahko menja vloge." }

  const target = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  })
  if (!target)
    return {
      success: false,
      error: "Uporabnik ni član tega poslovnega prostora.",
    }

  if (target.role !== "ADMIN" && input.role === "STAFF") {
    // običajen prehod, dovoljen
  }
  // Zaščita zadnjega ADMIN: ne degradiraj ADMIN na STAFF, če je to edini ADMIN.
  if (target.role === "ADMIN" && input.role === "STAFF") {
    const adminCount = await prisma.organizationMember.count({
      where: { organizationId: input.organizationId, role: "ADMIN" },
    })
    if (adminCount <= 1) {
      return {
        success: false,
        error: "V poslovnem prostoru mora ostati vsaj en skrbnik.",
      }
    }
  }

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    data: { role: input.role },
  })
  revalidatePath("/workspaces")
  return { success: true }
}

/** Odstrani člana iz workspacea. Skrbnik; samega zadnjega ADMIN se ne da odstraniti. */
export async function removeMember(input: {
  organizationId: string
  userId: string
}): Promise<{ success: boolean; error?: string }> {
  const actorRole = await memberRoleIn(input.organizationId)
  if (actorRole !== "ADMIN")
    return { success: false, error: "Le skrbnik lahko odstrani člane." }

  const target = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  })
  if (!target)
    return {
      success: false,
      error: "Uporabnik ni član tega poslovnega prostora.",
    }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.organizationMember.count({
      where: { organizationId: input.organizationId, role: "ADMIN" },
    })
    if (adminCount <= 1)
      return {
        success: false,
        error: "Poslovni prostor ne more ostati brez skrbnika.",
      }
  }

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  })
  revalidatePath("/workspaces")
  return { success: true }
}

// ------------------------------------------------------------
// POVABILA
// ------------------------------------------------------------

/** Pošlji povabilo v workspace. Skrbnik (staff.manage / ADMIN). */
export async function inviteMember(input: {
  organizationId: string
  email: string
  role: "ADMIN" | "STAFF"
}): Promise<{ success: boolean; error?: string; token?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Prijavite se." }
  const { role, orgStatus } = await membershipWithStatus(input.organizationId)
  if (role !== "ADMIN")
    return { success: false, error: "Le skrbnik lahko pošlje povabila." }
  // F2.2.1: arhiviran workspace je samo za branje — nova povabila niso dovoljena.
  if (orgStatus !== "ACTIVE") {
    return {
      success: false,
      error: "Arhiviranemu poslovnemu prostoru ne morete poslati povabila.",
    }
  }
  if (!(await userHasPermission(session.user.id, "staff.manage", input.organizationId))) {
    return { success: false, error: "Nimate dovoljenja za povabila." }
  }

  const email = (input.email ?? "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Vnesite veljaven e-poštni naslov." }
  }
  if (input.role !== "ADMIN" && input.role !== "STAFF") {
    return { success: false, error: "Neveljavna vloga." }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) {
    const already = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: existingUser.id,
        },
      },
    })
    if (already)
      return {
        success: false,
        error: "Ta uporabnik je že član tega poslovnega prostora.",
      }
  }

  const existingInvite = await prisma.organizationInvitation.findUnique({
    where: { organizationId_email: { organizationId: input.organizationId, email } },
  })
  if (existingInvite && existingInvite.status === "PENDING") {
    return {
      success: false,
      error: "Povabilo za ta e-poštni naslov je že v pripravi.",
    }
  }

  const token = generateIntakeToken()
  const tokenHash = hashInvitationToken(token)
  await prisma.organizationInvitation.upsert({
    where: { organizationId_email: { organizationId: input.organizationId, email } },
    create: {
      organizationId: input.organizationId,
      email,
      role: input.role,
      token: tokenHash,
      invitedById: session.user.id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dni
    },
    update: {
      token: tokenHash,
      role: input.role,
      status: "PENDING",
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    },
  })
  revalidatePath("/workspaces")
  return { success: true, token }
}

/** Javni sprejem povabila po žetonu (prejemnik; račun mora ustrezati e-pošti povabila).
 *  F2.2.1: token se hashira (SHA-256) in poišče po hashu; sprejem je ATOMSKO enkraten —
 *  konkurenčna zahteva, ki poskuša sprejeti isto povabilo, izgubi (updateMany s PENDING filterjem). */
export async function acceptInvitation(
  token: string
): Promise<{ success: boolean; organizationId?: string; error?: string }> {
  const tokenHash = hashInvitationToken(token)
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: tokenHash },
    include: {
      organization: { select: { id: true, name: true, status: true } },
    },
  })
  if (!invitation || invitation.status !== "PENDING") {
    return {
      success: false,
      error: "Povabilo ni veljavno ali je bilo že uporabljeno.",
    }
  }
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return { success: false, error: "Povabilo je poteklo." }
  }
  if (invitation.organization.status !== "ACTIVE") {
    return { success: false, error: "Poslovni prostor ni aktiven." }
  }

  const session = await auth()
  if (!session?.user?.email)
    return { success: false, error: "Prijavite se z računom povabljenega." }
  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return {
      success: false,
      error: "Povabilo je namenjeno drugemu e-poštnemu naslovu.",
    }
  }

  // Atomski enkratni sprejem: povečaj članstvo in preklopi status SAMO če je
  // še PENDING. V transakciji postane samo ena konkurenčna zahteva zmagovalec.
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.organizationInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    })
    if (claimed.count === 0) {
      // Nekdo je sprejel/preklical vzporedno.
      return { claimed: false }
    }
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
        },
      },
      create: {
        organizationId: invitation.organizationId,
        userId: session.user.id,
        role: invitation.role,
      },
      update: { role: invitation.role },
    })
    return { claimed: true }
  })

  if (!result.claimed) {
    return {
      success: false,
      error: "Povabilo je bilo že uporabljeno ali preklicano.",
    }
  }
  revalidatePath("/workspaces")
  return { success: true, organizationId: invitation.organizationId }
}

/**
 * Prejemnik zavrne povabilo (ali pa lastnik prekliče).
 *
 * P2 (audit 2026-11): prej je zadoščalo POZNAVANJE ŽETONA — brez seje in brez
 * preverbe, kdo kliče. Zdaj mora biti klicatelj prijavljen IN bodisi
 * povabljeni (isti e-naslov) bodisi skrbnik organizacije, ki je povabilo
 * poslala.
 */
export async function revokeInvitation(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Prijavite se za preklic povabila." }
  }

  const tokenHash = hashInvitationToken(token)
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: tokenHash },
    select: { id: true, status: true, email: true, organizationId: true },
  })
  if (!invitation || invitation.status !== "PENDING") {
    return { success: false, error: "Povabilo ni več v pripravi." }
  }

  const isInvitee =
    !!session.user.email &&
    session.user.email.toLowerCase() === invitation.email.toLowerCase()
  if (!isInvitee) {
    const role = await memberRoleIn(invitation.organizationId)
    if (role !== "ADMIN") {
      return {
        success: false,
        error: "Povabilo lahko prekliče le prejemnik ali skrbnik prostora.",
      }
    }
  }
  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  })
  revalidatePath("/workspaces")
  return { success: true }
}

/** Seznam povabil workspacea (za lastnika/skrbnike). */
export async function listInvitations(
  organizationId: string
): Promise<
  | { email: string; role: string; status: string; createdAt: Date }[]
  | { error: string }
> {
  const role = await memberRoleIn(organizationId)
  if (role !== "ADMIN") return { error: "Le skrbnik vidi povabila." }
  const invites = await prisma.organizationInvitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { email: true, role: true, status: true, createdAt: true },
  })
  return invites
}

// ------------------------------------------------------------
// PRIVZETI WORKSPACE
// ------------------------------------------------------------

/** Uporabnik nastavi privzeti workspace (isDefault = njegova izbira; ne menja ga preklop). */
export async function setDefaultWorkspace(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Prijavite se." }
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: session.user.id },
    },
    include: { organization: { select: { status: true } } },
  })
  if (!membership) return { success: false, error: "Ni tvoj workspace." }
  if (membership.organization.status !== "ACTIVE")
    return { success: false, error: "Poslovni prostor ni aktiven." }

  await prisma.$transaction([
    prisma.organizationMember.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId: session.user.id },
      },
      data: { isDefault: true },
    }),
  ])
  revalidatePath("/workspaces")
  return { success: true }
}

// ------------------------------------------------------------
// HELPERJI (org-scoped, fail-closed)
// ------------------------------------------------------------

/**
 * Vloga + status workspacea (F2.2.1). Vrne `{ role, orgStatus }`.
 * `orgStatus` je "ACTIVE" | "SUSPENDED" ali null (ni član).
 * Poslovne spremembe (povabila, privzeti prostor, arhiviranje/aktiviranje
 * z notranjo logiko) zahtevajo ACTIVE; upravljanje članov in last-ADMIN
 * zaščita ostajata dovoljena tudi v SUSPENDED (čiščenje pred izbrisom).
 */
async function membershipWithStatus(
  organizationId: string
): Promise<{ role: string | null; orgStatus: "ACTIVE" | "SUSPENDED" | null }> {
  const session = await auth()
  if (!session?.user?.id) return { role: null, orgStatus: null }
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: session.user.id },
    },
    select: { role: true, organization: { select: { status: true } } },
  })
  if (!member) return { role: null, orgStatus: null }
  const orgStatus = member.organization.status as "ACTIVE" | "SUSPENDED"
  return { role: member.role, orgStatus }
}

/** Vloga prijavljenega uporabnika v workspaceu ali null. Ne razkrije obstoja tuje org. */
export async function memberRoleIn(
  organizationId: string
): Promise<string | null> {
  const { role } = await membershipWithStatus(organizationId)
  return role
}

/** Osnovna tabela workspace-ov na računu (za "Moja podjetja" zaslon). */
export async function listMyWorkspaces(): Promise<WorkspaceBasic[]> {
  const session = await auth()
  if (!session?.user?.id) return []
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          vertical: true,
          status: true,
        },
      },
    },
  })
  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    logo: m.organization.logo,
    vertical: m.organization.vertical,
    verticalLabel:
      listProfileOptions().find((p) => p.id === m.organization.vertical)
        ?.label ?? null,
    status: m.organization.status,
    role: m.role,
    isDefault: m.isDefault,
  }))
}
