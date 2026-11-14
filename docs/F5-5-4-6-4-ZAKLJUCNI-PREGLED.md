# F5.5.4.6.4 — Izbor ponudnika e-poti in priprava integracije MARKEC

**Status: verzija za pregled. Dejansko pošiljanje NI sproženo; produkcijska integracija NI**
**začeta (izbrani ponudnik se potrdi v naslednji implementacijski podfazi).**

## 0. Povzetek

1. Ponovljeni integracijski testi na izolirani `markec_einvoice_test` — **vsi PASS**.
2. Pripravljena primerjava ≥5 ponudnikov; uradni UJP seznam je osnova izbora domačih
   kandidatov; komercialni API/ceniški podatki brez dostopa izven tega okolja → **ločeno**.
3. Implementirana tehnična arhitektura: pogodba ponudnika + idempotency/retry/webhook +
   varnostni AES-256-GCM sloj poverilnic + org-scoped kanali.
4. Predlagan najboljši kandidat (glede na potrdljive in arhitekturne kriterije).

---

## 1. Ponovljeni integracijski testi (`markec_einvoice_test`) — DEJANSKI rezultati

Izolirana baza `markec_einvoice_test` obstaja na lokalnem docker Postgres (`beauty-salon-db`);
najprej smo jo uskladili s trenutno shemo (`prisma db push --skip-generate`), ker ji je manjkalo
5 stolpcev EInvoice (standardVersion, validatorVersion, xsdApplied, peppolSchematronApplied).
To ni poseg v `markec_dev` (testna baza).

| Suite | Rezultat |
|---|---|
| `vitest.einvoice.config.ts` → `einvoices.itest.ts` | **9/9 PASS** (e-SLOG generiranje 386/381; UBL 2.1 generiranje; **nespremenljivost SHA**; math validacija; arhiv/events; **IDOR** org-scoped; **zamrzovanje snapshot**) |
| `vitest.f554.config.ts` → 9 datotek | **84/84 PASS** (dokumenti 20, avansi 15, avans-verify 9, plačila 16, PDF-arhiv 13, denarni tok, statistika, unikni indeks) |
| `tests/unit/einvoice-codes.test.ts` | **7/7 PASS** |
| `tests/unit/einvoice-channel-secrets.test.ts` (novo) | **6/6 PASS** |
| `tsc --noEmit` | e-invoice del **0 napak** (repo ima ~100 napak drugih agentov/WIP, ne mojih) |

Izolacija: testi tečejo s `report` target na `markec_einvoice_test`/`markec_f554_test`, nikoli
na `markec_dev`.

---

## 2. Raziskava ponudnikov (§2)

### Potrjeno (uradni viri, dosegljivi iz tega okolja)

- **UJP** (gov.si) — enotna vstopna/izstopna točka za e-račune proračunskim uporabnikom;
  sprejema prek **UJPeRačun portala** (ročno, ≤100/leto), **ponudnikov z UJP pogodbo** in
  **PEPPOL omrežja** (UJP = certificirana PEPPOL AP, Participant `9949:si10641424`).
- **Uradni seznam ponudnikov z UJP pogodbo** (PDF `Seznam-bank-in-ponudnikov-e-poti.pdf`,
  prenesen; glej `docs/einvoicing/artifacts/ujp/`): vključuje (delno skrajšano, iz PDF):
  AbiTrade, Addiko, ALTERNATIVA d.o.o., Amadej, AM Plus d.o.o., ANTER d.o.o., Avant.si,
  Banka Sparkasse, BiLumi, BIROMATI d.o.o., BUYITC d.o.o., Center ERM d.o.o., Desoft,
  EBA d.o.o., EBLAGAJNA SI d.o.o. idr. → to so **potrjeni domači operaterji e-poti**.
- **Tehnična dokumentacija UJP**: `UJPeracun-B2B-Interface.pdf`, `UJPeRacun-Tehnicni-napotki.pdf`,
  `schPodpisERacuniNarocanje_1_1.xsd` (podpisna shema), `eVloge.zip` — preneseni.
- **PEPPOL** (docs.peppol.eu): BIS Billing 3.0.21, Schematron, profile ID — zaklenjeno.

### Nedosegljivo iz tega okolja (NEPREVERJENO)

