# Official e-invoicing validation artifacts — SHA-256 manifest

Artifacts fetched into `docs/einvoicing/artifacts/`. **F5.5.4.6.3** kakovostno dopolnjena
različica: PEPPOL BIS Billing **3.0.21** (May 2026 Release) artefakti, uradni UBL 2.1 XSD,
ISO Schematron XSLT prevodniki in lokalni Java validatorji (JDK-JAXP + Saxon-HE).
Vsi artefakti so dostavljeni lokalno → validacija teče **brez zunanjega spletnega dostopa**.

## **F5.5.4.6.3.1** — preverjanje PEPPOL 3.0.22 (datum: 2026-11-11)

Naloga je poročala o objavi BIS Billing **3.0.22** (4. 11. 2026). **Uradno preverjeno:**

| Preverba | Rezultat |
|---|---|
| `docs.peppol.eu/poacc/billing/3.0/release-notes/` | zadnja verzija še vedno **3.0.21**; 3.0.22 NI v TOC/naslovih |
| `docs.peppol.eu/poacc/billing/3.0/` (Home) | "May 2026 Release" = 3.0.21 |
| `docs.peppol.eu/poacc/billing/3.0.22/` | **HTTP 404** — vir ne obstaja |
| Trenutni Schematron (živi prenos) SHA vs 3.0.21 manifest | **identična** (PEPPOL `62e5b678…`, CEN `268d4f7a…`, Envelope `96648791…`) |

**Sklep:** uradni OpenPeppol strežnik v tem okolju še vedno servira **3.0.21**; ni objavljenih
artefaktov ali release-notes za 3.0.22. **Nima tehnične upravičenosti za prehod**, zato:

> **ODLOČITEV: ostajamo na PEPPOL BIS Billing 3.0.21.** Ne menjavamo različice zaradi številke.
> Če bo 3.0.22 postala dosegljiva na uradnem viru, se ponovno preveri z enakim postopkom
> (primerjava SHA release-artefaktov + release-notes) in se nato odloči o prehodu.

Artefakti v tej datoteki so **zaklenjeni na 3.0.21**.

## PEPPOL BIS Billing 3.0.21 — uradni Schematron (May 2026 Release)

Source: `https://docs.peppol.eu/poacc/billing/3.0/` (release-notes: Version 3.0.21,
published 2026-05-20, mandatory 2026-08-17).

| File | SHA-256 |
|---|---|
| `peppol-bis3/PEPPOL-EN16931-UBL.sch` | `62e5b67892f12755352d78b06f63229a02cc2eccc748677c56efbc8dbcb336e3` |
| `peppol-bis3/CEN-EN16931-UBL.sch` | `268d4f7a2688676695e6c69cba6fba69a6802604fee12cb544a6b30ff09555a3` |
| `peppol-bis3/PeppolBIS-Envelope-Rules.sch` | `96648791fb824b6b58ddae9cc5575e8298e0061fc43dd0934a0b1459396d76f9` |
| `peppol-bis3/BIS-Billing3-Examples.zip` | `e7ec4705e8c35bc65c59f763aa8788517e07a2ed56b5805950fe0ac739bad759` |

Potrjeno v Schematron (uradno, fatal):
- `PEPPOL-EN16931-R004` — `CustomizationID` MORA biti
  `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0` (brez `::`).
- `ProfileID` `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` (Profil 01). Profil 02
  ("billing with response", dodan v 3.0.21) uporablja isto `CustomizationID`; `ProfileID`
  za 02 se loči prek Invoice Response SBDH in ni v UBL Invoice instance Schematron-u.
- `PEPPOL-EN16931-R010/R020` — obe stranki MORATA imeti `cbc:EndpointID`.
- `PEPPOL-EN16931-P0100` — InvoiceTypeCode dovoljen: `71 80 82 84 102 218 219 326 331 380 382 383 384 386 388 393 395 553 575 623 780 817 870 875 876 877` (a 326/384 le za DE, glej P0112).
- `PEPPOL-EN16931-P0112` — `326` ali `384` dovoljena **SAMO** ko sta seller in customer nemški.
- `PEPPOL-EN16931-P0101` — CreditNoteTypeCode dovoljen: `381 396 81 83 532`.

