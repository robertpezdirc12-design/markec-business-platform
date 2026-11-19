import { prisma } from "@/lib/prisma"

// Razreši `login` vnos (e-poštni naslov ALI uporabniško ime) na e-poštni
// naslov uporabnika. Deljen med NextAuth authorize in server actions, da se
// semantika prijave (email ali username) nikoli ne razide.
//
// Poišče username neobčutljivo na velikost črk (username se shranjuje
// lowercase, vendar toleriramo vnos z veliko začetnico). Vrne prazen string,
// če uporabnik ne obstaja — pozivalec mora obravnavati enako kot neveljavno
// geslo (ne razkrije obstoja username-a oz. e-pošte).
export async function resolveLoginToEmail(login: string): Promise<string> {
  const raw = login.trim()
  if (!raw) return ""
  const isEmail = raw.includes("@")
  if (isEmail) return raw.toLowerCase()
  const user = await prisma.user.findUnique({
    where: { username: raw.toLowerCase() },
  })
  return user?.email ?? ""
}

// Normalizira uporabniško ime za shranjevanje (lowercase + trim) ali vrne
// null za prazen vnos. Uporablja registerUser / wizard, da se username vedno
// shrani v kanonični obliki, ki jo authorize išče.
export function normalizeUsername(username: string | undefined | null): string | null {
  const v = username?.trim().toLowerCase()
  return v ? v : null
}