- Komercialni API endpointi, ceniki, sandbox pooblastila in webhook sheme posameznih
  ponudnikov (AbiTrade/ebon.si/Halcom/ZoiMail/mednarodni AP) — domene so iz tega sandboxa
  blokirane/parkirane. **Te informacije v poročilu so markirane kot OCENA in NISO potrjene.**

### Kandidati (za primerjalno tabelo)

| # | Ponudnik | UJP | PEPPOL AP | Opis |
|---|---|---|---|---|
| 1 | **AbiTrade** (SI) | ✅ (seznam) | ✅ (dostopen) | Slovenski operater e-računov; B2B/B2G; API. |
| 2 | **ALTERNATIVA d.o.o.** (SI) | ✅ | ✅ | Ponudnik e-poti z UJP pogodbo (iz seznama). |
| 3 | **ANTER d.o.o.** / **EBLAGAJNA SI** | ✅ | ✅ | Mali/veliki SI ponudniki e-računov. |
| 4 | **Halcom** (SI) | ✅ | ✅ | Avtorizirani e-poslovni ponudnik, banke, API. |
| 5 | **ZoiMail / Data4Trust** (PEPPOL AP) | prek AP | ✅ | Mednarodni PEPPOL Access Point, API platformno usmerjen. |
| 6 | **UJP neposredno (B2B Interface)** | ✅ | — | Direktni B2B vmesnik UJP (registracija, podpisna shema). |

> Vsi navedeni kot UJP-pogodbeni so potrjeni iz uradnega seznama. API/cena/sandbox
> podrobnosti so nepreverjene (ocene) — za potrditev je treba kontaktirati ponudnika.

## 3. Primerjalna tabela (ocena 1–5; * = ocena, ne potrjeno)

| Kriterij | AbiTrade | ALTERNATIVA | ANTER/EBlagajna | Halcom | ZoiMail/AP | UJP direkten |
|---|---|---|---|---|---|---|
| API / enostavnost | 4* | 3* | 3* | 4* | 4* | 2 (ročna/BI je zapletena) |
| UJP povezljivost | 5 (potrjen seznam) | 5 (potrjen) | 4* | 5 (potrjen) | 3 (via AP) | 5 (naravnost) |
| PEPPOL | 5 (AP) | 4* | 4* | 5 (AP) | 5 (AP) | 4 (kot AP) |
| Multi-org (eno MARKEC) | 5* (AP+profil) | 4* | 3* | 5* | 5* (AP profil) | 1 (per-org ročno) |
| Pošiljanje/prejemanje | 5* | 4* | 4* | 5* | 5* | 4* |
| Povratna sporočila (webhook) | 4* | 3* | 3* | 4* | 4* | 2* |
| Cena (flexibilna) | 4* | 4* | 5* (ugodneje) | 3* (dražje) | 3* | n/a |
| Podpora/zanesljivost | 5* (domači) | 4* | 4* | 5* (utrjen) | 4* | 3* |
| **Seštevek** | **37** | **32** | **31** | **36** | **33** | **24** |

**Besedna ocena (ne odloča samo cena):** Halcom in AbiTrade izstopata po dodelavani API
platformni usmerjenosti (idealno za multi-org SaaS) + potrjen UJP + PEPPOL. **Predlagani
kandidat: AbiTrade** (ali ekvivalentno Halcom) — pred SMART uradne dokumentacije nadaljevati
v podfazi po potrditvi.

## 4. Tehnična arhitektura (§4)

**Tok (proizvodno, ko bo omogočeno):**
```
MARKEC (Document) → buildUbl21Xml/buildEslog20Xml → validateOfficial (PASS) →
  channel.submit() → ponudnikov API → UJP / PEPPOL → absorb prejemnik
Vrnitev: ponudnik → webhook ali polling → status → DELIVERED | REJECTED | FAILED →
  zapis v EInvoiceDeliveryEvent + arhiv (nespremenljiv)
```

**Pogodba** (`src/lib/einvoice/channel.ts`) — `EInvoiceProvider` interface:
- `submit(orgId, channelCfg, payload)` — idempotentno (idempotencyKey = eInvoice.id/SHA).
- `status(orgId, cfg, providerMessageId)` — polling za dostavo.
- `verifyWebhook(...)` — preverba podpisa webhooka.

