import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { getServerI18n } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Zasebnost",
  description:
    "Katere osebne podatke obdelujemo na platformi MARKEC ter kakšne so vaše pravice (GDPR).",
  alternates: { canonical: "/privacy" },
}

export default async function PrivacyPage() {
  const { t } = await getServerI18n()
  return (
    <LegalPage
      title="Politika zasebnosti"
      updated="15. november 2026"
      backLabel={t.public.backToHome}
      updatedLabel={t.public.lastUpdated}
      sections={[
        {
          heading: "Upravljavec",
          body: [
            "Upravljavec osebnih podatkov na platformi MARKEC je: MARKEC — Poslovna platforma (v nadaljevanju: upravljavec).",
            "Kontakt za uveljavljanje pravic (GDPR): prek kontaktnega obrazca na platformi ali na e-poštni naslov, naveden v nogi spletne strani.",
            "Za vsebino in storitve posameznega ponudnika (podjetja) odgovarja tisti ponudnik kot ločen upravljavec za podatke, ki jih zbira neposredno (npr. pri rezervaciji).",
          ],
        },
        {
          heading: "Katere podatke obdelujemo",
          body: [
            "Pri rezervaciji termina ali oddaji povpraševanja: ime, e-poštni naslov, telefonsko številko in neobvezne opombe (npr. posebne želje).",
            "Pri naročilu izdelkov: kontaktne podatke za dostavo in podatke o naročilu.",
            "Pri ustvarjanju računa: e-poštni naslov in geslo (shranjeno izključno kot nepovratno šifriran zapis — bcrypt).",
            "Tehnični podatki: IP-naslov, vrsta brskalnika in piškotki, potrebni za delovanje (prijava, košarica, temni način).",
          ],
        },
        {
          heading: "Namen obdelave",
          body: [
            "Podatke obdelujemo izključno za: izvedbo rezervacij in naročil, komunikacijo o statusu (potrditve, opomniki, spremembe), tehnično delovanje platforme in skladnost z zakonskimi obveznostmi (računovodstvo, davki).",
            "Ne pošiljamo reklamnega gradiva brez vašega izrecnega soglasja. Ne prodajamo vaših podatkov tretjim osebam.",
          ],
        },
        {
          heading: "Kdo dostopa do podatkov",
          body: [
            "Podatke vidijo: ponudnik (podjetje), pri katerem rezervirate/naročate (lastnik in pooblaščeni zaposleni), ter upravljavec platforme za tehnično delovanje.",
            "Zunanji obdelovalci: Stripe (plačila), Resend (e-pošta), Cloudinary (slike) — vsi v skladu z GDPR in pogodbami o obdelavi podatkov.",
          ],
        },
        {
          heading: "Vaše pravice (GDPR)",
          body: [
            "Imate pravico do: vpogleda v svoje podatke, popravka, izbrisa (»pravica do pozabe«), omejitve obdelave, prenosljivosti podatkov in ugovora obdelavi.",
            "Zahtevo za uveljavljanje pravic pošljite prek kontaktnega obrazca na platformi ali na e-poštni naslov upravljavca. Odgovorimo v 30 dneh.",
            "Imate tudi pravico do pritožbe pri Informacijskem pooblaščencu RS (www.ip-rs.si).",
          ],
        },
        {
          heading: "Hramba in varnost",
          body: [
            "Podatke hranimo, dokler so potrebni za namen obdelave ali dokler to zahteva zakonodaja (računovodski dokumenti: 10 let). Podatke o rezervacijah lahko ponudnik hrani kot zgodovino obiskov.",
            "Tehnični ukrepi: HTTPS/TLS šifriranje, bcrypt za gesla, omejen dostop do baze, varnostne kopije. Dostop do osebnih podatkov imajo le pooblaščene osebe.",
          ],
        },
      ]}
    />
  )
}
