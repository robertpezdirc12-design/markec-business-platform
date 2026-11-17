import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { getServerI18n } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Pogoji uporabe",
  description:
    "Pogoji rezervacij, naročil, plačil, odpovedi in odgovornosti na platformi MARKEC — za vse dejavnosti.",
  alternates: { canonical: "/terms" },
}

export default async function TermsPage() {
  const { t } = await getServerI18n()
  return (
    <LegalPage
      title="Pogoji uporabe"
      updated="15. november 2026"
      backLabel={t.public.backToHome}
      updatedLabel={t.public.lastUpdated}
      sections={[
        {
          heading: "Splošno",
          body: [
            "Platforma MARKEC omogoča podjetjem vseh dejavnosti (storitve, obrt, trgovina) spletno predstavitev, rezervacije, povpraševanja in prodajo izdelkov. Ti pogoji urejajo uporabo platforme s strani obiskovalcev in strank.",
            "Za vsebino, storitve, cene in izvedbo odgovarja posamezno podjetje (ponudnik), katerega stran obiščete. Platforma zagotavlja tehnično delovanje in posredovanje.",
          ],
        },
        {
          heading: "Rezervacije in povpraševanja",
          body: [
            "Rezervacijo ali povpraševanje oddate prek spletne strani ponudnika. Rezervacija je veljavna, ko jo ponudnik potrdi z e-pošto. Za nekatere storitve ponudnik lahko zahteva polog ali predplačilo — znesek in pogoji so razvidni pred oddajo.",
            "Pri povpraševanjih (npr. izdelava po meri, servis) ponudnik odgovori s ponudbo, rokom in ceno. Povpraševanje ni zavezujoče naročilo.",
            "Če ponudnik nima omogočenih spletnih plačil, znesek poravnate neposredno pri ponudniku.",
          ],
        },
        {
          heading: "Odpoved in sprememba",
          body: [
            "Rezervacijo lahko odpovete ali prestavite prek svojega računa, povezave v potrditveni e-pošti ali neposredno pri ponudniku. Priporočamo odpoved vsaj 24 ur vnaprej.",
            "V primeru neodpovedanega termina ali neprevzema naročila lahko ponudnik zahteva nadomestilo po svojih pravilih, ki so razvidna ob rezervaciji oziroma v ponudbi.",
          ],
        },
        {
          heading: "Nakupi in plačila",
          body: [
            "Nakup izdelkov poteka prek spletne trgovine ponudnika. Cene so v EUR in vključujejo DDV, razen če ni navedeno drugače. Cene določa ponudnik in se lahko spremenijo; za vas velja cena v trenutku oddaje naročila.",
            "Plačila potekajo prek varnega plačilnega sistema (Stripe). Občutljivi podatki kartice se ne shranjujejo na platformi.",
          ],
        },
        {
          heading: "Odgovornost",
          body: [
            "Za kakovost, izvedbo storitev, dobavo izdelkov in skladnost z zakonodajo odgovarja ponudnik. Platforma posreduje rezervacije, naročila in povpraševanja ter omogoča tehnično delovanje.",
            "Za vsebino, ki jo objavi ponudnik (opisi, slike, cene, delovni čas), odgovarja ponudnik.",
          ],
        },
        {
          heading: "Pravno obvestilo",
          body: [
            "Upravljavec platforme: MARKEC — Poslovna platforma. Za pravno osebo upravljavca in kontakt za uveljavljanje pravic glejte stran Politika zasebnosti ali kontaktni obrazec na platformi.",
            "Ti pogoji se lahko spremenijo. O bistvenih spremembah obvestimo uporabnike prek platforme ali e-pošte.",
            "Za spore je pristojno sodišče v Republiki Sloveniji. Uporablja se slovensko pravo.",
          ],
        },
      ]}
    />
  )
}