## UBL 2.1 (OASIS) — uradne sheme

Source: `https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/...`

| File | SHA-256 |
|---|---|
| xsd/maindoc/UBL-Invoice-2.1.xsd | 40FAE8CB436F3A9506D7ACCE65BA162CAEF3B0BED4D5CBC0992B2153DED4EDF4 |
| xsd/maindoc/UBL-CreditNote-2.1.xsd | A54651B1225052F811BF2BA01346F13F2454E7CC3E0BE290C91DD680DC7B7B1A |
| xsd/maindoc/UBL-ApplicationResponse-2.1.xsd | B9ADC27C538C937A54479E678D1E19B0A91BB7CE36AC0B558961173508466125 |
| xsd/common/UBL-CommonAggregateComponents-2.1.xsd | 939172AD8DD057CD403E7F763F6532184DD5ED4B9DE24C42EBB35DB4792BA613 |
| xsd/common/UBL-CommonBasicComponents-2.1.xsd | BD4AD043EE1D9DA1C7F8018DABF739CFAFDFB59143D0D16B9EF769E6B7C408A7 |
| xsd/common/UBL-CommonExtensionComponents-2.1.xsd | AD7A4E490978ADFBCFC5EC0BB20941CF11AC960CCF0C4DE8791A7C731A8DBE87 |
| xsd/common/UBL-ExtensionContentDataType-2.1.xsd | FCEE77A11870208E6377EA6311B9F2A050BCA24BDAD8606EA02D71E9F9E72F8D |
| xsd/common/UBL-QualifiedDataTypes-2.1.xsd | 7DCB156E610239C97AE70940CF4653B88E48C3595BF5F56A2204A32E2893E6CF |
| xsd/common/UBL-SignatureAggregateComponents-2.1.xsd | 17BB6B62D709B4FD81449A37655AF36AA6A1276AD4FDB1B2E249A5ED4B7C2172 |
| xsd/common/UBL-SignatureBasicComponents-2.1.xsd | CEF924D7BA3D1D8ADE14469325CDE1364F8C174E46F0198EC02DA8E9E748A489 |
| xsd/common/UBL-UnqualifiedDataTypes-2.1.xsd | 09052D406B4293E2A5F9C2BFEE6DF10AD4D8D5F0B36E24A6349D7F7936D89EB6 |
| xsd/common/CCTS_CCT_SchemaModule-2.1.xsd | dd546e4809df86b6445589f69f0d6c9df162840ae386574ddfc1da7638103e15 |

> **F5.5.4.6.3 popravek:** faza 1 je izpustila `CCTS_CCT_SchemaModule-2.1.xsd`
> (potrebna za `IdentifierType` v UDT) — preneseno v tej fazi.

## ISO Schematron XSLT prevodniki (Schematron.org / ISO 19757-3)

Source: `https://github.com/Schematron/schematron` (trunk/.../resource/xslt).

| File | SHA-256 |
|---|---|
| schematron-xslt/iso_dsdl_include.xsl | bfeb974e821aea5fbe3c20472520fa36d8402d9f62e5e8ff9d846a3adfd5d344 |
| schematron-xslt/iso_abstract_expand.xsl | ca036683dd08261829569367a235f735bf7c5bc0a8e5e47f8d60df36bf79dbec |
| schematron-xslt/iso_svrl_for_xslt2.xsl | 8bc20809aa8eb46aa1e18b1cd7219a451f4588643d9440da3d4b0c076f47213e |
| schematron-xslt/iso_schematron_skeleton_for_saxon.xsl | 2ae7da140a15bc6630327c1371ff095701029b66d5653978bcf19b7d8295630c |
| schematron-xslt/iso_schematron_message_xslt2.xsl | 36403a213e3ba75c07f14807f25c5a97053e9cefc15ba337a314de6a156765d0 |
| schematron-xslt/iso_schematron_message.xsl | 3506a5e33dc4b99ff9415a0c15b26a99ad922a0e3e8739bf0dbdbcdfed25d245 |