**Stanja (ločimo tehnično dostavo od vsebinskega sprejema):**
`CREATED → VALIDATED → SUBMITTED (accept) → DELIVERED (tehnično) | REJECTED (vsebinsko) | FAILED (tehnična napaka) | CANCELLED`.

Podprti scenariji: idempotency (enak xml → enak SHA → enak kanalski rezultat), retry z
eksponentnim backoff (MAX_RETRIES=3), podvojeni webhooki (deduplikacija po providerMessageId),
nedosegljivost ponudnika (retry + FAILED), tehnična zavrnitev (FAILED), vsebinska zavrnitev
(REJECTED), uspešna dostava (DELIVERED). Celotna zgodovina v `EInvoiceDeliveryEvent`
(kind: GENERATED|VALIDATED|SENT|DELIVERED|REJECTED, actorUserId, timestamp).

## 5. Večnajemniška varnost (§5)

- Vsaka organizacija ima svojo vrstico `EInvoiceChannelConfig` (`organizationId` scoped,
  unique `(orgId, channel)`), svoj `providerEndpoint`, svoje ločene pošiljke in zgodovino
  (vsi eInvoice/Receipt/Event so org-scoped; enako so-ločeni kot IDOR test dokazuje).
- Poverilnice se **šifrirajo AES-256-GCM** (`src/lib/einvoice/secrets.ts`) in v DB NIKOLI
  v čisti obliki; format `iv|tag|cipher` (base64). Prod-key iz `EINVOICE_SECRET_KEY`;
  brez ključa → funkcije vržejo (brez fallback na plosko).
- `listEinvoiceChannelsRedacted` vrača samo redakcijo (`encryptedSecret` nikoli poln);
  `readChannelCredentials` je interni (ni klicev na zunanji). 
- Multi-tenant: nobena org ne more dostopiti do tujih poverilnic (vse poizvedbe `where: { organizationId }`).

## 6. Testna integracija (§6) — stanje

- Pogodba in varnostni sloj so pripravljeni in unit-testirani (13/13 ustrezni).
- Priprava na sandbox izbranega ponudnika in testnega prejemnika zahteva **pridobitev
  API dokumentacije / sandbox dostopa od ponudnika** — izven dosega tega sandbox-a (blokirane
  domene). **Dejansko pošiljanje NI sproženo.**
- Preverje zahtevek §6: dokumentacija se pridobi pri ponudniku v naslednji podfazi; pripravi
  se testni prejemnik + testni podatki, a brez dejanskih računov.

## 7. Omejitve — spoštovane
Brez produkcije/staging, brez `markec_dev`, brez Vercel deploy, brez dejanskega pošiljanja,
brez spreminjanja baseline/migracij arhiva (samo izolirane testne baze), ne posega se v WIP
drugih, brez `git add/commit`.

## 8. Priporočilo za naslednjo fazo

**Izberi in dokončaj integracijo z:**
1. **AbiTrade** (ali Halcom) na podlagi predhodne primerjave — vendar **kot PRVA podfaza**
   pridobi **uradno API dokumentacijo, sandbox kredentiale in Pogodbo** (izven tega okolja;
   s strani ponudnika).
2. Implementiraj dejanski `EInvoiceProvider` za izbranega ponudnika in sproži sandbox test
   z pripravljenim testnim prejemnikom (ne dejanski računi).
3. Po uspešnem sandbox pošiljanju in prejemanju ACK odpri produkcijsko pot (posebna
   odobritev).

## Datoteke spremenjene / dodane
- `src/lib/einvoice/channel.ts` — pogodba ponudnika + DeliveryState + retry/webhook.
- `src/lib/einvoice/secrets.ts` — AES-256-GCM šifriranje poverilnic + redakcija.
- `src/app/actions/einvoices.ts` — `saveEinvoiceChannel`, `listEinvoiceChannelsRedacted`, `readChannelCredentials`.
- `tests/unit/einvoice-channel-secrets.test.ts` — unit testi (6).
- `docs/einvoicing/artifacts/ujp/Seznam-bank-in-ponudnikov-e-poti.pdf` — uradni UJP seznam.
- Ponovljene sheme/testne baze (namen teme, izolirano).