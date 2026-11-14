// ============================================================
// F5.5.2.2 — VIZUALNA KONTROLA: seed bogatega nabora za galerije/FAQ
// na ločeni bazi markec_f552_test. NE spreminja funkcionalne kode.
//
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f552_test?schema=public
//   node scripts/f552-visual-seed.cjs
//
// Varnostna zapora: zavrne, če ne kaže natanko na markec_f552_test.
// ============================================================

const { PrismaClient } = require("@prisma/client")

const url = process.env.DATABASE_URL || ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f552_test(\?|$)/.test(url)
if (!safe) {
  console.error("REFUSED: DATABASE_URL must point to markec_f552_test.")
  process.exit(1)
}

const prisma = new PrismaClient()
const ORG = "f552-org"
const SVC = "f552-svc"
const PROD = "f552-prod"

const IMG = {
  cut: [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80",
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&q=80",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&q=80",
  ],
  care: [
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80",
    "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900&q=80",
  ],
  draft: ["https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=900&q=80"],
}

async function clean() {
  await prisma.galleryItem.deleteMany({ where: { gallery: { organizationId: ORG } } })
  await prisma.gallery.deleteMany({ where: { organizationId: ORG } })
  await prisma.faqItem.deleteMany({ where: { organizationId: ORG } })
}

async function makeGallery({ title, description, isPublic, isPublished, position, cover, link = {}, items }) {
  const g = await prisma.gallery.create({
    data: {
      organizationId: ORG,
      title,
      description,
      isPublic,
      isPublished,
      position,
      coverImageId: cover ?? null,
      linkedServiceId: link.service ?? null,
      linkedProductId: link.product ?? null,
    },
  })
  for (let i = 0; i < items.length; i++) {
    await prisma.galleryItem.create({
      data: {
        galleryId: g.id,
        mediaId: items[i].media,
        caption: items[i].caption ?? null,
        alt: items[i].alt ?? null,
        position: i,
        isPublished: items[i].isPublished ?? true,
      },
    })
  }
  return g
}

async function seed() {
  await clean()

  // --- Galerija 1: PUBLISHED, 3 fotke, naslovna, DOLG naslov in opis, vezana na STORITEV ---
  await makeGallery({
    title:
      "Galerija pričesk — naši pristriženi in pobarvani stili za vse dolžine, teksture in potrebe strank v našem salonu",
    description:
      "Kratek pregled frizerskega dela: od klasičnih pristriženih moških frizur prek elegantnih ženskih valov do drznejših barvnih transformacij. Fotografije pred in po posegu, z vsemi teksturami in dolžinami las.",
    isPublic: true, isPublished: true, position: 0,
    cover: IMG.cut[0],
    link: { service: SVC },
    items: [
      { media: IMG.cut[0], caption: "Naslovna — rezultat striženja in barvanja", alt: "Pristrižena in pobarvana pričeska, naslovna fotografija" },
      { media: IMG.cut[1], caption: "Eleganten ženski val", alt: "Ženske valovi po oblikovanju" },
      { media: IMG.cut[2], caption: "Moderno moško striženje z podobo", alt: "Moško striženje s podobo" },
    ],
  })

  // --- Galerija 2: PUBLISHED, 2 fotki, vezana na IZDELEK ---
  await makeGallery({
    title: "Nega in tretmaji",
    description: "Tretmaji za nego las in lasišča s premium izdelki, ki jih pri nas tudi kupite.",
    isPublic: true, isPublished: true, position: 1,
    cover: IMG.care[0],
    link: { product: PROD },
    items: [
      { media: IMG.care[0], caption: "Umirjajoči tretma za lasišče", alt: "Tretma za lasišče" },
      { media: IMG.care[1], caption: "Nega in styling po umivanju", alt: "Styling las" },
    ],
  })

  // --- Galerija 3: DRAFT (NEobjavljena) — javna stran tega NE sme razkriti ---
  await makeGallery({
    title: "Osnutek — novo delo za praznike",
    description: "Še nedokončano; na javni strani se ne sme prikazati.",
    isPublic: true, isPublished: false, position: 2,
    cover: IMG.draft[0],
    items: [
      { media: IMG.draft[0], caption: "Praznični stil (osnutek)", alt: "Praznični stil, neobjavljeno", isPublished: false },
    ],
  })

  // --- FAQ: objavljeni (podjetje + storitev) in DRAFT neobjavljeni ---
  await prisma.faqItem.createMany({
    data: [
      {
        organizationId: ORG,
        question: "Kako naj se pripravim na termin?",
        answer:
          "Pred terminom si lasje umijte in posušite, brez lakov in gelov. Povejte nam, če imate občutljivo lasišče ali alergije. Pridite 5 minut prej.",
        category: "Priprava", position: 0,
        isPublic: true, isPublished: true, serviceId: SVC, // FAQ za storitev
      },
      {
        organizationId: ORG,
        question:
          "Kolikokrat na leto si naj pustim pristriči ali pobarvati lase, da ohranim obliko in barvo svežo?",
        answer:
          "Vsak 4–6 tednov za ohranjanje oblike in barve. Ocenimo glede na stanje las in hitrost rasti ter predlagamo razpored nege.",
        category: "Nasveti", position: 1,
        isPublic: true, isPublished: true, serviceId: null,
      },
      {
        organizationId: ORG,
        question: "Ali lahko rezervirano termin kadarkoli spremenim ali prekličem?",
        answer: "Da. Termin prestavite ali odpoveste do 24 ur pred terminom iz svoje plošče ali po e-pošti.",
        category: "Naročanje", position: 2,
        isPublic: true, isPublished: true, serviceId: null,
      },
      {
        organizationId: ORG,
        question: "Osnutek: ali nudite tudi barvanje brez amoniaka?",
        answer: "NEJAVA — še osnutek, ne sme biti javno vidno.",
        category: "Osnutki", position: 3,
        isPublic: true, isPublished: false, // DRAFT FAQ
        serviceId: null,
      },
    ],
  })

  console.log("Visual dataset seeded for", ORG)
  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})