## Lokalni validatorji (F5.5.4.6.3)

| Artifact | SHA-256 | Namembnost |
|---|---|---|
| validator/Saxon-HE-12.5.jar | 98c3a91e6e5aaf9b3e2b37601e04b214a6e67098493cdd8232fcb705fddcb674 | XSLT 2.0/3.0 engine za Schematron (MPL-2.0) |
| validator/xmlresolver.jar | efc92bd7ed32b3e57095e0b3e872051ccfbbdcc980831ef33e89e38161a85222 | Saxon odvisnost (org.xmlresolver:xmlresolver:5.2.2 — točno verzija iz POM Saxon-HE 12.5) |

> Javni JDK 17 vgrajeni JAXP (Xerces interno) je XSD 1.0 engine — brez lastnega JAR-ja.
> Java 17 je lokalno nameščena (`java -version` → Temurin-17).
> Posodobljeno F5.5.4.6.3.1: xmlresolver prenesena v **5.2.2** (usklajeno s POM Saxon-HE 12.5),
> prej 5.2.0. SHA-256 posodobljen.

## e-SLOG 2.0 — uradni artefakti

**NOT VERIFIED** — uradna samostojna e-SLOG 2.0 vsebinska XSD + UJP ovojnica kot javni
artefakt **niso bili najdeni**. F5.5.4.6.3.1 preverjeno: UJP (gov.si) navaja, da se e-računi
danes izmenjujejo **prek PEPPOL omrežja ali portala UJPeRačun (UBL 2.1 / BIS)**; samostojna
e-SLOG 2.0 XSD ni z objavljena na UJP javnih straneh. e-SLOG adapter sestavi dobro oblikovan
UBL-semantičen XML, vendar NI uradno XSD potrjen. Prikazano kot NOT VERIFIED, ne PASS.

### Uradni UJP artefakti, pridobljeni v F5.5.4.6.3.1 (`ujp/`)
Vir: `https://www.gov.si/zbirke/storitve/posiljanje-eracunov/` (Uprava RS za javna plačila).

| File | SHA-256 |
|---|---|
| `schPodpisERacuniNarocanje_1_1.xsd` | `feeb7084d39a06e58e11d2b7f315fd912550c6b04c3e8680292de4cb4feb97c0` (iz `schPodpisERacuniNarocanje_1_1.zip`) |
| `schPodpisERacuniNarocanje_1_1.zip` | `feeb7084d39a06e58e11d2b7f315fd912550c6b04c3e8680292de4cb4feb97c0` |
| `PEInvoicesImportRights_1_0.xsd` | (v `eVloge.zip`) |
| `eVloge.zip` | `519a83f5d37ba85798fdb4f6ebe839b0264be7533202cec0a151d303bc9ca799` |
| `UJPeRacun-Tehnicni-napotki.pdf` | `e286d9d24ebf89f0c96f531b5cf08e4a2c17ae9335ed10309b8747b037b8919b` |
| `UJPeracun-B2B-Interface.pdf` | `d17decda9c8b9a7c92e5d28e04d8f130c8b93f2e05f7b3d5017f9d3fdddfeff4` |
| `Seznam-bank-in-ponudnikov-e-poti.pdf` | `8de922014157cca259a539af9deb0e5c7525f05e8ada482680220c3159f72e67` |

> Te dokumentacije UJP **podpirajo** ciljni standard PEPPOL BIS 3.0.21 (UBL 2.1 subset) za
> avtomatski B2G/B2B prenos; samostojne e-SLOG 2.0 XSD UJP javno ne izda več.