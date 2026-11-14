// ============================================================
// OFFICIAL SKD 2025 classification — generated file.
// Classification: SKD_2025 V1 (SURS KLASJE, Standardna klasifikacija dejavnosti 2025, V1 (Uradni list RS št. 27/2024)).
// Records: 1725 (22 sections / 87 divisions / 287 groups /
//           651 classes / 678 subclasses).
//
// DO NOT EDIT BY HAND — regenerate with:
//   node scripts/f50-generate-skd-module.mjs
// ============================================================

export const SKD_CLASSIFICATION = "SKD_2025"
export const SKD_VERSION = "V1"
export const SKD_SOURCE = "SURS KLASJE, Standardna klasifikacija dejavnosti 2025, V1 (Uradni list RS št. 27/2024)"

export interface SkdRecord {
  /** classification code, e.g. "A", "A01", "A01.1", "A01.11", "A01.110" */
  c: string
  /** level 1=section .. 5=subclass */
  l: 1 | 2 | 3 | 4 | 5
  /** official Slovenian name */
  sl: string
  /** official English name */
  en: string
  /** parent code (null for sections) */
  p: string | null
}

/** All 1725 records, in official hierarchy order. */
export const SKD_RECORDS: SkdRecord[] = [
 {
  "c": "A",
  "l": 1,
  "sl": "KMETIJSTVO IN LOV, GOZDARSTVO, RIBIŠTVO",
  "en": "AGRICULTURE, FORESTRY AND FISHING",
  "p": null
 },
 {
  "c": "A01",
  "l": 2,
  "sl": "Kmetijska proizvodnja in lov ter z njima povezane storitve",
  "en": "Crop and animal production, hunting and related service activities",
  "p": "A"
 },
 {
  "c": "A01.1",
  "l": 3,
  "sl": "Pridelovanje netrajnih rastlin",
  "en": "Growing of non-perennial crops",
  "p": "A01"
 },
 {
  "c": "A01.11",
  "l": 4,
  "sl": "Pridelovanje žit (razen riža), stročnic in oljnic",
  "en": "Growing of cereals, other than rice, leguminous crops and oil seeds",
  "p": "A01.1"
 },
 {
  "c": "A01.110",
  "l": 5,
  "sl": "Pridelovanje žit (razen riža), stročnic in oljnic",
  "en": "Growing of cereals, other than rice, leguminous crops and oil seeds",
  "p": "A01.11"
 },
 {
  "c": "A01.12",
  "l": 4,
  "sl": "Pridelovanje riža",
  "en": "Growing of rice",
  "p": "A01.1"
 },
 {
  "c": "A01.120",
  "l": 5,
  "sl": "Pridelovanje riža",
  "en": "Growing of rice",
  "p": "A01.12"
 },
 {
  "c": "A01.13",
  "l": 4,
  "sl": "Pridelovanje zelenjadnic in melon, korenovk in gomoljnic",
  "en": "Growing of vegetables and melons, roots and tubers",
  "p": "A01.1"
 },
 {
  "c": "A01.130",
  "l": 5,
  "sl": "Pridelovanje zelenjadnic in melon, korenovk in gomoljnic",
  "en": "Growing of vegetables and melons, roots and tubers",
  "p": "A01.13"
 },
 {
  "c": "A01.14",
  "l": 4,
  "sl": "Pridelovanje sladkornega trsa",
  "en": "Growing of sugar cane",
  "p": "A01.1"
 },
 {
  "c": "A01.140",
  "l": 5,
  "sl": "Pridelovanje sladkornega trsa",
  "en": "Growing of sugar cane",
  "p": "A01.14"
 },
 {
  "c": "A01.15",
  "l": 4,
  "sl": "Pridelovanje tobaka",
  "en": "Growing of tobacco",
  "p": "A01.1"
 },
 {
  "c": "A01.150",
  "l": 5,
  "sl": "Pridelovanje tobaka",
  "en": "Growing of tobacco",
  "p": "A01.15"
 },
 {
  "c": "A01.16",
  "l": 4,
  "sl": "Pridelovanje rastlin za vlakna",
  "en": "Growing of fibre crops",
  "p": "A01.1"
 },
 {
  "c": "A01.160",
  "l": 5,
  "sl": "Pridelovanje rastlin za vlakna",
  "en": "Growing of fibre crops",
  "p": "A01.16"
 },
 {
  "c": "A01.19",
  "l": 4,
  "sl": "Pridelovanje cvetja in drugih enoletnih rastlin",
  "en": "Growing of other non-perennial crops",
  "p": "A01.1"
 },
 {
  "c": "A01.190",
  "l": 5,
  "sl": "Pridelovanje cvetja in drugih enoletnih rastlin",
  "en": "Growing of other non-perennial crops",
  "p": "A01.19"
 },
 {
  "c": "A01.2",
  "l": 3,
  "sl": "Gojenje trajnih nasadov",
  "en": "Growing of perennial crops",
  "p": "A01"
 },
 {
  "c": "A01.21",
  "l": 4,
  "sl": "Vinogradništvo",
  "en": "Growing of grapes",
  "p": "A01.2"
 },
 {
  "c": "A01.210",
  "l": 5,
  "sl": "Vinogradništvo",
  "en": "Growing of grapes",
  "p": "A01.21"
 },
 {
  "c": "A01.22",
  "l": 4,
  "sl": "Gojenje tropskega in subtropskega sadja",
  "en": "Growing of tropical and subtropical fruits",
  "p": "A01.2"
 },
 {
  "c": "A01.220",
  "l": 5,
  "sl": "Gojenje tropskega in subtropskega sadja",
  "en": "Growing of tropical and subtropical fruits",
  "p": "A01.22"
 },
 {
  "c": "A01.23",
  "l": 4,
  "sl": "Gojenje citrusov",
  "en": "Growing of citrus fruits",
  "p": "A01.2"
 },
 {
  "c": "A01.230",
  "l": 5,
  "sl": "Gojenje citrusov",
  "en": "Growing of citrus fruits",
  "p": "A01.23"
 },
 {
  "c": "A01.24",
  "l": 4,
  "sl": "Gojenje pečkatega in koščičastega sadja",
  "en": "Growing of pome fruits and stone fruits",
  "p": "A01.2"
 },
 {
  "c": "A01.240",
  "l": 5,
  "sl": "Gojenje pečkatega in koščičastega sadja",
  "en": "Growing of pome fruits and stone fruits",
  "p": "A01.24"
 },
 {
  "c": "A01.25",
  "l": 4,
  "sl": "Gojenje drugih sadnih dreves in grmovnic",
  "en": "Growing of other tree and bush fruits and nuts",
  "p": "A01.2"
 },
 {
  "c": "A01.250",
  "l": 5,
  "sl": "Gojenje drugih sadnih dreves in grmovnic",
  "en": "Growing of other tree and bush fruits and nuts",
  "p": "A01.25"
 },
 {
  "c": "A01.26",
  "l": 4,
  "sl": "Pridelovanje oljnih sadežev",
  "en": "Growing of oleaginous fruits",
  "p": "A01.2"
 },
 {
  "c": "A01.260",
  "l": 5,
  "sl": "Pridelovanje oljnih sadežev",
  "en": "Growing of oleaginous fruits",
  "p": "A01.26"
 },
 {
  "c": "A01.27",
  "l": 4,
  "sl": "Gojenje rastlin za izdelavo napitkov",
  "en": "Growing of beverage crops",
  "p": "A01.2"
 },
 {
  "c": "A01.270",
  "l": 5,
  "sl": "Gojenje rastlin za izdelavo napitkov",
  "en": "Growing of beverage crops",
  "p": "A01.27"
 },
 {
  "c": "A01.28",
  "l": 4,
  "sl": "Gojenje začimbnih, aromatskih in zdravilnih rastlin",
  "en": "Growing of spices, aromatic, drug and pharmaceutical crops",
  "p": "A01.2"
 },
 {
  "c": "A01.280",
  "l": 5,
  "sl": "Gojenje začimbnih, aromatskih in zdravilnih rastlin",
  "en": "Growing of spices, aromatic, drug and pharmaceutical crops",
  "p": "A01.28"
 },
 {
  "c": "A01.29",
  "l": 4,
  "sl": "Gojenje drugih trajnih nasadov",
  "en": "Growing of other perennial crops",
  "p": "A01.2"
 },
 {
  "c": "A01.290",
  "l": 5,
  "sl": "Gojenje drugih trajnih nasadov",
  "en": "Growing of other perennial crops",
  "p": "A01.29"
 },
 {
  "c": "A01.3",
  "l": 3,
  "sl": "Razmnoževanje rastlin",
  "en": "Plant propagation",
  "p": "A01"
 },
 {
  "c": "A01.30",
  "l": 4,
  "sl": "Razmnoževanje rastlin",
  "en": "Plant propagation",
  "p": "A01.3"
 },
 {
  "c": "A01.300",
  "l": 5,
  "sl": "Razmnoževanje rastlin",
  "en": "Plant propagation",
  "p": "A01.30"
 },
 {
  "c": "A01.4",
  "l": 3,
  "sl": "Živinoreja",
  "en": "Animal production",
  "p": "A01"
 },
 {
  "c": "A01.41",
  "l": 4,
  "sl": "Prireja mleka",
  "en": "Raising of dairy cattle",
  "p": "A01.4"
 },
 {
  "c": "A01.410",
  "l": 5,
  "sl": "Prireja mleka",
  "en": "Raising of dairy cattle",
  "p": "A01.41"
 },
 {
  "c": "A01.42",
  "l": 4,
  "sl": "Druga govedoreja",
  "en": "Raising of other cattle and buffaloes",
  "p": "A01.4"
 },
 {
  "c": "A01.420",
  "l": 5,
  "sl": "Druga govedoreja",
  "en": "Raising of other cattle and buffaloes",
  "p": "A01.42"
 },
 {
  "c": "A01.43",
  "l": 4,
  "sl": "Konjereja",
  "en": "Raising of horses and other equines",
  "p": "A01.4"
 },
 {
  "c": "A01.430",
  "l": 5,
  "sl": "Konjereja",
  "en": "Raising of horses and other equines",
  "p": "A01.43"
 },
 {
  "c": "A01.44",
  "l": 4,
  "sl": "Reja kamel",
  "en": "Raising of camels and camelids",
  "p": "A01.4"
 },
 {
  "c": "A01.440",
  "l": 5,
  "sl": "Reja kamel",
  "en": "Raising of camels and camelids",
  "p": "A01.44"
 },
 {
  "c": "A01.45",
  "l": 4,
  "sl": "Reja drobnice",
  "en": "Raising of sheep and goats",
  "p": "A01.4"
 },
 {
  "c": "A01.450",
  "l": 5,
  "sl": "Reja drobnice",
  "en": "Raising of sheep and goats",
  "p": "A01.45"
 },
 {
  "c": "A01.46",
  "l": 4,
  "sl": "Prašičereja",
  "en": "Raising of swine and pigs",
  "p": "A01.4"
 },
 {
  "c": "A01.460",
  "l": 5,
  "sl": "Prašičereja",
  "en": "Raising of swine and pigs",
  "p": "A01.46"
 },
 {
  "c": "A01.47",
  "l": 4,
  "sl": "Reja perutnine",
  "en": "Raising of poultry",
  "p": "A01.4"
 },
 {
  "c": "A01.470",
  "l": 5,
  "sl": "Reja perutnine",
  "en": "Raising of poultry",
  "p": "A01.47"
 },
 {
  "c": "A01.48",
  "l": 4,
  "sl": "Reja drugih živali",
  "en": "Raising of other animals",
  "p": "A01.4"
 },
 {
  "c": "A01.480",
  "l": 5,
  "sl": "Reja drugih živali",
  "en": "Raising of other animals",
  "p": "A01.48"
 },
 {
  "c": "A01.5",
  "l": 3,
  "sl": "Mešano kmetijstvo",
  "en": "Mixed farming",
  "p": "A01"
 },
 {
  "c": "A01.50",
  "l": 4,
  "sl": "Mešano kmetijstvo",
  "en": "Mixed farming",
  "p": "A01.5"
 },
 {
  "c": "A01.500",
  "l": 5,
  "sl": "Mešano kmetijstvo",
  "en": "Mixed farming",
  "p": "A01.50"
 },
 {
  "c": "A01.6",
  "l": 3,
  "sl": "Storitve za kmetijsko proizvodnjo, priprava pridelkov",
  "en": "Support activities to agriculture and post-harvest crop activities",
  "p": "A01"
 },
 {
  "c": "A01.61",
  "l": 4,
  "sl": "Storitve za rastlinsko pridelavo",
  "en": "Support activities for crop production",
  "p": "A01.6"
 },
 {
  "c": "A01.610",
  "l": 5,
  "sl": "Storitve za rastlinsko pridelavo",
  "en": "Support activities for crop production",
  "p": "A01.61"
 },
 {
  "c": "A01.62",
  "l": 4,
  "sl": "Storitve za živinorejo, razen veterinarskih",
  "en": "Support activities for animal production",
  "p": "A01.6"
 },
 {
  "c": "A01.620",
  "l": 5,
  "sl": "Storitve za živinorejo, razen veterinarskih",
  "en": "Support activities for animal production",
  "p": "A01.62"
 },
 {
  "c": "A01.63",
  "l": 4,
  "sl": "Priprava pridelkov in obdelava semen",
  "en": "Post-harvest crop activities and seed processing for propagation",
  "p": "A01.6"
 },
 {
  "c": "A01.630",
  "l": 5,
  "sl": "Priprava pridelkov in obdelava semen",
  "en": "Post-harvest crop activities and seed processing for propagation",
  "p": "A01.63"
 },
 {
  "c": "A01.7",
  "l": 3,
  "sl": "Lovstvo",
  "en": "Hunting, trapping and related service activities",
  "p": "A01"
 },
 {
  "c": "A01.70",
  "l": 4,
  "sl": "Lovstvo",
  "en": "Hunting, trapping and related service activities",
  "p": "A01.7"
 },
 {
  "c": "A01.700",
  "l": 5,
  "sl": "Lovstvo",
  "en": "Hunting, trapping and related service activities",
  "p": "A01.70"
 },
 {
  "c": "A02",
  "l": 2,
  "sl": "Gozdarstvo",
  "en": "Forestry and logging",
  "p": "A"
 },
 {
  "c": "A02.1",
  "l": 3,
  "sl": "Gojenje gozdov in druge gozdarske dejavnosti",
  "en": "Silviculture and other forestry activities",
  "p": "A02"
 },
 {
  "c": "A02.10",
  "l": 4,
  "sl": "Gojenje gozdov in druge gozdarske dejavnosti",
  "en": "Silviculture and other forestry activities",
  "p": "A02.1"
 },
 {
  "c": "A02.100",
  "l": 5,
  "sl": "Gojenje gozdov in druge gozdarske dejavnosti",
  "en": "Silviculture and other forestry activities",
  "p": "A02.10"
 },
 {
  "c": "A02.2",
  "l": 3,
  "sl": "Sečnja",
  "en": "Logging",
  "p": "A02"
 },
 {
  "c": "A02.20",
  "l": 4,
  "sl": "Sečnja",
  "en": "Logging",
  "p": "A02.2"
 },
 {
  "c": "A02.200",
  "l": 5,
  "sl": "Sečnja",
  "en": "Logging",
  "p": "A02.20"
 },
 {
  "c": "A02.3",
  "l": 3,
  "sl": "Nabiranje gozdnih dobrin, razen lesa",
  "en": "Gathering of wild growing non-wood products",
  "p": "A02"
 },
 {
  "c": "A02.30",
  "l": 4,
  "sl": "Nabiranje gozdnih dobrin, razen lesa",
  "en": "Gathering of wild growing non-wood products",
  "p": "A02.3"
 },
 {
  "c": "A02.300",
  "l": 5,
  "sl": "Nabiranje gozdnih dobrin, razen lesa",
  "en": "Gathering of wild growing non-wood products",
  "p": "A02.30"
 },
 {
  "c": "A02.4",
  "l": 3,
  "sl": "Storitve za gozdarstvo",
  "en": "Support services to forestry",
  "p": "A02"
 },
 {
  "c": "A02.40",
  "l": 4,
  "sl": "Storitve za gozdarstvo",
  "en": "Support services to forestry",
  "p": "A02.4"
 },
 {
  "c": "A02.400",
  "l": 5,
  "sl": "Storitve za gozdarstvo",
  "en": "Support services to forestry",
  "p": "A02.40"
 },
 {
  "c": "A03",
  "l": 2,
  "sl": "Ribištvo in akvakultura",
  "en": "Fishing and aquaculture",
  "p": "A"
 },
 {
  "c": "A03.1",
  "l": 3,
  "sl": "Ribištvo",
  "en": "Fishing",
  "p": "A03"
 },
 {
  "c": "A03.11",
  "l": 4,
  "sl": "Morsko ribištvo",
  "en": "Marine fishing",
  "p": "A03.1"
 },
 {
  "c": "A03.110",
  "l": 5,
  "sl": "Morsko ribištvo",
  "en": "Marine fishing",
  "p": "A03.11"
 },
 {
  "c": "A03.12",
  "l": 4,
  "sl": "Sladkovodno ribištvo",
  "en": "Freshwater fishing",
  "p": "A03.1"
 },
 {
  "c": "A03.120",
  "l": 5,
  "sl": "Sladkovodno ribištvo",
  "en": "Freshwater fishing",
  "p": "A03.12"
 },
 {
  "c": "A03.2",
  "l": 3,
  "sl": "Akvakultura",
  "en": "Aquaculture",
  "p": "A03"
 },
 {
  "c": "A03.21",
  "l": 4,
  "sl": "Morska akvakultura",
  "en": "Marine aquaculture",
  "p": "A03.2"
 },
 {
  "c": "A03.210",
  "l": 5,
  "sl": "Morska akvakultura",
  "en": "Marine aquaculture",
  "p": "A03.21"
 },
 {
  "c": "A03.22",
  "l": 4,
  "sl": "Sladkovodna akvakultura",
  "en": "Freshwater aquaculture",
  "p": "A03.2"
 },
 {
  "c": "A03.220",
  "l": 5,
  "sl": "Sladkovodna akvakultura",
  "en": "Freshwater aquaculture",
  "p": "A03.22"
 },
 {
  "c": "A03.3",
  "l": 3,
  "sl": "Storitve za ribištvo in akvakulturo",
  "en": "Support activities for fishing and aquaculture",
  "p": "A03"
 },
 {
  "c": "A03.30",
  "l": 4,
  "sl": "Storitve za ribištvo in akvakulturo",
  "en": "Support activities for fishing and aquaculture",
  "p": "A03.3"
 },
 {
  "c": "A03.300",
  "l": 5,
  "sl": "Storitve za ribištvo in akvakulturo",
  "en": "Support activities for fishing and aquaculture",
  "p": "A03.30"
 },
 {
  "c": "B",
  "l": 1,
  "sl": "RUDARSTVO",
  "en": "MINING AND QUARRYING",
  "p": null
 },
 {
  "c": "B05",
  "l": 2,
  "sl": "Pridobivanje premoga",
  "en": "Mining of coal and lignite",
  "p": "B"
 },
 {
  "c": "B05.1",
  "l": 3,
  "sl": "Pridobivanje črnega premoga",
  "en": "Mining of hard coal",
  "p": "B05"
 },
 {
  "c": "B05.10",
  "l": 4,
  "sl": "Pridobivanje črnega premoga",
  "en": "Mining of hard coal",
  "p": "B05.1"
 },
 {
  "c": "B05.100",
  "l": 5,
  "sl": "Pridobivanje črnega premoga",
  "en": "Mining of hard coal",
  "p": "B05.10"
 },
 {
  "c": "B05.2",
  "l": 3,
  "sl": "Pridobivanje rjavega premoga in lignita",
  "en": "Mining of lignite",
  "p": "B05"
 },
 {
  "c": "B05.20",
  "l": 4,
  "sl": "Pridobivanje rjavega premoga in lignita",
  "en": "Mining of lignite",
  "p": "B05.2"
 },
 {
  "c": "B05.200",
  "l": 5,
  "sl": "Pridobivanje rjavega premoga in lignita",
  "en": "Mining of lignite",
  "p": "B05.20"
 },
 {
  "c": "B06",
  "l": 2,
  "sl": "Pridobivanje surove nafte in zemeljskega plina",
  "en": "Extraction of crude petroleum and natural gas",
  "p": "B"
 },
 {
  "c": "B06.1",
  "l": 3,
  "sl": "Pridobivanje surove nafte",
  "en": "Extraction of crude petroleum",
  "p": "B06"
 },
 {
  "c": "B06.10",
  "l": 4,
  "sl": "Pridobivanje surove nafte",
  "en": "Extraction of crude petroleum",
  "p": "B06.1"
 },
 {
  "c": "B06.100",
  "l": 5,
  "sl": "Pridobivanje surove nafte",
  "en": "Extraction of crude petroleum",
  "p": "B06.10"
 },
 {
  "c": "B06.2",
  "l": 3,
  "sl": "Pridobivanje zemeljskega plina",
  "en": "Extraction of natural gas",
  "p": "B06"
 },
 {
  "c": "B06.20",
  "l": 4,
  "sl": "Pridobivanje zemeljskega plina",
  "en": "Extraction of natural gas",
  "p": "B06.2"
 },
 {
  "c": "B06.200",
  "l": 5,
  "sl": "Pridobivanje zemeljskega plina",
  "en": "Extraction of natural gas",
  "p": "B06.20"
 },
 {
  "c": "B07",
  "l": 2,
  "sl": "Pridobivanje rud",
  "en": "Mining of metal ores",
  "p": "B"
 },
 {
  "c": "B07.1",
  "l": 3,
  "sl": "Pridobivanje železove rude",
  "en": "Mining of iron ores",
  "p": "B07"
 },
 {
  "c": "B07.10",
  "l": 4,
  "sl": "Pridobivanje železove rude",
  "en": "Mining of iron ores",
  "p": "B07.1"
 },
 {
  "c": "B07.100",
  "l": 5,
  "sl": "Pridobivanje železove rude",
  "en": "Mining of iron ores",
  "p": "B07.10"
 },
 {
  "c": "B07.2",
  "l": 3,
  "sl": "Pridobivanje rud neželeznih kovin",
  "en": "Mining of non-ferrous metal ores",
  "p": "B07"
 },
 {
  "c": "B07.21",
  "l": 4,
  "sl": "Pridobivanje uranove in torijeve rude",
  "en": "Mining of uranium and thorium ores",
  "p": "B07.2"
 },
 {
  "c": "B07.210",
  "l": 5,
  "sl": "Pridobivanje uranove in torijeve rude",
  "en": "Mining of uranium and thorium ores",
  "p": "B07.21"
 },
 {
  "c": "B07.29",
  "l": 4,
  "sl": "Pridobivanje rud drugih neželeznih kovin",
  "en": "Mining of other non-ferrous metal ores",
  "p": "B07.2"
 },
 {
  "c": "B07.290",
  "l": 5,
  "sl": "Pridobivanje rud drugih neželeznih kovin",
  "en": "Mining of other non-ferrous metal ores",
  "p": "B07.29"
 },
 {
  "c": "B08",
  "l": 2,
  "sl": "Pridobivanje rudnin in kamnin",
  "en": "Other mining and quarrying",
  "p": "B"
 },
 {
  "c": "B08.1",
  "l": 3,
  "sl": "Pridobivanje kamna, peska in gline",
  "en": "Quarrying of stone, sand and clay",
  "p": "B08"
 },
 {
  "c": "B08.11",
  "l": 4,
  "sl": "Pridobivanje okrasnega kamna, apnenca, sadre, skrilavca in drugega kamna",
  "en": "Quarrying of ornamental stone, limestone, gypsum, slate and other stone",
  "p": "B08.1"
 },
 {
  "c": "B08.110",
  "l": 5,
  "sl": "Pridobivanje okrasnega kamna, apnenca, sadre, skrilavca in drugega kamna",
  "en": "Quarrying of ornamental stone, limestone, gypsum, slate and other stone",
  "p": "B08.11"
 },
 {
  "c": "B08.12",
  "l": 4,
  "sl": "Pridobivanje gramoza, peska, gline",
  "en": "Operation of gravel and sand pits and mining of clay and kaolin",
  "p": "B08.1"
 },
 {
  "c": "B08.120",
  "l": 5,
  "sl": "Pridobivanje gramoza, peska, gline",
  "en": "Operation of gravel and sand pits and mining of clay and kaolin",
  "p": "B08.12"
 },
 {
  "c": "B08.9",
  "l": 3,
  "sl": "Pridobivanje rudnin in kamnin, d. n.",
  "en": "Mining and quarrying n.e.c.",
  "p": "B08"
 },
 {
  "c": "B08.91",
  "l": 4,
  "sl": "Pridobivanje mineralov za kemikalije in gnojila",
  "en": "Mining of chemical and fertiliser minerals",
  "p": "B08.9"
 },
 {
  "c": "B08.910",
  "l": 5,
  "sl": "Pridobivanje mineralov za kemikalije in gnojila",
  "en": "Mining of chemical and fertiliser minerals",
  "p": "B08.91"
 },
 {
  "c": "B08.92",
  "l": 4,
  "sl": "Pridobivanje šote",
  "en": "Extraction of peat",
  "p": "B08.9"
 },
 {
  "c": "B08.920",
  "l": 5,
  "sl": "Pridobivanje šote",
  "en": "Extraction of peat",
  "p": "B08.92"
 },
 {
  "c": "B08.93",
  "l": 4,
  "sl": "Pridobivanje soli",
  "en": "Extraction of salt",
  "p": "B08.9"
 },
 {
  "c": "B08.930",
  "l": 5,
  "sl": "Pridobivanje soli",
  "en": "Extraction of salt",
  "p": "B08.93"
 },
 {
  "c": "B08.99",
  "l": 4,
  "sl": "Drugo pridobivanje rudnin in kamnin, d. n.",
  "en": "Other mining and quarrying n.e.c.",
  "p": "B08.9"
 },
 {
  "c": "B08.990",
  "l": 5,
  "sl": "Drugo pridobivanje rudnin in kamnin, d. n.",
  "en": "Other mining and quarrying n.e.c.",
  "p": "B08.99"
 },
 {
  "c": "B09",
  "l": 2,
  "sl": "Storitve za rudarstvo",
  "en": "Mining support service activities",
  "p": "B"
 },
 {
  "c": "B09.1",
  "l": 3,
  "sl": "Storitve za pridobivanje nafte in zemeljskega plina",
  "en": "Support activities for petroleum and natural gas extraction",
  "p": "B09"
 },
 {
  "c": "B09.10",
  "l": 4,
  "sl": "Storitve za pridobivanje nafte in zemeljskega plina",
  "en": "Support activities for petroleum and natural gas extraction",
  "p": "B09.1"
 },
 {
  "c": "B09.100",
  "l": 5,
  "sl": "Storitve za pridobivanje nafte in zemeljskega plina",
  "en": "Support activities for petroleum and natural gas extraction",
  "p": "B09.10"
 },
 {
  "c": "B09.9",
  "l": 3,
  "sl": "Storitve za drugo rudarjenje",
  "en": "Support activities for other mining and quarrying",
  "p": "B09"
 },
 {
  "c": "B09.90",
  "l": 4,
  "sl": "Storitve za drugo rudarjenje",
  "en": "Support activities for other mining and quarrying",
  "p": "B09.9"
 },
 {
  "c": "B09.900",
  "l": 5,
  "sl": "Storitve za drugo rudarjenje",
  "en": "Support activities for other mining and quarrying",
  "p": "B09.90"
 },
 {
  "c": "C",
  "l": 1,
  "sl": "PREDELOVALNE DEJAVNOSTI",
  "en": "MANUFACTURING",
  "p": null
 },
 {
  "c": "C10",
  "l": 2,
  "sl": "Proizvodnja živil",
  "en": "Manufacture of food products",
  "p": "C"
 },
 {
  "c": "C10.1",
  "l": 3,
  "sl": "Proizvodnja mesa in mesnih izdelkov",
  "en": "Processing and preserving of meat and production of meat products",
  "p": "C10"
 },
 {
  "c": "C10.11",
  "l": 4,
  "sl": "Proizvodnja mesa, razen perutninskega",
  "en": "Processing and preserving of meat, except of poultry meat",
  "p": "C10.1"
 },
 {
  "c": "C10.110",
  "l": 5,
  "sl": "Proizvodnja mesa, razen perutninskega",
  "en": "Processing and preserving of meat, except of poultry meat",
  "p": "C10.11"
 },
 {
  "c": "C10.12",
  "l": 4,
  "sl": "Proizvodnja perutninskega mesa",
  "en": "Processing and preserving of poultry meat",
  "p": "C10.1"
 },
 {
  "c": "C10.120",
  "l": 5,
  "sl": "Proizvodnja perutninskega mesa",
  "en": "Processing and preserving of poultry meat",
  "p": "C10.12"
 },
 {
  "c": "C10.13",
  "l": 4,
  "sl": "Proizvodnja mesnih izdelkov",
  "en": "Production of meat and poultry meat products",
  "p": "C10.1"
 },
 {
  "c": "C10.130",
  "l": 5,
  "sl": "Proizvodnja mesnih izdelkov",
  "en": "Production of meat and poultry meat products",
  "p": "C10.13"
 },
 {
  "c": "C10.2",
  "l": 3,
  "sl": "Predelava in konzerviranje rib, rakov in mehkužcev",
  "en": "Processing and preserving of fish, crustaceans and molluscs",
  "p": "C10"
 },
 {
  "c": "C10.20",
  "l": 4,
  "sl": "Predelava in konzerviranje rib, rakov in mehkužcev",
  "en": "Processing and preserving of fish, crustaceans and molluscs",
  "p": "C10.2"
 },
 {
  "c": "C10.200",
  "l": 5,
  "sl": "Predelava in konzerviranje rib, rakov in mehkužcev",
  "en": "Processing and preserving of fish, crustaceans and molluscs",
  "p": "C10.20"
 },
 {
  "c": "C10.3",
  "l": 3,
  "sl": "Predelava in konzerviranje sadja in zelenjave",
  "en": "Processing and preserving of fruit and vegetables",
  "p": "C10"
 },
 {
  "c": "C10.31",
  "l": 4,
  "sl": "Predelava in konzerviranje krompirja",
  "en": "Processing and preserving of potatoes",
  "p": "C10.3"
 },
 {
  "c": "C10.310",
  "l": 5,
  "sl": "Predelava in konzerviranje krompirja",
  "en": "Processing and preserving of potatoes",
  "p": "C10.31"
 },
 {
  "c": "C10.32",
  "l": 4,
  "sl": "Proizvodnja sadnih in zelenjavnih sokov",
  "en": "Manufacture of fruit and vegetable juice",
  "p": "C10.3"
 },
 {
  "c": "C10.320",
  "l": 5,
  "sl": "Proizvodnja sadnih in zelenjavnih sokov",
  "en": "Manufacture of fruit and vegetable juice",
  "p": "C10.32"
 },
 {
  "c": "C10.39",
  "l": 4,
  "sl": "Druga predelava in konzerviranje sadja in zelenjave",
  "en": "Other processing and preserving of fruit and vegetables",
  "p": "C10.3"
 },
 {
  "c": "C10.390",
  "l": 5,
  "sl": "Druga predelava in konzerviranje sadja in zelenjave",
  "en": "Other processing and preserving of fruit and vegetables",
  "p": "C10.39"
 },
 {
  "c": "C10.4",
  "l": 3,
  "sl": "Proizvodnja rastlinskih in živalskih olj in maščob",
  "en": "Manufacture of vegetable and animal oils and fats",
  "p": "C10"
 },
 {
  "c": "C10.41",
  "l": 4,
  "sl": "Proizvodnja olja in maščob",
  "en": "Manufacture of oils and fats",
  "p": "C10.4"
 },
 {
  "c": "C10.410",
  "l": 5,
  "sl": "Proizvodnja olja in maščob",
  "en": "Manufacture of oils and fats",
  "p": "C10.41"
 },
 {
  "c": "C10.42",
  "l": 4,
  "sl": "Proizvodnja margarine in podobnih jedilnih maščob",
  "en": "Manufacture of margarine and similar edible fats",
  "p": "C10.4"
 },
 {
  "c": "C10.420",
  "l": 5,
  "sl": "Proizvodnja margarine in podobnih jedilnih maščob",
  "en": "Manufacture of margarine and similar edible fats",
  "p": "C10.42"
 },
 {
  "c": "C10.5",
  "l": 3,
  "sl": "Proizvodnja mlečnih izdelkov in ledenih sladic",
  "en": "Manufacture of dairy products and edible ice",
  "p": "C10"
 },
 {
  "c": "C10.51",
  "l": 4,
  "sl": "Proizvodnja mlečnih izdelkov",
  "en": "Manufacture of dairy products",
  "p": "C10.5"
 },
 {
  "c": "C10.510",
  "l": 5,
  "sl": "Proizvodnja mlečnih izdelkov",
  "en": "Manufacture of dairy products",
  "p": "C10.51"
 },
 {
  "c": "C10.52",
  "l": 4,
  "sl": "Proizvodnja sladoleda in drugih ledenih sladic",
  "en": "Manufacture of ice cream and other edible ice",
  "p": "C10.5"
 },
 {
  "c": "C10.520",
  "l": 5,
  "sl": "Proizvodnja sladoleda in drugih ledenih sladic",
  "en": "Manufacture of ice cream and other edible ice",
  "p": "C10.52"
 },
 {
  "c": "C10.6",
  "l": 3,
  "sl": "Mlinarstvo, proizvodnja škroba in škrobnih izdelkov",
  "en": "Manufacture of grain mill products, starches and starch products",
  "p": "C10"
 },
 {
  "c": "C10.61",
  "l": 4,
  "sl": "Mlinarstvo",
  "en": "Manufacture of grain mill products",
  "p": "C10.6"
 },
 {
  "c": "C10.610",
  "l": 5,
  "sl": "Mlinarstvo",
  "en": "Manufacture of grain mill products",
  "p": "C10.61"
 },
 {
  "c": "C10.62",
  "l": 4,
  "sl": "Proizvodnja škroba in škrobnih izdelkov",
  "en": "Manufacture of starches and starch products",
  "p": "C10.6"
 },
 {
  "c": "C10.620",
  "l": 5,
  "sl": "Proizvodnja škroba in škrobnih izdelkov",
  "en": "Manufacture of starches and starch products",
  "p": "C10.62"
 },
 {
  "c": "C10.7",
  "l": 3,
  "sl": "Proizvodnja pekarskih izdelkov in testenin",
  "en": "Manufacture of bakery and farinaceous products",
  "p": "C10"
 },
 {
  "c": "C10.71",
  "l": 4,
  "sl": "Proizvodnja kruha, svežega peciva in slaščic",
  "en": "Manufacture of bread, manufacture of fresh pastry goods and cakes",
  "p": "C10.7"
 },
 {
  "c": "C10.710",
  "l": 5,
  "sl": "Proizvodnja kruha, svežega peciva in slaščic",
  "en": "Manufacture of bread, manufacture of fresh pastry goods and cakes",
  "p": "C10.71"
 },
 {
  "c": "C10.72",
  "l": 4,
  "sl": "Proizvodnja prepečenca, piškotov, trajnega peciva in slaščic",
  "en": "Manufacture of rusks, biscuits, preserved pastries and cakes",
  "p": "C10.7"
 },
 {
  "c": "C10.720",
  "l": 5,
  "sl": "Proizvodnja prepečenca, piškotov, trajnega peciva in slaščic",
  "en": "Manufacture of rusks, biscuits, preserved pastries and cakes",
  "p": "C10.72"
 },
 {
  "c": "C10.73",
  "l": 4,
  "sl": "Proizvodnja testenin",
  "en": "Manufacture of farinaceous products",
  "p": "C10.7"
 },
 {
  "c": "C10.730",
  "l": 5,
  "sl": "Proizvodnja testenin",
  "en": "Manufacture of farinaceous products",
  "p": "C10.73"
 },
 {
  "c": "C10.8",
  "l": 3,
  "sl": "Proizvodnja drugih živil",
  "en": "Manufacture of other food products",
  "p": "C10"
 },
 {
  "c": "C10.81",
  "l": 4,
  "sl": "Proizvodnja sladkorja",
  "en": "Manufacture of sugar",
  "p": "C10.8"
 },
 {
  "c": "C10.810",
  "l": 5,
  "sl": "Proizvodnja sladkorja",
  "en": "Manufacture of sugar",
  "p": "C10.81"
 },
 {
  "c": "C10.82",
  "l": 4,
  "sl": "Proizvodnja kakava, čokolade in sladkornih izdelkov",
  "en": "Manufacture of cocoa, chocolate and sugar confectionery",
  "p": "C10.8"
 },
 {
  "c": "C10.820",
  "l": 5,
  "sl": "Proizvodnja kakava, čokolade in sladkornih izdelkov",
  "en": "Manufacture of cocoa, chocolate and sugar confectionery",
  "p": "C10.82"
 },
 {
  "c": "C10.83",
  "l": 4,
  "sl": "Predelava čaja in kave",
  "en": "Processing of tea and coffee",
  "p": "C10.8"
 },
 {
  "c": "C10.830",
  "l": 5,
  "sl": "Predelava čaja in kave",
  "en": "Processing of tea and coffee",
  "p": "C10.83"
 },
 {
  "c": "C10.84",
  "l": 4,
  "sl": "Proizvodnja začimb, dišav in drugih dodatkov",
  "en": "Manufacture of condiments and seasonings",
  "p": "C10.8"
 },
 {
  "c": "C10.840",
  "l": 5,
  "sl": "Proizvodnja začimb, dišav in drugih dodatkov",
  "en": "Manufacture of condiments and seasonings",
  "p": "C10.84"
 },
 {
  "c": "C10.85",
  "l": 4,
  "sl": "Proizvodnja pripravljenih jedi in obrokov",
  "en": "Manufacture of prepared meals and dishes",
  "p": "C10.8"
 },
 {
  "c": "C10.850",
  "l": 5,
  "sl": "Proizvodnja pripravljenih jedi in obrokov",
  "en": "Manufacture of prepared meals and dishes",
  "p": "C10.85"
 },
 {
  "c": "C10.86",
  "l": 4,
  "sl": "Proizvodnja homogeniziranih in dietetičnih živil",
  "en": "Manufacture of homogenised food preparations and dietetic food",
  "p": "C10.8"
 },
 {
  "c": "C10.860",
  "l": 5,
  "sl": "Proizvodnja homogeniziranih in dietetičnih živil",
  "en": "Manufacture of homogenised food preparations and dietetic food",
  "p": "C10.86"
 },
 {
  "c": "C10.89",
  "l": 4,
  "sl": "Proizvodnja drugih živil, d. n.",
  "en": "Manufacture of other food products n.e.c.",
  "p": "C10.8"
 },
 {
  "c": "C10.890",
  "l": 5,
  "sl": "Proizvodnja drugih živil, d. n.",
  "en": "Manufacture of other food products n.e.c.",
  "p": "C10.89"
 },
 {
  "c": "C10.9",
  "l": 3,
  "sl": "Proizvodnja krmil in hrane za hišne živali",
  "en": "Manufacture of prepared animal feeds",
  "p": "C10"
 },
 {
  "c": "C10.91",
  "l": 4,
  "sl": "Proizvodnja krmil",
  "en": "Manufacture of prepared feeds for farm animals",
  "p": "C10.9"
 },
 {
  "c": "C10.910",
  "l": 5,
  "sl": "Proizvodnja krmil",
  "en": "Manufacture of prepared feeds for farm animals",
  "p": "C10.91"
 },
 {
  "c": "C10.92",
  "l": 4,
  "sl": "Proizvodnja hrane za hišne živali",
  "en": "Manufacture of prepared pet foods",
  "p": "C10.9"
 },
 {
  "c": "C10.920",
  "l": 5,
  "sl": "Proizvodnja hrane za hišne živali",
  "en": "Manufacture of prepared pet foods",
  "p": "C10.92"
 },
 {
  "c": "C11",
  "l": 2,
  "sl": "Proizvodnja pijač",
  "en": "Manufacture of beverages",
  "p": "C"
 },
 {
  "c": "C11.0",
  "l": 3,
  "sl": "Proizvodnja pijač",
  "en": "Manufacture of beverages",
  "p": "C11"
 },
 {
  "c": "C11.01",
  "l": 4,
  "sl": "Proizvodnja žganih pijač",
  "en": "Distilling, rectifying and blending of spirits",
  "p": "C11.0"
 },
 {
  "c": "C11.010",
  "l": 5,
  "sl": "Proizvodnja žganih pijač",
  "en": "Distilling, rectifying and blending of spirits",
  "p": "C11.01"
 },
 {
  "c": "C11.02",
  "l": 4,
  "sl": "Proizvodnja vina iz grozdja",
  "en": "Manufacture of wine from grape",
  "p": "C11.0"
 },
 {
  "c": "C11.020",
  "l": 5,
  "sl": "Proizvodnja vina iz grozdja",
  "en": "Manufacture of wine from grape",
  "p": "C11.02"
 },
 {
  "c": "C11.03",
  "l": 4,
  "sl": "Proizvodnja jabolčnika in drugih fermentiranih sadnih pijač",
  "en": "Manufacture of cider and other fruit fermented beverages",
  "p": "C11.0"
 },
 {
  "c": "C11.030",
  "l": 5,
  "sl": "Proizvodnja jabolčnika in drugih fermentiranih sadnih pijač",
  "en": "Manufacture of cider and other fruit fermented beverages",
  "p": "C11.03"
 },
 {
  "c": "C11.04",
  "l": 4,
  "sl": "Proizvodnja drugih nedestiliranih fermentiranih pijač",
  "en": "Manufacture of other non-distilled fermented beverages",
  "p": "C11.0"
 },
 {
  "c": "C11.040",
  "l": 5,
  "sl": "Proizvodnja drugih nedestiliranih fermentiranih pijač",
  "en": "Manufacture of other non-distilled fermented beverages",
  "p": "C11.04"
 },
 {
  "c": "C11.05",
  "l": 4,
  "sl": "Proizvodnja piva",
  "en": "Manufacture of beer",
  "p": "C11.0"
 },
 {
  "c": "C11.050",
  "l": 5,
  "sl": "Proizvodnja piva",
  "en": "Manufacture of beer",
  "p": "C11.05"
 },
 {
  "c": "C11.06",
  "l": 4,
  "sl": "Proizvodnja slada",
  "en": "Manufacture of malt",
  "p": "C11.0"
 },
 {
  "c": "C11.060",
  "l": 5,
  "sl": "Proizvodnja slada",
  "en": "Manufacture of malt",
  "p": "C11.06"
 },
 {
  "c": "C11.07",
  "l": 4,
  "sl": "Proizvodnja brezalkoholnih pijač in stekleničenih vod",
  "en": "Manufacture of soft drinks and bottled waters",
  "p": "C11.0"
 },
 {
  "c": "C11.070",
  "l": 5,
  "sl": "Proizvodnja brezalkoholnih pijač in stekleničenih vod",
  "en": "Manufacture of soft drinks and bottled waters",
  "p": "C11.07"
 },
 {
  "c": "C12",
  "l": 2,
  "sl": "Proizvodnja tobačnih izdelkov",
  "en": "Manufacture of tobacco products",
  "p": "C"
 },
 {
  "c": "C12.0",
  "l": 3,
  "sl": "Proizvodnja tobačnih izdelkov",
  "en": "Manufacture of tobacco products",
  "p": "C12"
 },
 {
  "c": "C12.00",
  "l": 4,
  "sl": "Proizvodnja tobačnih izdelkov",
  "en": "Manufacture of tobacco products",
  "p": "C12.0"
 },
 {
  "c": "C12.000",
  "l": 5,
  "sl": "Proizvodnja tobačnih izdelkov",
  "en": "Manufacture of tobacco products",
  "p": "C12.00"
 },
 {
  "c": "C13",
  "l": 2,
  "sl": "Proizvodnja tekstilij",
  "en": "Manufacture of textiles",
  "p": "C"
 },
 {
  "c": "C13.1",
  "l": 3,
  "sl": "Priprava in predenje tekstilnih vlaken",
  "en": "Preparation and spinning of textile fibres",
  "p": "C13"
 },
 {
  "c": "C13.10",
  "l": 4,
  "sl": "Priprava in predenje tekstilnih vlaken",
  "en": "Preparation and spinning of textile fibres",
  "p": "C13.1"
 },
 {
  "c": "C13.100",
  "l": 5,
  "sl": "Priprava in predenje tekstilnih vlaken",
  "en": "Preparation and spinning of textile fibres",
  "p": "C13.10"
 },
 {
  "c": "C13.2",
  "l": 3,
  "sl": "Tkanje tekstilij",
  "en": "Weaving of textiles",
  "p": "C13"
 },
 {
  "c": "C13.20",
  "l": 4,
  "sl": "Tkanje tekstilij",
  "en": "Weaving of textiles",
  "p": "C13.2"
 },
 {
  "c": "C13.200",
  "l": 5,
  "sl": "Tkanje tekstilij",
  "en": "Weaving of textiles",
  "p": "C13.20"
 },
 {
  "c": "C13.3",
  "l": 3,
  "sl": "Dodelava tekstilij",
  "en": "Finishing of textiles",
  "p": "C13"
 },
 {
  "c": "C13.30",
  "l": 4,
  "sl": "Dodelava tekstilij",
  "en": "Finishing of textiles",
  "p": "C13.3"
 },
 {
  "c": "C13.300",
  "l": 5,
  "sl": "Dodelava tekstilij",
  "en": "Finishing of textiles",
  "p": "C13.30"
 },
 {
  "c": "C13.9",
  "l": 3,
  "sl": "Proizvodnja drugih tekstilij",
  "en": "Manufacture of other textiles",
  "p": "C13"
 },
 {
  "c": "C13.91",
  "l": 4,
  "sl": "Proizvodnja pletenih in kvačkanih materialov",
  "en": "Manufacture of knitted and crocheted fabrics",
  "p": "C13.9"
 },
 {
  "c": "C13.910",
  "l": 5,
  "sl": "Proizvodnja pletenih in kvačkanih materialov",
  "en": "Manufacture of knitted and crocheted fabrics",
  "p": "C13.91"
 },
 {
  "c": "C13.92",
  "l": 4,
  "sl": "Proizvodnja gospodinjskih tekstilij in gotovih izdelkov za notranjo opremo",
  "en": "Manufacture of household textiles and made-up furnishing articles",
  "p": "C13.9"
 },
 {
  "c": "C13.920",
  "l": 5,
  "sl": "Proizvodnja gospodinjskih tekstilij in gotovih izdelkov za notranjo opremo",
  "en": "Manufacture of household textiles and made-up furnishing articles",
  "p": "C13.92"
 },
 {
  "c": "C13.93",
  "l": 4,
  "sl": "Proizvodnja preprog",
  "en": "Manufacture of carpets and rugs",
  "p": "C13.9"
 },
 {
  "c": "C13.930",
  "l": 5,
  "sl": "Proizvodnja preprog",
  "en": "Manufacture of carpets and rugs",
  "p": "C13.93"
 },
 {
  "c": "C13.94",
  "l": 4,
  "sl": "Proizvodnja vrvi, vrvic in mrež",
  "en": "Manufacture of cordage, rope, twine and netting",
  "p": "C13.9"
 },
 {
  "c": "C13.940",
  "l": 5,
  "sl": "Proizvodnja vrvi, vrvic in mrež",
  "en": "Manufacture of cordage, rope, twine and netting",
  "p": "C13.94"
 },
 {
  "c": "C13.95",
  "l": 4,
  "sl": "Proizvodnja netkanih tekstilij in izdelkov",
  "en": "Manufacture of non-wovens and non-woven articles",
  "p": "C13.9"
 },
 {
  "c": "C13.950",
  "l": 5,
  "sl": "Proizvodnja netkanih tekstilij in izdelkov",
  "en": "Manufacture of non-wovens and non-woven articles",
  "p": "C13.95"
 },
 {
  "c": "C13.96",
  "l": 4,
  "sl": "Proizvodnja tehničnega in industrijskega tekstila",
  "en": "Manufacture of other technical and industrial textiles",
  "p": "C13.9"
 },
 {
  "c": "C13.960",
  "l": 5,
  "sl": "Proizvodnja tehničnega in industrijskega tekstila",
  "en": "Manufacture of other technical and industrial textiles",
  "p": "C13.96"
 },
 {
  "c": "C13.99",
  "l": 4,
  "sl": "Proizvodnja tekstilij, d. n.",
  "en": "Manufacture of other textiles n.e.c.",
  "p": "C13.9"
 },
 {
  "c": "C13.990",
  "l": 5,
  "sl": "Proizvodnja tekstilij, d. n.",
  "en": "Manufacture of other textiles n.e.c.",
  "p": "C13.99"
 },
 {
  "c": "C14",
  "l": 2,
  "sl": "Proizvodnja oblačil",
  "en": "Manufacture of wearing apparel",
  "p": "C"
 },
 {
  "c": "C14.1",
  "l": 3,
  "sl": "Proizvodnja pletenih in kvačkanih oblačil",
  "en": "Manufacture of knitted and crocheted apparel",
  "p": "C14"
 },
 {
  "c": "C14.10",
  "l": 4,
  "sl": "Proizvodnja pletenih in kvačkanih oblačil",
  "en": "Manufacture of knitted and crocheted apparel",
  "p": "C14.1"
 },
 {
  "c": "C14.100",
  "l": 5,
  "sl": "Proizvodnja pletenih in kvačkanih oblačil",
  "en": "Manufacture of knitted and crocheted apparel",
  "p": "C14.10"
 },
 {
  "c": "C14.2",
  "l": 3,
  "sl": "Proizvodnja drugih oblačil, pokrival in dodatkov",
  "en": "Manufacture of other wearing apparel and accessories",
  "p": "C14"
 },
 {
  "c": "C14.21",
  "l": 4,
  "sl": "Proizvodnja vrhnjih oblačil",
  "en": "Manufacture of outerwear",
  "p": "C14.2"
 },
 {
  "c": "C14.210",
  "l": 5,
  "sl": "Proizvodnja vrhnjih oblačil",
  "en": "Manufacture of outerwear",
  "p": "C14.21"
 },
 {
  "c": "C14.22",
  "l": 4,
  "sl": "Proizvodnja spodnjega perila",
  "en": "Manufacture of underwear",
  "p": "C14.2"
 },
 {
  "c": "C14.220",
  "l": 5,
  "sl": "Proizvodnja spodnjega perila",
  "en": "Manufacture of underwear",
  "p": "C14.22"
 },
 {
  "c": "C14.23",
  "l": 4,
  "sl": "Proizvodnja delovnih oblačil",
  "en": "Manufacture of workwear",
  "p": "C14.2"
 },
 {
  "c": "C14.230",
  "l": 5,
  "sl": "Proizvodnja delovnih oblačil",
  "en": "Manufacture of workwear",
  "p": "C14.23"
 },
 {
  "c": "C14.24",
  "l": 4,
  "sl": "Proizvodnja usnjenih in krznenih oblačil",
  "en": "Manufacture of leather clothes and fur apparel",
  "p": "C14.2"
 },
 {
  "c": "C14.240",
  "l": 5,
  "sl": "Proizvodnja usnjenih in krznenih oblačil",
  "en": "Manufacture of leather clothes and fur apparel",
  "p": "C14.24"
 },
 {
  "c": "C14.29",
  "l": 4,
  "sl": "Proizvodnja drugih oblačil, pokrival in dodatkov, d. n.",
  "en": "Manufacture of other wearing apparel and accessories n.e.c.",
  "p": "C14.2"
 },
 {
  "c": "C14.290",
  "l": 5,
  "sl": "Proizvodnja drugih oblačil, pokrival in dodatkov, d. n.",
  "en": "Manufacture of other wearing apparel and accessories n.e.c.",
  "p": "C14.29"
 },
 {
  "c": "C15",
  "l": 2,
  "sl": "Proizvodnja usnja, usnjenih in sorodnih izdelkov iz drugih materialov",
  "en": "Manufacture of leather and related products of other materials",
  "p": "C"
 },
 {
  "c": "C15.1",
  "l": 3,
  "sl": "Strojenje in dodelava usnja in krzna, proizvodnja potovalne galanterije in sedlarskih izdelkov",
  "en": "Tanning, dyeing, dressing of leather and fur, manufacture of luggage, handbags, saddlery and harness",
  "p": "C15"
 },
 {
  "c": "C15.11",
  "l": 4,
  "sl": "Strojenje in dodelava usnja in krzna",
  "en": "Tanning, dressing, dyeing of leather and fur",
  "p": "C15.1"
 },
 {
  "c": "C15.110",
  "l": 5,
  "sl": "Strojenje in dodelava usnja in krzna",
  "en": "Tanning, dressing, dyeing of leather and fur",
  "p": "C15.11"
 },
 {
  "c": "C15.12",
  "l": 4,
  "sl": "Proizvodnja potovalne galanterije in sedlarskih izdelkov iz katerega koli materiala",
  "en": "Manufacture of luggage, handbags, saddlery and harness of any material",
  "p": "C15.1"
 },
 {
  "c": "C15.120",
  "l": 5,
  "sl": "Proizvodnja potovalne galanterije in sedlarskih izdelkov iz katerega koli materiala",
  "en": "Manufacture of luggage, handbags, saddlery and harness of any material",
  "p": "C15.12"
 },
 {
  "c": "C15.2",
  "l": 3,
  "sl": "Proizvodnja obutve",
  "en": "Manufacture of footwear",
  "p": "C15"
 },
 {
  "c": "C15.20",
  "l": 4,
  "sl": "Proizvodnja obutve",
  "en": "Manufacture of footwear",
  "p": "C15.2"
 },
 {
  "c": "C15.200",
  "l": 5,
  "sl": "Proizvodnja obutve",
  "en": "Manufacture of footwear",
  "p": "C15.20"
 },
 {
  "c": "C16",
  "l": 2,
  "sl": "Proizvodnja lesa ter lesenih in plutovinastih izdelkov, razen pohištva, proizvodnja slamnatih in pletarskih izdelkov",
  "en": "Manufacture of wood and of products of wood and cork, except furniture, manufacture of articles of straw and plaiting materials",
  "p": "C"
 },
 {
  "c": "C16.1",
  "l": 3,
  "sl": "Žaganje in skobljanje lesa, predelava in dodelava lesa",
  "en": "Sawmilling and planing of wood, processing and finishing of wood",
  "p": "C16"
 },
 {
  "c": "C16.11",
  "l": 4,
  "sl": "Žaganje in skobljanje lesa",
  "en": "Sawmilling and planing of wood",
  "p": "C16.1"
 },
 {
  "c": "C16.110",
  "l": 5,
  "sl": "Žaganje in skobljanje lesa",
  "en": "Sawmilling and planing of wood",
  "p": "C16.11"
 },
 {
  "c": "C16.12",
  "l": 4,
  "sl": "Predelava in dodelava lesa",
  "en": "Processing and finishing of wood",
  "p": "C16.1"
 },
 {
  "c": "C16.120",
  "l": 5,
  "sl": "Predelava in dodelava lesa",
  "en": "Processing and finishing of wood",
  "p": "C16.12"
 },
 {
  "c": "C16.2",
  "l": 3,
  "sl": "Proizvodnja lesenih, plutovinastih, slamnatih in pletarskih izdelkov",
  "en": "Manufacture of products of wood, cork, straw and plaiting materials",
  "p": "C16"
 },
 {
  "c": "C16.21",
  "l": 4,
  "sl": "Proizvodnja furnirja in plošč na osnovi lesa",
  "en": "Manufacture of veneer sheets and wood-based panels",
  "p": "C16.2"
 },
 {
  "c": "C16.210",
  "l": 5,
  "sl": "Proizvodnja furnirja in plošč na osnovi lesa",
  "en": "Manufacture of veneer sheets and wood-based panels",
  "p": "C16.21"
 },
 {
  "c": "C16.22",
  "l": 4,
  "sl": "Proizvodnja sestavljenega parketa",
  "en": "Manufacture of assembled parquet floors",
  "p": "C16.2"
 },
 {
  "c": "C16.220",
  "l": 5,
  "sl": "Proizvodnja sestavljenega parketa",
  "en": "Manufacture of assembled parquet floors",
  "p": "C16.22"
 },
 {
  "c": "C16.23",
  "l": 4,
  "sl": "Stavbno mizarstvo in tesarstvo",
  "en": "Manufacture of other builders' carpentry and joinery",
  "p": "C16.2"
 },
 {
  "c": "C16.230",
  "l": 5,
  "sl": "Stavbno mizarstvo in tesarstvo",
  "en": "Manufacture of other builders' carpentry and joinery",
  "p": "C16.23"
 },
 {
  "c": "C16.24",
  "l": 4,
  "sl": "Proizvodnja lesene embalaže",
  "en": "Manufacture of wooden containers",
  "p": "C16.2"
 },
 {
  "c": "C16.240",
  "l": 5,
  "sl": "Proizvodnja lesene embalaže",
  "en": "Manufacture of wooden containers",
  "p": "C16.24"
 },
 {
  "c": "C16.25",
  "l": 4,
  "sl": "Proizvodnja lesenih vrat in oken",
  "en": "Manufacture of doors and windows of wood",
  "p": "C16.2"
 },
 {
  "c": "C16.250",
  "l": 5,
  "sl": "Proizvodnja lesenih vrat in oken",
  "en": "Manufacture of doors and windows of wood",
  "p": "C16.25"
 },
 {
  "c": "C16.26",
  "l": 4,
  "sl": "Proizvodnja trdnih goriv iz rastlinske biomase",
  "en": "Manufacture of solid fuels from vegetable biomass",
  "p": "C16.2"
 },
 {
  "c": "C16.260",
  "l": 5,
  "sl": "Proizvodnja trdnih goriv iz rastlinske biomase",
  "en": "Manufacture of solid fuels from vegetable biomass",
  "p": "C16.26"
 },
 {
  "c": "C16.27",
  "l": 4,
  "sl": "Dodelava lesenih izdelkov",
  "en": "Finishing of wooden products",
  "p": "C16.2"
 },
 {
  "c": "C16.270",
  "l": 5,
  "sl": "Dodelava lesenih izdelkov",
  "en": "Finishing of wooden products",
  "p": "C16.27"
 },
 {
  "c": "C16.28",
  "l": 4,
  "sl": "Proizvodnja drugih lesenih, plutovinastih, slamnatih in pletarskih izdelkov",
  "en": "Manufacture of other products of wood and articles of cork, straw and plaiting materials",
  "p": "C16.2"
 },
 {
  "c": "C16.280",
  "l": 5,
  "sl": "Proizvodnja drugih lesenih, plutovinastih, slamnatih in pletarskih izdelkov",
  "en": "Manufacture of other products of wood and articles of cork, straw and plaiting materials",
  "p": "C16.28"
 },
 {
  "c": "C17",
  "l": 2,
  "sl": "Proizvodnja papirja in izdelkov iz papirja",
  "en": "Manufacture of paper and paper products",
  "p": "C"
 },
 {
  "c": "C17.1",
  "l": 3,
  "sl": "Proizvodnja vlaknin, papirja in kartona",
  "en": "Manufacture of pulp, paper and paperboard",
  "p": "C17"
 },
 {
  "c": "C17.11",
  "l": 4,
  "sl": "Proizvodnja vlaknin",
  "en": "Manufacture of pulp",
  "p": "C17.1"
 },
 {
  "c": "C17.110",
  "l": 5,
  "sl": "Proizvodnja vlaknin",
  "en": "Manufacture of pulp",
  "p": "C17.11"
 },
 {
  "c": "C17.12",
  "l": 4,
  "sl": "Proizvodnja papirja in kartona",
  "en": "Manufacture of paper and paperboard",
  "p": "C17.1"
 },
 {
  "c": "C17.120",
  "l": 5,
  "sl": "Proizvodnja papirja in kartona",
  "en": "Manufacture of paper and paperboard",
  "p": "C17.12"
 },
 {
  "c": "C17.2",
  "l": 3,
  "sl": "Proizvodnja izdelkov iz papirja in kartona",
  "en": "Manufacture of articles of paper and paperboard",
  "p": "C17"
 },
 {
  "c": "C17.21",
  "l": 4,
  "sl": "Proizvodnja valovitega papirja, kartona ter papirne in kartonske embalaže",
  "en": "Manufacture of corrugated paper, paperboard and containers of paper and paperboard",
  "p": "C17.2"
 },
 {
  "c": "C17.210",
  "l": 5,
  "sl": "Proizvodnja valovitega papirja, kartona ter papirne in kartonske embalaže",
  "en": "Manufacture of corrugated paper, paperboard and containers of paper and paperboard",
  "p": "C17.21"
 },
 {
  "c": "C17.22",
  "l": 4,
  "sl": "Proizvodnja gospodinjskih, higienskih in toaletnih potrebščin iz papirja",
  "en": "Manufacture of household and sanitary goods and of toilet requisites",
  "p": "C17.2"
 },
 {
  "c": "C17.220",
  "l": 5,
  "sl": "Proizvodnja gospodinjskih, higienskih in toaletnih potrebščin iz papirja",
  "en": "Manufacture of household and sanitary goods and of toilet requisites",
  "p": "C17.22"
 },
 {
  "c": "C17.23",
  "l": 4,
  "sl": "Proizvodnja pisarniških potrebščin iz papirja",
  "en": "Manufacture of paper stationery",
  "p": "C17.2"
 },
 {
  "c": "C17.230",
  "l": 5,
  "sl": "Proizvodnja pisarniških potrebščin iz papirja",
  "en": "Manufacture of paper stationery",
  "p": "C17.23"
 },
 {
  "c": "C17.24",
  "l": 4,
  "sl": "Proizvodnja tapet",
  "en": "Manufacture of wallpaper",
  "p": "C17.2"
 },
 {
  "c": "C17.240",
  "l": 5,
  "sl": "Proizvodnja tapet",
  "en": "Manufacture of wallpaper",
  "p": "C17.24"
 },
 {
  "c": "C17.25",
  "l": 4,
  "sl": "Proizvodnja drugih izdelkov iz papirja in kartona",
  "en": "Manufacture of other articles of paper and paperboard",
  "p": "C17.2"
 },
 {
  "c": "C17.250",
  "l": 5,
  "sl": "Proizvodnja drugih izdelkov iz papirja in kartona",
  "en": "Manufacture of other articles of paper and paperboard",
  "p": "C17.25"
 },
 {
  "c": "C18",
  "l": 2,
  "sl": "Tiskarstvo in razmnoževanje posnetih nosilcev zapisa",
  "en": "Printing and reproduction of recorded media",
  "p": "C"
 },
 {
  "c": "C18.1",
  "l": 3,
  "sl": "Tiskarstvo in z njim povezane storitve",
  "en": "Printing and service activities related to printing",
  "p": "C18"
 },
 {
  "c": "C18.11",
  "l": 4,
  "sl": "Tiskanje časopisov",
  "en": "Printing of newspapers",
  "p": "C18.1"
 },
 {
  "c": "C18.110",
  "l": 5,
  "sl": "Tiskanje časopisov",
  "en": "Printing of newspapers",
  "p": "C18.11"
 },
 {
  "c": "C18.12",
  "l": 4,
  "sl": "Drugo tiskanje",
  "en": "Other printing",
  "p": "C18.1"
 },
 {
  "c": "C18.120",
  "l": 5,
  "sl": "Drugo tiskanje",
  "en": "Other printing",
  "p": "C18.12"
 },
 {
  "c": "C18.13",
  "l": 4,
  "sl": "Priprava za tisk in objavo",
  "en": "Pre-press and pre-media services",
  "p": "C18.1"
 },
 {
  "c": "C18.130",
  "l": 5,
  "sl": "Priprava za tisk in objavo",
  "en": "Pre-press and pre-media services",
  "p": "C18.13"
 },
 {
  "c": "C18.14",
  "l": 4,
  "sl": "Knjigoveštvo in sorodne dejavnosti",
  "en": "Binding and related services",
  "p": "C18.1"
 },
 {
  "c": "C18.140",
  "l": 5,
  "sl": "Knjigoveštvo in sorodne dejavnosti",
  "en": "Binding and related services",
  "p": "C18.14"
 },
 {
  "c": "C18.2",
  "l": 3,
  "sl": "Razmnoževanje posnetih nosilcev zapisa",
  "en": "Reproduction of recorded media",
  "p": "C18"
 },
 {
  "c": "C18.20",
  "l": 4,
  "sl": "Razmnoževanje posnetih nosilcev zapisa",
  "en": "Reproduction of recorded media",
  "p": "C18.2"
 },
 {
  "c": "C18.200",
  "l": 5,
  "sl": "Razmnoževanje posnetih nosilcev zapisa",
  "en": "Reproduction of recorded media",
  "p": "C18.20"
 },
 {
  "c": "C19",
  "l": 2,
  "sl": "Proizvodnja koksa in rafiniranih naftnih proizvodov",
  "en": "Manufacture of coke and refined petroleum products",
  "p": "C"
 },
 {
  "c": "C19.1",
  "l": 3,
  "sl": "Proizvodnja koksa",
  "en": "Manufacture of coke oven products",
  "p": "C19"
 },
 {
  "c": "C19.10",
  "l": 4,
  "sl": "Proizvodnja koksa",
  "en": "Manufacture of coke oven products",
  "p": "C19.1"
 },
 {
  "c": "C19.100",
  "l": 5,
  "sl": "Proizvodnja koksa",
  "en": "Manufacture of coke oven products",
  "p": "C19.10"
 },
 {
  "c": "C19.2",
  "l": 3,
  "sl": "Proizvodnja rafiniranih naftnih proizvodov in proizvodov iz fosilnih goriv",
  "en": "Manufacture of refined petroleum products and fossil fuel products",
  "p": "C19"
 },
 {
  "c": "C19.20",
  "l": 4,
  "sl": "Proizvodnja rafiniranih naftnih proizvodov in proizvodov iz fosilnih goriv",
  "en": "Manufacture of refined petroleum products and fossil fuel products",
  "p": "C19.2"
 },
 {
  "c": "C19.200",
  "l": 5,
  "sl": "Proizvodnja rafiniranih naftnih proizvodov in proizvodov iz fosilnih goriv",
  "en": "Manufacture of refined petroleum products and fossil fuel products",
  "p": "C19.20"
 },
 {
  "c": "C20",
  "l": 2,
  "sl": "Proizvodnja kemikalij in kemičnih izdelkov",
  "en": "Manufacture of chemicals and chemical products",
  "p": "C"
 },
 {
  "c": "C20.1",
  "l": 3,
  "sl": "Proizvodnja osnovnih kemikalij, gnojil in dušikovih spojin ter plastike in sintetičnega kavčuka v primarni obliki",
  "en": "Manufacture of basic chemicals, fertilisers and nitrogen compounds, plastics and synthetic rubber in primary forms",
  "p": "C20"
 },
 {
  "c": "C20.11",
  "l": 4,
  "sl": "Proizvodnja tehničnih plinov",
  "en": "Manufacture of industrial gases",
  "p": "C20.1"
 },
 {
  "c": "C20.110",
  "l": 5,
  "sl": "Proizvodnja tehničnih plinov",
  "en": "Manufacture of industrial gases",
  "p": "C20.11"
 },
 {
  "c": "C20.12",
  "l": 4,
  "sl": "Proizvodnja barvil in pigmentov",
  "en": "Manufacture of dyes and pigments",
  "p": "C20.1"
 },
 {
  "c": "C20.120",
  "l": 5,
  "sl": "Proizvodnja barvil in pigmentov",
  "en": "Manufacture of dyes and pigments",
  "p": "C20.12"
 },
 {
  "c": "C20.13",
  "l": 4,
  "sl": "Proizvodnja drugih anorganskih osnovnih kemikalij",
  "en": "Manufacture of other inorganic basic chemicals",
  "p": "C20.1"
 },
 {
  "c": "C20.130",
  "l": 5,
  "sl": "Proizvodnja drugih anorganskih osnovnih kemikalij",
  "en": "Manufacture of other inorganic basic chemicals",
  "p": "C20.13"
 },
 {
  "c": "C20.14",
  "l": 4,
  "sl": "Proizvodnja drugih organskih osnovnih kemikalij",
  "en": "Manufacture of other organic basic chemicals",
  "p": "C20.1"
 },
 {
  "c": "C20.140",
  "l": 5,
  "sl": "Proizvodnja drugih organskih osnovnih kemikalij",
  "en": "Manufacture of other organic basic chemicals",
  "p": "C20.14"
 },
 {
  "c": "C20.15",
  "l": 4,
  "sl": "Proizvodnja gnojil in dušikovih spojin",
  "en": "Manufacture of fertilisers and nitrogen compounds",
  "p": "C20.1"
 },
 {
  "c": "C20.150",
  "l": 5,
  "sl": "Proizvodnja gnojil in dušikovih spojin",
  "en": "Manufacture of fertilisers and nitrogen compounds",
  "p": "C20.15"
 },
 {
  "c": "C20.16",
  "l": 4,
  "sl": "Proizvodnja plastike v primarni obliki",
  "en": "Manufacture of plastics in primary forms",
  "p": "C20.1"
 },
 {
  "c": "C20.160",
  "l": 5,
  "sl": "Proizvodnja plastike v primarni obliki",
  "en": "Manufacture of plastics in primary forms",
  "p": "C20.16"
 },
 {
  "c": "C20.17",
  "l": 4,
  "sl": "Proizvodnja sintetičnega kavčuka v primarni obliki",
  "en": "Manufacture of synthetic rubber in primary forms",
  "p": "C20.1"
 },
 {
  "c": "C20.170",
  "l": 5,
  "sl": "Proizvodnja sintetičnega kavčuka v primarni obliki",
  "en": "Manufacture of synthetic rubber in primary forms",
  "p": "C20.17"
 },
 {
  "c": "C20.2",
  "l": 3,
  "sl": "Proizvodnja pesticidov, razkužil in drugih agrokemičnih izdelkov",
  "en": "Manufacture of pesticides, disinfectants and other agrochemical products",
  "p": "C20"
 },
 {
  "c": "C20.20",
  "l": 4,
  "sl": "Proizvodnja pesticidov, razkužil in drugih agrokemičnih izdelkov",
  "en": "Manufacture of pesticides, disinfectants and other agrochemical products",
  "p": "C20.2"
 },
 {
  "c": "C20.200",
  "l": 5,
  "sl": "Proizvodnja pesticidov, razkužil in drugih agrokemičnih izdelkov",
  "en": "Manufacture of pesticides, disinfectants and other agrochemical products",
  "p": "C20.20"
 },
 {
  "c": "C20.3",
  "l": 3,
  "sl": "Proizvodnja barv, lakov in podobnih premazov, tiskarskih barv in kitov",
  "en": "Manufacture of paints, varnishes and similar coatings, printing ink and mastics",
  "p": "C20"
 },
 {
  "c": "C20.30",
  "l": 4,
  "sl": "Proizvodnja barv, lakov in podobnih premazov, tiskarskih barv in kitov",
  "en": "Manufacture of paints, varnishes and similar coatings, printing ink and mastics",
  "p": "C20.3"
 },
 {
  "c": "C20.300",
  "l": 5,
  "sl": "Proizvodnja barv, lakov in podobnih premazov, tiskarskih barv in kitov",
  "en": "Manufacture of paints, varnishes and similar coatings, printing ink and mastics",
  "p": "C20.30"
 },
 {
  "c": "C20.4",
  "l": 3,
  "sl": "Proizvodnja pralnih, čistilnih in polirnih sredstev",
  "en": "Manufacture of washing, cleaning and polishing preparations",
  "p": "C20"
 },
 {
  "c": "C20.41",
  "l": 4,
  "sl": "Proizvodnja mil in pralnih sredstev, čistilnih in polirnih sredstev",
  "en": "Manufacture of soap and detergents, cleaning and polishing preparations",
  "p": "C20.4"
 },
 {
  "c": "C20.410",
  "l": 5,
  "sl": "Proizvodnja mil in pralnih sredstev, čistilnih in polirnih sredstev",
  "en": "Manufacture of soap and detergents, cleaning and polishing preparations",
  "p": "C20.41"
 },
 {
  "c": "C20.42",
  "l": 4,
  "sl": "Proizvodnja parfumov in toaletnih sredstev",
  "en": "Manufacture of perfumes and toilet preparations",
  "p": "C20.4"
 },
 {
  "c": "C20.420",
  "l": 5,
  "sl": "Proizvodnja parfumov in toaletnih sredstev",
  "en": "Manufacture of perfumes and toilet preparations",
  "p": "C20.42"
 },
 {
  "c": "C20.5",
  "l": 3,
  "sl": "Proizvodnja drugih kemičnih izdelkov",
  "en": "Manufacture of other chemical products",
  "p": "C20"
 },
 {
  "c": "C20.51",
  "l": 4,
  "sl": "Proizvodnja tekočih biogoriv",
  "en": "Manufacture of liquid biofuels",
  "p": "C20.5"
 },
 {
  "c": "C20.510",
  "l": 5,
  "sl": "Proizvodnja tekočih biogoriv",
  "en": "Manufacture of liquid biofuels",
  "p": "C20.51"
 },
 {
  "c": "C20.59",
  "l": 4,
  "sl": "Proizvodnja drugih kemičnih izdelkov, d. n.",
  "en": "Manufacture of other chemical products n.e.c.",
  "p": "C20.5"
 },
 {
  "c": "C20.590",
  "l": 5,
  "sl": "Proizvodnja drugih kemičnih izdelkov, d. n.",
  "en": "Manufacture of other chemical products n.e.c.",
  "p": "C20.59"
 },
 {
  "c": "C20.6",
  "l": 3,
  "sl": "Proizvodnja umetnih vlaken",
  "en": "Manufacture of man-made fibres",
  "p": "C20"
 },
 {
  "c": "C20.60",
  "l": 4,
  "sl": "Proizvodnja umetnih vlaken",
  "en": "Manufacture of man-made fibres",
  "p": "C20.6"
 },
 {
  "c": "C20.600",
  "l": 5,
  "sl": "Proizvodnja umetnih vlaken",
  "en": "Manufacture of man-made fibres",
  "p": "C20.60"
 },
 {
  "c": "C21",
  "l": 2,
  "sl": "Proizvodnja farmacevtskih surovin in preparatov",
  "en": "Manufacture of basic pharmaceutical products and pharmaceutical preparations",
  "p": "C"
 },
 {
  "c": "C21.1",
  "l": 3,
  "sl": "Proizvodnja farmacevtskih surovin",
  "en": "Manufacture of basic pharmaceutical products",
  "p": "C21"
 },
 {
  "c": "C21.10",
  "l": 4,
  "sl": "Proizvodnja farmacevtskih surovin",
  "en": "Manufacture of basic pharmaceutical products",
  "p": "C21.1"
 },
 {
  "c": "C21.100",
  "l": 5,
  "sl": "Proizvodnja farmacevtskih surovin",
  "en": "Manufacture of basic pharmaceutical products",
  "p": "C21.10"
 },
 {
  "c": "C21.2",
  "l": 3,
  "sl": "Proizvodnja farmacevtskih preparatov",
  "en": "Manufacture of pharmaceutical preparations",
  "p": "C21"
 },
 {
  "c": "C21.20",
  "l": 4,
  "sl": "Proizvodnja farmacevtskih preparatov",
  "en": "Manufacture of pharmaceutical preparations",
  "p": "C21.2"
 },
 {
  "c": "C21.200",
  "l": 5,
  "sl": "Proizvodnja farmacevtskih preparatov",
  "en": "Manufacture of pharmaceutical preparations",
  "p": "C21.20"
 },
 {
  "c": "C22",
  "l": 2,
  "sl": "Proizvodnja gumenih in plastičnih izdelkov",
  "en": "Manufacture of rubber and plastic products",
  "p": "C"
 },
 {
  "c": "C22.1",
  "l": 3,
  "sl": "Proizvodnja gumenih izdelkov",
  "en": "Manufacture of rubber products",
  "p": "C22"
 },
 {
  "c": "C22.11",
  "l": 4,
  "sl": "Proizvodnja in obnavljanje zračnic za vozila in proizvodnja gumijastih plaščev",
  "en": "Manufacture, retreading and rebuilding of rubber tyres and manufacture of tubes",
  "p": "C22.1"
 },
 {
  "c": "C22.110",
  "l": 5,
  "sl": "Proizvodnja in obnavljanje zračnic za vozila in proizvodnja gumijastih plaščev",
  "en": "Manufacture, retreading and rebuilding of rubber tyres and manufacture of tubes",
  "p": "C22.11"
 },
 {
  "c": "C22.12",
  "l": 4,
  "sl": "Proizvodnja drugih gumenih izdelkov",
  "en": "Manufacture of other rubber products",
  "p": "C22.1"
 },
 {
  "c": "C22.120",
  "l": 5,
  "sl": "Proizvodnja drugih gumenih izdelkov",
  "en": "Manufacture of other rubber products",
  "p": "C22.12"
 },
 {
  "c": "C22.2",
  "l": 3,
  "sl": "Proizvodnja plastičnih izdelkov",
  "en": "Manufacture of plastic products",
  "p": "C22"
 },
 {
  "c": "C22.21",
  "l": 4,
  "sl": "Proizvodnja plastičnih plošč, folij, cevi in profilov",
  "en": "Manufacture of plastic plates, sheets, tubes and profiles",
  "p": "C22.2"
 },
 {
  "c": "C22.210",
  "l": 5,
  "sl": "Proizvodnja plastičnih plošč, folij, cevi in profilov",
  "en": "Manufacture of plastic plates, sheets, tubes and profiles",
  "p": "C22.21"
 },
 {
  "c": "C22.22",
  "l": 4,
  "sl": "Proizvodnja plastične embalaže",
  "en": "Manufacture of plastic packing goods",
  "p": "C22.2"
 },
 {
  "c": "C22.220",
  "l": 5,
  "sl": "Proizvodnja plastične embalaže",
  "en": "Manufacture of plastic packing goods",
  "p": "C22.22"
 },
 {
  "c": "C22.23",
  "l": 4,
  "sl": "Proizvodnja plastičnih vrat in oken",
  "en": "Manufacture of doors and windows of plastic",
  "p": "C22.2"
 },
 {
  "c": "C22.230",
  "l": 5,
  "sl": "Proizvodnja plastičnih vrat in oken",
  "en": "Manufacture of doors and windows of plastic",
  "p": "C22.23"
 },
 {
  "c": "C22.24",
  "l": 4,
  "sl": "Proizvodnja plastičnih izdelkov za gradbeništvo",
  "en": "Manufacture of builders’ ware of plastic",
  "p": "C22.2"
 },
 {
  "c": "C22.240",
  "l": 5,
  "sl": "Proizvodnja plastičnih izdelkov za gradbeništvo",
  "en": "Manufacture of builders’ ware of plastic",
  "p": "C22.24"
 },
 {
  "c": "C22.25",
  "l": 4,
  "sl": "Predelava in dodelava plastičnih izdelkov",
  "en": "Processing and finishing of plastic products",
  "p": "C22.2"
 },
 {
  "c": "C22.250",
  "l": 5,
  "sl": "Predelava in dodelava plastičnih izdelkov",
  "en": "Processing and finishing of plastic products",
  "p": "C22.25"
 },
 {
  "c": "C22.26",
  "l": 4,
  "sl": "Proizvodnja drugih plastičnih izdelkov",
  "en": "Manufacture of other plastic products",
  "p": "C22.2"
 },
 {
  "c": "C22.260",
  "l": 5,
  "sl": "Proizvodnja drugih plastičnih izdelkov",
  "en": "Manufacture of other plastic products",
  "p": "C22.26"
 },
 {
  "c": "C23",
  "l": 2,
  "sl": "Proizvodnja nekovinskih mineralnih izdelkov",
  "en": "Manufacture of other non-metallic mineral products",
  "p": "C"
 },
 {
  "c": "C23.1",
  "l": 3,
  "sl": "Proizvodnja stekla in steklenih izdelkov",
  "en": "Manufacture of glass and glass products",
  "p": "C23"
 },
 {
  "c": "C23.11",
  "l": 4,
  "sl": "Proizvodnja ravnega stekla",
  "en": "Manufacture of flat glass",
  "p": "C23.1"
 },
 {
  "c": "C23.110",
  "l": 5,
  "sl": "Proizvodnja ravnega stekla",
  "en": "Manufacture of flat glass",
  "p": "C23.11"
 },
 {
  "c": "C23.12",
  "l": 4,
  "sl": "Oblikovanje in obdelava ravnega stekla",
  "en": "Shaping and processing of flat glass",
  "p": "C23.1"
 },
 {
  "c": "C23.120",
  "l": 5,
  "sl": "Oblikovanje in obdelava ravnega stekla",
  "en": "Shaping and processing of flat glass",
  "p": "C23.12"
 },
 {
  "c": "C23.13",
  "l": 4,
  "sl": "Proizvodnja votlega stekla",
  "en": "Manufacture of hollow glass",
  "p": "C23.1"
 },
 {
  "c": "C23.130",
  "l": 5,
  "sl": "Proizvodnja votlega stekla",
  "en": "Manufacture of hollow glass",
  "p": "C23.13"
 },
 {
  "c": "C23.14",
  "l": 4,
  "sl": "Proizvodnja steklenih vlaken",
  "en": "Manufacture of glass fibres",
  "p": "C23.1"
 },
 {
  "c": "C23.140",
  "l": 5,
  "sl": "Proizvodnja steklenih vlaken",
  "en": "Manufacture of glass fibres",
  "p": "C23.14"
 },
 {
  "c": "C23.15",
  "l": 4,
  "sl": "Proizvodnja in oblikovanje drugih vrst stekla ter tehničnih steklenih izdelkov",
  "en": "Manufacture and processing of other glass, including technical glassware",
  "p": "C23.1"
 },
 {
  "c": "C23.150",
  "l": 5,
  "sl": "Proizvodnja in oblikovanje drugih vrst stekla ter tehničnih steklenih izdelkov",
  "en": "Manufacture and processing of other glass, including technical glassware",
  "p": "C23.15"
 },
 {
  "c": "C23.2",
  "l": 3,
  "sl": "Proizvodnja ognjevzdržne keramike",
  "en": "Manufacture of refractory products",
  "p": "C23"
 },
 {
  "c": "C23.20",
  "l": 4,
  "sl": "Proizvodnja ognjevzdržne keramike",
  "en": "Manufacture of refractory products",
  "p": "C23.2"
 },
 {
  "c": "C23.200",
  "l": 5,
  "sl": "Proizvodnja ognjevzdržne keramike",
  "en": "Manufacture of refractory products",
  "p": "C23.20"
 },
 {
  "c": "C23.3",
  "l": 3,
  "sl": "Proizvodnja neognjevzdržne gradbene keramike",
  "en": "Manufacture of clay building materials",
  "p": "C23"
 },
 {
  "c": "C23.31",
  "l": 4,
  "sl": "Proizvodnja keramičnih ploščic in oblog",
  "en": "Manufacture of ceramic tiles and flags",
  "p": "C23.3"
 },
 {
  "c": "C23.310",
  "l": 5,
  "sl": "Proizvodnja keramičnih ploščic in oblog",
  "en": "Manufacture of ceramic tiles and flags",
  "p": "C23.31"
 },
 {
  "c": "C23.32",
  "l": 4,
  "sl": "Proizvodnja strešnikov, opeke in drugih gradbenih izdelkov iz žgane gline",
  "en": "Manufacture of bricks, tiles and construction products, in baked clay",
  "p": "C23.3"
 },
 {
  "c": "C23.320",
  "l": 5,
  "sl": "Proizvodnja strešnikov, opeke in drugih gradbenih izdelkov iz žgane gline",
  "en": "Manufacture of bricks, tiles and construction products, in baked clay",
  "p": "C23.32"
 },
 {
  "c": "C23.4",
  "l": 3,
  "sl": "Proizvodnja drugih izdelkov iz keramike in porcelana",
  "en": "Manufacture of other porcelain and ceramic products",
  "p": "C23"
 },
 {
  "c": "C23.41",
  "l": 4,
  "sl": "Proizvodnja gospodinjske in okrasne keramike",
  "en": "Manufacture of ceramic household and ornamental articles",
  "p": "C23.4"
 },
 {
  "c": "C23.410",
  "l": 5,
  "sl": "Proizvodnja gospodinjske in okrasne keramike",
  "en": "Manufacture of ceramic household and ornamental articles",
  "p": "C23.41"
 },
 {
  "c": "C23.42",
  "l": 4,
  "sl": "Proizvodnja sanitarne keramike",
  "en": "Manufacture of ceramic sanitary fixtures",
  "p": "C23.4"
 },
 {
  "c": "C23.420",
  "l": 5,
  "sl": "Proizvodnja sanitarne keramike",
  "en": "Manufacture of ceramic sanitary fixtures",
  "p": "C23.42"
 },
 {
  "c": "C23.43",
  "l": 4,
  "sl": "Proizvodnja izolatorjev in izolacijskih elementov iz keramike",
  "en": "Manufacture of ceramic insulators and insulating fittings",
  "p": "C23.4"
 },
 {
  "c": "C23.430",
  "l": 5,
  "sl": "Proizvodnja izolatorjev in izolacijskih elementov iz keramike",
  "en": "Manufacture of ceramic insulators and insulating fittings",
  "p": "C23.43"
 },
 {
  "c": "C23.44",
  "l": 4,
  "sl": "Proizvodnja druge tehnične keramike",
  "en": "Manufacture of other technical ceramic products",
  "p": "C23.4"
 },
 {
  "c": "C23.440",
  "l": 5,
  "sl": "Proizvodnja druge tehnične keramike",
  "en": "Manufacture of other technical ceramic products",
  "p": "C23.44"
 },
 {
  "c": "C23.45",
  "l": 4,
  "sl": "Proizvodnja drugih keramičnih izdelkov",
  "en": "Manufacture of other ceramic products",
  "p": "C23.4"
 },
 {
  "c": "C23.450",
  "l": 5,
  "sl": "Proizvodnja drugih keramičnih izdelkov",
  "en": "Manufacture of other ceramic products",
  "p": "C23.45"
 },
 {
  "c": "C23.5",
  "l": 3,
  "sl": "Proizvodnja cementa, apna in mavca",
  "en": "Manufacture of cement, lime and plaster",
  "p": "C23"
 },
 {
  "c": "C23.51",
  "l": 4,
  "sl": "Proizvodnja cementa",
  "en": "Manufacture of cement",
  "p": "C23.5"
 },
 {
  "c": "C23.510",
  "l": 5,
  "sl": "Proizvodnja cementa",
  "en": "Manufacture of cement",
  "p": "C23.51"
 },
 {
  "c": "C23.52",
  "l": 4,
  "sl": "Proizvodnja apna in mavca",
  "en": "Manufacture of lime and plaster",
  "p": "C23.5"
 },
 {
  "c": "C23.520",
  "l": 5,
  "sl": "Proizvodnja apna in mavca",
  "en": "Manufacture of lime and plaster",
  "p": "C23.52"
 },
 {
  "c": "C23.6",
  "l": 3,
  "sl": "Proizvodnja izdelkov iz betona, cementa, mavca",
  "en": "Manufacture of articles of concrete, cement and plaster",
  "p": "C23"
 },
 {
  "c": "C23.61",
  "l": 4,
  "sl": "Proizvodnja betonskih izdelkov za gradbeništvo",
  "en": "Manufacture of concrete products for construction purposes",
  "p": "C23.6"
 },
 {
  "c": "C23.610",
  "l": 5,
  "sl": "Proizvodnja betonskih izdelkov za gradbeništvo",
  "en": "Manufacture of concrete products for construction purposes",
  "p": "C23.61"
 },
 {
  "c": "C23.62",
  "l": 4,
  "sl": "Proizvodnja izdelkov iz mavca za gradbeništvo",
  "en": "Manufacture of plaster products for construction purposes",
  "p": "C23.6"
 },
 {
  "c": "C23.620",
  "l": 5,
  "sl": "Proizvodnja izdelkov iz mavca za gradbeništvo",
  "en": "Manufacture of plaster products for construction purposes",
  "p": "C23.62"
 },
 {
  "c": "C23.63",
  "l": 4,
  "sl": "Proizvodnja sveže betonske mešanice",
  "en": "Manufacture of ready-mixed concrete",
  "p": "C23.6"
 },
 {
  "c": "C23.630",
  "l": 5,
  "sl": "Proizvodnja sveže betonske mešanice",
  "en": "Manufacture of ready-mixed concrete",
  "p": "C23.63"
 },
 {
  "c": "C23.64",
  "l": 4,
  "sl": "Proizvodnja malte",
  "en": "Manufacture of mortars",
  "p": "C23.6"
 },
 {
  "c": "C23.640",
  "l": 5,
  "sl": "Proizvodnja malte",
  "en": "Manufacture of mortars",
  "p": "C23.64"
 },
 {
  "c": "C23.65",
  "l": 4,
  "sl": "Proizvodnja izdelkov iz vlaknatega cementa",
  "en": "Manufacture of fibre cement",
  "p": "C23.6"
 },
 {
  "c": "C23.650",
  "l": 5,
  "sl": "Proizvodnja izdelkov iz vlaknatega cementa",
  "en": "Manufacture of fibre cement",
  "p": "C23.65"
 },
 {
  "c": "C23.66",
  "l": 4,
  "sl": "Proizvodnja drugih izdelkov iz betona, cementa, mavca",
  "en": "Manufacture of other articles of concrete, cement and plaster",
  "p": "C23.6"
 },
 {
  "c": "C23.660",
  "l": 5,
  "sl": "Proizvodnja drugih izdelkov iz betona, cementa, mavca",
  "en": "Manufacture of other articles of concrete, cement and plaster",
  "p": "C23.66"
 },
 {
  "c": "C23.7",
  "l": 3,
  "sl": "Obdelava naravnega kamna",
  "en": "Cutting, shaping and finishing of stone",
  "p": "C23"
 },
 {
  "c": "C23.70",
  "l": 4,
  "sl": "Obdelava naravnega kamna",
  "en": "Cutting, shaping and finishing of stone",
  "p": "C23.7"
 },
 {
  "c": "C23.700",
  "l": 5,
  "sl": "Obdelava naravnega kamna",
  "en": "Cutting, shaping and finishing of stone",
  "p": "C23.70"
 },
 {
  "c": "C23.9",
  "l": 3,
  "sl": "Proizvodnja brusilnih sredstev in nekovinskih mineralnih izdelkov, d. n.",
  "en": "Manufacture of abrasive products and non-metallic mineral products n.e.c.",
  "p": "C23"
 },
 {
  "c": "C23.91",
  "l": 4,
  "sl": "Proizvodnja brusilnih sredstev",
  "en": "Manufacture of abrasive products",
  "p": "C23.9"
 },
 {
  "c": "C23.910",
  "l": 5,
  "sl": "Proizvodnja brusilnih sredstev",
  "en": "Manufacture of abrasive products",
  "p": "C23.91"
 },
 {
  "c": "C23.99",
  "l": 4,
  "sl": "Proizvodnja drugih nekovinskih mineralnih izdelkov, d. n.",
  "en": "Manufacture of other non-metallic mineral products n.e.c.",
  "p": "C23.9"
 },
 {
  "c": "C23.990",
  "l": 5,
  "sl": "Proizvodnja drugih nekovinskih mineralnih izdelkov, d. n.",
  "en": "Manufacture of other non-metallic mineral products n.e.c.",
  "p": "C23.99"
 },
 {
  "c": "C24",
  "l": 2,
  "sl": "Proizvodnja kovin",
  "en": "Manufacture of basic metals",
  "p": "C"
 },
 {
  "c": "C24.1",
  "l": 3,
  "sl": "Proizvodnja surovega železa, jekla, ferozlitin",
  "en": "Manufacture of basic iron and steel and of ferro-alloys",
  "p": "C24"
 },
 {
  "c": "C24.10",
  "l": 4,
  "sl": "Proizvodnja surovega železa, jekla, ferozlitin",
  "en": "Manufacture of basic iron and steel and of ferro-alloys",
  "p": "C24.1"
 },
 {
  "c": "C24.100",
  "l": 5,
  "sl": "Proizvodnja surovega železa, jekla, ferozlitin",
  "en": "Manufacture of basic iron and steel and of ferro-alloys",
  "p": "C24.10"
 },
 {
  "c": "C24.2",
  "l": 3,
  "sl": "Proizvodnja jeklenih cevi, votlih profilov in fitingov",
  "en": "Manufacture of tubes, pipes, hollow profiles and related fittings, of steel",
  "p": "C24"
 },
 {
  "c": "C24.20",
  "l": 4,
  "sl": "Proizvodnja jeklenih cevi, votlih profilov in fitingov",
  "en": "Manufacture of tubes, pipes, hollow profiles and related fittings, of steel",
  "p": "C24.2"
 },
 {
  "c": "C24.200",
  "l": 5,
  "sl": "Proizvodnja jeklenih cevi, votlih profilov in fitingov",
  "en": "Manufacture of tubes, pipes, hollow profiles and related fittings, of steel",
  "p": "C24.20"
 },
 {
  "c": "C24.3",
  "l": 3,
  "sl": "Druga primarna predelava železa in jekla",
  "en": "Manufacture of other products of first processing of steel",
  "p": "C24"
 },
 {
  "c": "C24.31",
  "l": 4,
  "sl": "Hladno vlečenje profilov",
  "en": "Cold drawing of bars",
  "p": "C24.3"
 },
 {
  "c": "C24.310",
  "l": 5,
  "sl": "Hladno vlečenje profilov",
  "en": "Cold drawing of bars",
  "p": "C24.31"
 },
 {
  "c": "C24.32",
  "l": 4,
  "sl": "Hladno valjanje traku",
  "en": "Cold rolling of narrow strip",
  "p": "C24.3"
 },
 {
  "c": "C24.320",
  "l": 5,
  "sl": "Hladno valjanje traku",
  "en": "Cold rolling of narrow strip",
  "p": "C24.32"
 },
 {
  "c": "C24.33",
  "l": 4,
  "sl": "Hladno oblikovanje profilov in pregibanje",
  "en": "Cold forming or folding",
  "p": "C24.3"
 },
 {
  "c": "C24.330",
  "l": 5,
  "sl": "Hladno oblikovanje profilov in pregibanje",
  "en": "Cold forming or folding",
  "p": "C24.33"
 },
 {
  "c": "C24.34",
  "l": 4,
  "sl": "Hladno vlečenje žice",
  "en": "Cold drawing of wire",
  "p": "C24.3"
 },
 {
  "c": "C24.340",
  "l": 5,
  "sl": "Hladno vlečenje žice",
  "en": "Cold drawing of wire",
  "p": "C24.34"
 },
 {
  "c": "C24.4",
  "l": 3,
  "sl": "Proizvodnja plemenitih in drugih neželeznih kovin",
  "en": "Manufacture of basic precious and other non-ferrous metals",
  "p": "C24"
 },
 {
  "c": "C24.41",
  "l": 4,
  "sl": "Proizvodnja plemenitih kovin",
  "en": "Precious metals production",
  "p": "C24.4"
 },
 {
  "c": "C24.410",
  "l": 5,
  "sl": "Proizvodnja plemenitih kovin",
  "en": "Precious metals production",
  "p": "C24.41"
 },
 {
  "c": "C24.42",
  "l": 4,
  "sl": "Proizvodnja aluminija",
  "en": "Aluminium production",
  "p": "C24.4"
 },
 {
  "c": "C24.420",
  "l": 5,
  "sl": "Proizvodnja aluminija",
  "en": "Aluminium production",
  "p": "C24.42"
 },
 {
  "c": "C24.43",
  "l": 4,
  "sl": "Proizvodnja svinca, cinka in kositra",
  "en": "Lead, zinc and tin production",
  "p": "C24.4"
 },
 {
  "c": "C24.430",
  "l": 5,
  "sl": "Proizvodnja svinca, cinka in kositra",
  "en": "Lead, zinc and tin production",
  "p": "C24.43"
 },
 {
  "c": "C24.44",
  "l": 4,
  "sl": "Proizvodnja bakra",
  "en": "Copper production",
  "p": "C24.4"
 },
 {
  "c": "C24.440",
  "l": 5,
  "sl": "Proizvodnja bakra",
  "en": "Copper production",
  "p": "C24.44"
 },
 {
  "c": "C24.45",
  "l": 4,
  "sl": "Proizvodnja drugih neželeznih kovin",
  "en": "Other non-ferrous metal production",
  "p": "C24.4"
 },
 {
  "c": "C24.450",
  "l": 5,
  "sl": "Proizvodnja drugih neželeznih kovin",
  "en": "Other non-ferrous metal production",
  "p": "C24.45"
 },
 {
  "c": "C24.46",
  "l": 4,
  "sl": "Proizvodnja jedrskega goriva",
  "en": "Processing of nuclear fuel",
  "p": "C24.4"
 },
 {
  "c": "C24.460",
  "l": 5,
  "sl": "Proizvodnja jedrskega goriva",
  "en": "Processing of nuclear fuel",
  "p": "C24.46"
 },
 {
  "c": "C24.5",
  "l": 3,
  "sl": "Livarstvo",
  "en": "Casting of metals",
  "p": "C24"
 },
 {
  "c": "C24.51",
  "l": 4,
  "sl": "Litje železa",
  "en": "Casting of iron",
  "p": "C24.5"
 },
 {
  "c": "C24.510",
  "l": 5,
  "sl": "Litje železa",
  "en": "Casting of iron",
  "p": "C24.51"
 },
 {
  "c": "C24.52",
  "l": 4,
  "sl": "Litje jekla",
  "en": "Casting of steel",
  "p": "C24.5"
 },
 {
  "c": "C24.520",
  "l": 5,
  "sl": "Litje jekla",
  "en": "Casting of steel",
  "p": "C24.52"
 },
 {
  "c": "C24.53",
  "l": 4,
  "sl": "Litje lahkih kovin",
  "en": "Casting of light metals",
  "p": "C24.5"
 },
 {
  "c": "C24.530",
  "l": 5,
  "sl": "Litje lahkih kovin",
  "en": "Casting of light metals",
  "p": "C24.53"
 },
 {
  "c": "C24.54",
  "l": 4,
  "sl": "Litje drugih neželeznih kovin",
  "en": "Casting of other non-ferrous metals",
  "p": "C24.5"
 },
 {
  "c": "C24.540",
  "l": 5,
  "sl": "Litje drugih neželeznih kovin",
  "en": "Casting of other non-ferrous metals",
  "p": "C24.54"
 },
 {
  "c": "C25",
  "l": 2,
  "sl": "Proizvodnja kovinskih izdelkov, razen strojev in naprav",
  "en": "Manufacture of fabricated metal products, except machinery and equipment",
  "p": "C"
 },
 {
  "c": "C25.1",
  "l": 3,
  "sl": "Proizvodnja gradbenih kovinskih izdelkov",
  "en": "Manufacture of structural metal products",
  "p": "C25"
 },
 {
  "c": "C25.11",
  "l": 4,
  "sl": "Proizvodnja kovinskih konstrukcij in njihovih delov",
  "en": "Manufacture of metal structures and parts of structures",
  "p": "C25.1"
 },
 {
  "c": "C25.110",
  "l": 5,
  "sl": "Proizvodnja kovinskih konstrukcij in njihovih delov",
  "en": "Manufacture of metal structures and parts of structures",
  "p": "C25.11"
 },
 {
  "c": "C25.12",
  "l": 4,
  "sl": "Proizvodnja kovinskih vrat in oken",
  "en": "Manufacture of doors and windows of metal",
  "p": "C25.1"
 },
 {
  "c": "C25.120",
  "l": 5,
  "sl": "Proizvodnja kovinskih vrat in oken",
  "en": "Manufacture of doors and windows of metal",
  "p": "C25.12"
 },
 {
  "c": "C25.2",
  "l": 3,
  "sl": "Proizvodnja kotlov za centralno ogrevanje, kovinskih rezervoarjev in cistern",
  "en": "Manufacture of tanks, reservoirs and containers of metal",
  "p": "C25"
 },
 {
  "c": "C25.21",
  "l": 4,
  "sl": "Proizvodnja radiatorjev in kotlov za centralno ogrevanje",
  "en": "Manufacture of central heating radiators, steam generators and boilers",
  "p": "C25.2"
 },
 {
  "c": "C25.210",
  "l": 5,
  "sl": "Proizvodnja radiatorjev in kotlov za centralno ogrevanje",
  "en": "Manufacture of central heating radiators, steam generators and boilers",
  "p": "C25.21"
 },
 {
  "c": "C25.22",
  "l": 4,
  "sl": "Proizvodnja drugih kovinskih rezervoarjev in cistern",
  "en": "Manufacture of other tanks, reservoirs and containers of metal",
  "p": "C25.2"
 },
 {
  "c": "C25.220",
  "l": 5,
  "sl": "Proizvodnja drugih kovinskih rezervoarjev in cistern",
  "en": "Manufacture of other tanks, reservoirs and containers of metal",
  "p": "C25.22"
 },
 {
  "c": "C25.3",
  "l": 3,
  "sl": "Proizvodnja orožja in streliva",
  "en": "Manufacture of weapons and ammunition",
  "p": "C25"
 },
 {
  "c": "C25.30",
  "l": 4,
  "sl": "Proizvodnja orožja in streliva",
  "en": "Manufacture of weapons and ammunition",
  "p": "C25.3"
 },
 {
  "c": "C25.300",
  "l": 5,
  "sl": "Proizvodnja orožja in streliva",
  "en": "Manufacture of weapons and ammunition",
  "p": "C25.30"
 },
 {
  "c": "C25.4",
  "l": 3,
  "sl": "Kovanje in oblikovanje kovin ter prašna metalurgija",
  "en": "Forging and shaping metal and powder metallurgy",
  "p": "C25"
 },
 {
  "c": "C25.40",
  "l": 4,
  "sl": "Kovanje in oblikovanje kovin ter prašna metalurgija",
  "en": "Forging and shaping metal and powder metallurgy",
  "p": "C25.4"
 },
 {
  "c": "C25.400",
  "l": 5,
  "sl": "Kovanje in oblikovanje kovin ter prašna metalurgija",
  "en": "Forging and shaping metal and powder metallurgy",
  "p": "C25.40"
 },
 {
  "c": "C25.5",
  "l": 3,
  "sl": "Površinska obdelava in prekrivanje kovin, mehanska obdelava kovin",
  "en": "Treatment and coating of metals, machining",
  "p": "C25"
 },
 {
  "c": "C25.51",
  "l": 4,
  "sl": "Prekrivanje kovin",
  "en": "Coating of metals",
  "p": "C25.5"
 },
 {
  "c": "C25.510",
  "l": 5,
  "sl": "Prekrivanje kovin",
  "en": "Coating of metals",
  "p": "C25.51"
 },
 {
  "c": "C25.52",
  "l": 4,
  "sl": "Toplotna obdelava kovin",
  "en": "Heat treatment of metals",
  "p": "C25.5"
 },
 {
  "c": "C25.520",
  "l": 5,
  "sl": "Toplotna obdelava kovin",
  "en": "Heat treatment of metals",
  "p": "C25.52"
 },
 {
  "c": "C25.53",
  "l": 4,
  "sl": "Mehanska obdelava kovin",
  "en": "Machining of metals",
  "p": "C25.5"
 },
 {
  "c": "C25.530",
  "l": 5,
  "sl": "Mehanska obdelava kovin",
  "en": "Machining of metals",
  "p": "C25.53"
 },
 {
  "c": "C25.6",
  "l": 3,
  "sl": "Proizvodnja jedilnega pribora, ključavnic, okovja, orodja",
  "en": "Manufacture of cutlery, tools and general hardware",
  "p": "C25"
 },
 {
  "c": "C25.61",
  "l": 4,
  "sl": "Proizvodnja rezil in jedilnega pribora",
  "en": "Manufacture of cutlery",
  "p": "C25.6"
 },
 {
  "c": "C25.610",
  "l": 5,
  "sl": "Proizvodnja rezil in jedilnega pribora",
  "en": "Manufacture of cutlery",
  "p": "C25.61"
 },
 {
  "c": "C25.62",
  "l": 4,
  "sl": "Proizvodnja ključavnic, okovja",
  "en": "Manufacture of locks and hinges",
  "p": "C25.6"
 },
 {
  "c": "C25.620",
  "l": 5,
  "sl": "Proizvodnja ključavnic, okovja",
  "en": "Manufacture of locks and hinges",
  "p": "C25.62"
 },
 {
  "c": "C25.63",
  "l": 4,
  "sl": "Proizvodnja orodja",
  "en": "Manufacture of tools",
  "p": "C25.6"
 },
 {
  "c": "C25.631",
  "l": 5,
  "sl": "Proizvodnja ročnega orodja",
  "en": "Manufacture of hand tools",
  "p": "C25.63"
 },
 {
  "c": "C25.632",
  "l": 5,
  "sl": "Proizvodnja orodja za stroje",
  "en": "Manufacture of other tools",
  "p": "C25.63"
 },
 {
  "c": "C25.9",
  "l": 3,
  "sl": "Proizvodnja drugih kovinskih izdelkov",
  "en": "Manufacture of other fabricated metal products",
  "p": "C25"
 },
 {
  "c": "C25.91",
  "l": 4,
  "sl": "Proizvodnja jeklenih bobnov, sodov in podobnih posod",
  "en": "Manufacture of steel drums and similar containers",
  "p": "C25.9"
 },
 {
  "c": "C25.910",
  "l": 5,
  "sl": "Proizvodnja jeklenih bobnov, sodov in podobnih posod",
  "en": "Manufacture of steel drums and similar containers",
  "p": "C25.91"
 },
 {
  "c": "C25.92",
  "l": 4,
  "sl": "Proizvodnja lahke kovinske embalaže",
  "en": "Manufacture of light metal packaging",
  "p": "C25.9"
 },
 {
  "c": "C25.920",
  "l": 5,
  "sl": "Proizvodnja lahke kovinske embalaže",
  "en": "Manufacture of light metal packaging",
  "p": "C25.92"
 },
 {
  "c": "C25.93",
  "l": 4,
  "sl": "Proizvodnja izdelkov iz žice, verig in vzmeti",
  "en": "Manufacture of wire products, chain and springs",
  "p": "C25.9"
 },
 {
  "c": "C25.930",
  "l": 5,
  "sl": "Proizvodnja izdelkov iz žice, verig in vzmeti",
  "en": "Manufacture of wire products, chain and springs",
  "p": "C25.93"
 },
 {
  "c": "C25.94",
  "l": 4,
  "sl": "Proizvodnja vijačnega materiala, vezi",
  "en": "Manufacture of fasteners and screw machine products",
  "p": "C25.9"
 },
 {
  "c": "C25.940",
  "l": 5,
  "sl": "Proizvodnja vijačnega materiala, vezi",
  "en": "Manufacture of fasteners and screw machine products",
  "p": "C25.94"
 },
 {
  "c": "C25.99",
  "l": 4,
  "sl": "Proizvodnja drugih kovinskih izdelkov, d. n.",
  "en": "Manufacture of other fabricated metal products n.e.c.",
  "p": "C25.9"
 },
 {
  "c": "C25.990",
  "l": 5,
  "sl": "Proizvodnja drugih kovinskih izdelkov, d. n.",
  "en": "Manufacture of other fabricated metal products n.e.c.",
  "p": "C25.99"
 },
 {
  "c": "C26",
  "l": 2,
  "sl": "Proizvodnja računalnikov, elektronskih in optičnih izdelkov",
  "en": "Manufacture of computer, electronic and optical products",
  "p": "C"
 },
 {
  "c": "C26.1",
  "l": 3,
  "sl": "Proizvodnja elektronskih komponent in plošč",
  "en": "Manufacture of electronic components and boards",
  "p": "C26"
 },
 {
  "c": "C26.11",
  "l": 4,
  "sl": "Proizvodnja elektronskih komponent",
  "en": "Manufacture of electronic components",
  "p": "C26.1"
 },
 {
  "c": "C26.110",
  "l": 5,
  "sl": "Proizvodnja elektronskih komponent",
  "en": "Manufacture of electronic components",
  "p": "C26.11"
 },
 {
  "c": "C26.12",
  "l": 4,
  "sl": "Proizvodnja elektronskih plošč",
  "en": "Manufacture of loaded electronic boards",
  "p": "C26.1"
 },
 {
  "c": "C26.120",
  "l": 5,
  "sl": "Proizvodnja elektronskih plošč",
  "en": "Manufacture of loaded electronic boards",
  "p": "C26.12"
 },
 {
  "c": "C26.2",
  "l": 3,
  "sl": "Proizvodnja računalnikov in perifernih naprav",
  "en": "Manufacture of computers and peripheral equipment",
  "p": "C26"
 },
 {
  "c": "C26.20",
  "l": 4,
  "sl": "Proizvodnja računalnikov in perifernih naprav",
  "en": "Manufacture of computers and peripheral equipment",
  "p": "C26.2"
 },
 {
  "c": "C26.200",
  "l": 5,
  "sl": "Proizvodnja računalnikov in perifernih naprav",
  "en": "Manufacture of computers and peripheral equipment",
  "p": "C26.20"
 },
 {
  "c": "C26.3",
  "l": 3,
  "sl": "Proizvodnja komunikacijskih naprav",
  "en": "Manufacture of communication equipment",
  "p": "C26"
 },
 {
  "c": "C26.30",
  "l": 4,
  "sl": "Proizvodnja komunikacijskih naprav",
  "en": "Manufacture of communication equipment",
  "p": "C26.3"
 },
 {
  "c": "C26.300",
  "l": 5,
  "sl": "Proizvodnja komunikacijskih naprav",
  "en": "Manufacture of communication equipment",
  "p": "C26.30"
 },
 {
  "c": "C26.4",
  "l": 3,
  "sl": "Proizvodnja elektronskih naprav za široko rabo",
  "en": "Manufacture of consumer electronics",
  "p": "C26"
 },
 {
  "c": "C26.40",
  "l": 4,
  "sl": "Proizvodnja elektronskih naprav za široko rabo",
  "en": "Manufacture of consumer electronics",
  "p": "C26.4"
 },
 {
  "c": "C26.400",
  "l": 5,
  "sl": "Proizvodnja elektronskih naprav za široko rabo",
  "en": "Manufacture of consumer electronics",
  "p": "C26.40"
 },
 {
  "c": "C26.5",
  "l": 3,
  "sl": "Proizvodnja merilnih in preizkuševalnih instrumentov ter ur",
  "en": "Manufacture of measuring, testing instruments, clocks and watches",
  "p": "C26"
 },
 {
  "c": "C26.51",
  "l": 4,
  "sl": "Proizvodnja merilnih, preizkuševalnih in navigacijskih instrumentov in naprav",
  "en": "Manufacture of instruments and appliances for measuring, testing and navigation",
  "p": "C26.5"
 },
 {
  "c": "C26.510",
  "l": 5,
  "sl": "Proizvodnja merilnih, preizkuševalnih in navigacijskih instrumentov in naprav",
  "en": "Manufacture of instruments and appliances for measuring, testing and navigation",
  "p": "C26.51"
 },
 {
  "c": "C26.52",
  "l": 4,
  "sl": "Proizvodnja ur",
  "en": "Manufacture of watches and clocks",
  "p": "C26.5"
 },
 {
  "c": "C26.520",
  "l": 5,
  "sl": "Proizvodnja ur",
  "en": "Manufacture of watches and clocks",
  "p": "C26.52"
 },
 {
  "c": "C26.6",
  "l": 3,
  "sl": "Proizvodnja sevalnih, elektromedicinskih in elektroterapevtskih naprav",
  "en": "Manufacture of irradiation, electromedical and electrotherapeutic equipment",
  "p": "C26"
 },
 {
  "c": "C26.60",
  "l": 4,
  "sl": "Proizvodnja sevalnih, elektromedicinskih in elektroterapevtskih naprav",
  "en": "Manufacture of irradiation, electromedical and electrotherapeutic equipment",
  "p": "C26.6"
 },
 {
  "c": "C26.600",
  "l": 5,
  "sl": "Proizvodnja sevalnih, elektromedicinskih in elektroterapevtskih naprav",
  "en": "Manufacture of irradiation, electromedical and electrotherapeutic equipment",
  "p": "C26.60"
 },
 {
  "c": "C26.7",
  "l": 3,
  "sl": "Proizvodnja optičnih instrumentov, magnetnih in optičnih nosilcev zapisa ter fotografske opreme",
  "en": "Manufacture of optical instruments, magnetic and optical media and photographic equipment",
  "p": "C26"
 },
 {
  "c": "C26.70",
  "l": 4,
  "sl": "Proizvodnja optičnih instrumentov, magnetnih in optičnih nosilcev zapisa ter fotografske opreme",
  "en": "Manufacture of optical instruments, magnetic and optical media and photographic equipment",
  "p": "C26.7"
 },
 {
  "c": "C26.700",
  "l": 5,
  "sl": "Proizvodnja optičnih instrumentov, magnetnih in optičnih nosilcev zapisa ter fotografske opreme",
  "en": "Manufacture of optical instruments, magnetic and optical media and photographic equipment",
  "p": "C26.70"
 },
 {
  "c": "C27",
  "l": 2,
  "sl": "Proizvodnja električnih naprav",
  "en": "Manufacture of electrical equipment",
  "p": "C"
 },
 {
  "c": "C27.1",
  "l": 3,
  "sl": "Proizvodnja elektromotorjev, generatorjev, transformatorjev ter naprav za distribucijo in krmiljenje elektrike",
  "en": "Manufacture of electric motors, generators, transformers and electricity distribution and control apparatus",
  "p": "C27"
 },
 {
  "c": "C27.11",
  "l": 4,
  "sl": "Proizvodnja elektromotorjev, generatorjev in transformatorjev",
  "en": "Manufacture of electric motors, generators and transformers",
  "p": "C27.1"
 },
 {
  "c": "C27.110",
  "l": 5,
  "sl": "Proizvodnja elektromotorjev, generatorjev in transformatorjev",
  "en": "Manufacture of electric motors, generators and transformers",
  "p": "C27.11"
 },
 {
  "c": "C27.12",
  "l": 4,
  "sl": "Proizvodnja naprav za distribucijo in krmiljenje elektrike",
  "en": "Manufacture of electricity distribution and control apparatus",
  "p": "C27.1"
 },
 {
  "c": "C27.120",
  "l": 5,
  "sl": "Proizvodnja naprav za distribucijo in krmiljenje elektrike",
  "en": "Manufacture of electricity distribution and control apparatus",
  "p": "C27.12"
 },
 {
  "c": "C27.2",
  "l": 3,
  "sl": "Proizvodnja baterij in akumulatorjev",
  "en": "Manufacture of batteries and accumulators",
  "p": "C27"
 },
 {
  "c": "C27.20",
  "l": 4,
  "sl": "Proizvodnja baterij in akumulatorjev",
  "en": "Manufacture of batteries and accumulators",
  "p": "C27.2"
 },
 {
  "c": "C27.200",
  "l": 5,
  "sl": "Proizvodnja baterij in akumulatorjev",
  "en": "Manufacture of batteries and accumulators",
  "p": "C27.20"
 },
 {
  "c": "C27.3",
  "l": 3,
  "sl": "Proizvodnja oplaščenih vodnikov in naprav za ožičenje",
  "en": "Manufacture of wiring and wiring devices",
  "p": "C27"
 },
 {
  "c": "C27.31",
  "l": 4,
  "sl": "Proizvodnja kablov iz optičnih vlaken",
  "en": "Manufacture of fibre optic cables",
  "p": "C27.3"
 },
 {
  "c": "C27.310",
  "l": 5,
  "sl": "Proizvodnja kablov iz optičnih vlaken",
  "en": "Manufacture of fibre optic cables",
  "p": "C27.31"
 },
 {
  "c": "C27.32",
  "l": 4,
  "sl": "Proizvodnja drugih električnih kablov in žic",
  "en": "Manufacture of other electronic and electric wires and cables",
  "p": "C27.3"
 },
 {
  "c": "C27.320",
  "l": 5,
  "sl": "Proizvodnja drugih električnih kablov in žic",
  "en": "Manufacture of other electronic and electric wires and cables",
  "p": "C27.32"
 },
 {
  "c": "C27.33",
  "l": 4,
  "sl": "Proizvodnja vtičnic, stikal in drugih naprav za ožičenje",
  "en": "Manufacture of wiring devices",
  "p": "C27.3"
 },
 {
  "c": "C27.330",
  "l": 5,
  "sl": "Proizvodnja vtičnic, stikal in drugih naprav za ožičenje",
  "en": "Manufacture of wiring devices",
  "p": "C27.33"
 },
 {
  "c": "C27.4",
  "l": 3,
  "sl": "Proizvodnja naprav in opreme za razsvetljavo",
  "en": "Manufacture of lighting equipment",
  "p": "C27"
 },
 {
  "c": "C27.40",
  "l": 4,
  "sl": "Proizvodnja naprav in opreme za razsvetljavo",
  "en": "Manufacture of lighting equipment",
  "p": "C27.4"
 },
 {
  "c": "C27.400",
  "l": 5,
  "sl": "Proizvodnja naprav in opreme za razsvetljavo",
  "en": "Manufacture of lighting equipment",
  "p": "C27.40"
 },
 {
  "c": "C27.5",
  "l": 3,
  "sl": "Proizvodnja gospodinjskih naprav",
  "en": "Manufacture of domestic appliances",
  "p": "C27"
 },
 {
  "c": "C27.51",
  "l": 4,
  "sl": "Proizvodnja električnih gospodinjskih naprav",
  "en": "Manufacture of electric domestic appliances",
  "p": "C27.5"
 },
 {
  "c": "C27.510",
  "l": 5,
  "sl": "Proizvodnja električnih gospodinjskih naprav",
  "en": "Manufacture of electric domestic appliances",
  "p": "C27.51"
 },
 {
  "c": "C27.52",
  "l": 4,
  "sl": "Proizvodnja neelektričnih gospodinjskih naprav",
  "en": "Manufacture of non-electric domestic appliances",
  "p": "C27.5"
 },
 {
  "c": "C27.520",
  "l": 5,
  "sl": "Proizvodnja neelektričnih gospodinjskih naprav",
  "en": "Manufacture of non-electric domestic appliances",
  "p": "C27.52"
 },
 {
  "c": "C27.9",
  "l": 3,
  "sl": "Proizvodnja drugih električnih naprav",
  "en": "Manufacture of other electrical equipment",
  "p": "C27"
 },
 {
  "c": "C27.90",
  "l": 4,
  "sl": "Proizvodnja drugih električnih naprav",
  "en": "Manufacture of other electrical equipment",
  "p": "C27.9"
 },
 {
  "c": "C27.900",
  "l": 5,
  "sl": "Proizvodnja drugih električnih naprav",
  "en": "Manufacture of other electrical equipment",
  "p": "C27.90"
 },
 {
  "c": "C28",
  "l": 2,
  "sl": "Proizvodnja strojev in naprav, d. n.",
  "en": "Manufacture of machinery and equipment n.e.c.",
  "p": "C"
 },
 {
  "c": "C28.1",
  "l": 3,
  "sl": "Proizvodnja strojev za splošne namene",
  "en": "Manufacture of general-purpose machinery",
  "p": "C28"
 },
 {
  "c": "C28.11",
  "l": 4,
  "sl": "Proizvodnja motorjev in turbin, razen za letala in motorna vozila",
  "en": "Manufacture of engines and turbines, except aircraft, vehicle and cycle engines",
  "p": "C28.1"
 },
 {
  "c": "C28.110",
  "l": 5,
  "sl": "Proizvodnja motorjev in turbin, razen za letala in motorna vozila",
  "en": "Manufacture of engines and turbines, except aircraft, vehicle and cycle engines",
  "p": "C28.11"
 },
 {
  "c": "C28.12",
  "l": 4,
  "sl": "Proizvodnja naprav za fluidno tehniko",
  "en": "Manufacture of fluid power equipment",
  "p": "C28.1"
 },
 {
  "c": "C28.120",
  "l": 5,
  "sl": "Proizvodnja naprav za fluidno tehniko",
  "en": "Manufacture of fluid power equipment",
  "p": "C28.12"
 },
 {
  "c": "C28.13",
  "l": 4,
  "sl": "Proizvodnja črpalk in kompresorjev",
  "en": "Manufacture of other pumps and compressors",
  "p": "C28.1"
 },
 {
  "c": "C28.130",
  "l": 5,
  "sl": "Proizvodnja črpalk in kompresorjev",
  "en": "Manufacture of other pumps and compressors",
  "p": "C28.13"
 },
 {
  "c": "C28.14",
  "l": 4,
  "sl": "Proizvodnja pip in ventilov",
  "en": "Manufacture of other taps and valves",
  "p": "C28.1"
 },
 {
  "c": "C28.140",
  "l": 5,
  "sl": "Proizvodnja pip in ventilov",
  "en": "Manufacture of other taps and valves",
  "p": "C28.14"
 },
 {
  "c": "C28.15",
  "l": 4,
  "sl": "Proizvodnja ležajev, zobnikov in elementov za mehanski prenos energije",
  "en": "Manufacture of bearings, gears, gearing and driving elements",
  "p": "C28.1"
 },
 {
  "c": "C28.150",
  "l": 5,
  "sl": "Proizvodnja ležajev, zobnikov in elementov za mehanski prenos energije",
  "en": "Manufacture of bearings, gears, gearing and driving elements",
  "p": "C28.15"
 },
 {
  "c": "C28.2",
  "l": 3,
  "sl": "Proizvodnja drugih naprav za splošne namene",
  "en": "Manufacture of other general-purpose machinery",
  "p": "C28"
 },
 {
  "c": "C28.21",
  "l": 4,
  "sl": "Proizvodnja peči in trajnih gospodinjskih naprav za ogrevanje",
  "en": "Manufacture of ovens, furnaces and permanent household heating equipment",
  "p": "C28.2"
 },
 {
  "c": "C28.210",
  "l": 5,
  "sl": "Proizvodnja peči in trajnih gospodinjskih naprav za ogrevanje",
  "en": "Manufacture of ovens, furnaces and permanent household heating equipment",
  "p": "C28.21"
 },
 {
  "c": "C28.22",
  "l": 4,
  "sl": "Proizvodnja dvigalnih in transportnih naprav",
  "en": "Manufacture of lifting and handling equipment",
  "p": "C28.2"
 },
 {
  "c": "C28.220",
  "l": 5,
  "sl": "Proizvodnja dvigalnih in transportnih naprav",
  "en": "Manufacture of lifting and handling equipment",
  "p": "C28.22"
 },
 {
  "c": "C28.23",
  "l": 4,
  "sl": "Proizvodnja pisarniških strojev in naprav, razen računalnikov in perifernih naprav",
  "en": "Manufacture of office machinery and equipment, except computers and peripheral equipment",
  "p": "C28.2"
 },
 {
  "c": "C28.230",
  "l": 5,
  "sl": "Proizvodnja pisarniških strojev in naprav, razen računalnikov in perifernih naprav",
  "en": "Manufacture of office machinery and equipment, except computers and peripheral equipment",
  "p": "C28.23"
 },
 {
  "c": "C28.24",
  "l": 4,
  "sl": "Proizvodnja ročnih strojev in naprav",
  "en": "Manufacture of power-driven hand tools",
  "p": "C28.2"
 },
 {
  "c": "C28.240",
  "l": 5,
  "sl": "Proizvodnja ročnih strojev in naprav",
  "en": "Manufacture of power-driven hand tools",
  "p": "C28.24"
 },
 {
  "c": "C28.25",
  "l": 4,
  "sl": "Proizvodnja klimatskih naprav, razen za gospodinjstva",
  "en": "Manufacture of non-domestic air conditioning equipment",
  "p": "C28.2"
 },
 {
  "c": "C28.250",
  "l": 5,
  "sl": "Proizvodnja klimatskih naprav, razen za gospodinjstva",
  "en": "Manufacture of non-domestic air conditioning equipment",
  "p": "C28.25"
 },
 {
  "c": "C28.29",
  "l": 4,
  "sl": "Proizvodnja drugih strojev in naprav za splošne namene, d. n.",
  "en": "Manufacture of other general-purpose machinery n.e.c.",
  "p": "C28.2"
 },
 {
  "c": "C28.290",
  "l": 5,
  "sl": "Proizvodnja drugih strojev in naprav za splošne namene, d. n.",
  "en": "Manufacture of other general-purpose machinery n.e.c.",
  "p": "C28.29"
 },
 {
  "c": "C28.3",
  "l": 3,
  "sl": "Proizvodnja kmetijskih in gozdarskih strojev",
  "en": "Manufacture of agricultural and forestry machinery",
  "p": "C28"
 },
 {
  "c": "C28.30",
  "l": 4,
  "sl": "Proizvodnja kmetijskih in gozdarskih strojev",
  "en": "Manufacture of agricultural and forestry machinery",
  "p": "C28.3"
 },
 {
  "c": "C28.300",
  "l": 5,
  "sl": "Proizvodnja kmetijskih in gozdarskih strojev",
  "en": "Manufacture of agricultural and forestry machinery",
  "p": "C28.30"
 },
 {
  "c": "C28.4",
  "l": 3,
  "sl": "Proizvodnja obdelovalnih strojev",
  "en": "Manufacture of metal forming machinery and machine tools",
  "p": "C28"
 },
 {
  "c": "C28.41",
  "l": 4,
  "sl": "Proizvodnja strojev za oblikovanje in obdelavo kovin",
  "en": "Manufacture of metal forming machinery and machine tools for metal work",
  "p": "C28.4"
 },
 {
  "c": "C28.410",
  "l": 5,
  "sl": "Proizvodnja strojev za oblikovanje in obdelavo kovin",
  "en": "Manufacture of metal forming machinery and machine tools for metal work",
  "p": "C28.41"
 },
 {
  "c": "C28.42",
  "l": 4,
  "sl": "Proizvodnja drugih obdelovalnih strojev",
  "en": "Manufacture of other machine tools",
  "p": "C28.4"
 },
 {
  "c": "C28.420",
  "l": 5,
  "sl": "Proizvodnja drugih obdelovalnih strojev",
  "en": "Manufacture of other machine tools",
  "p": "C28.42"
 },
 {
  "c": "C28.9",
  "l": 3,
  "sl": "Proizvodnja drugih strojev za posebne namene",
  "en": "Manufacture of other special-purpose machinery",
  "p": "C28"
 },
 {
  "c": "C28.91",
  "l": 4,
  "sl": "Proizvodnja metalurških strojev",
  "en": "Manufacture of machinery for metallurgy",
  "p": "C28.9"
 },
 {
  "c": "C28.910",
  "l": 5,
  "sl": "Proizvodnja metalurških strojev",
  "en": "Manufacture of machinery for metallurgy",
  "p": "C28.91"
 },
 {
  "c": "C28.92",
  "l": 4,
  "sl": "Proizvodnja rudarskih in gradbenih strojev",
  "en": "Manufacture of machinery for mining, quarrying and construction",
  "p": "C28.9"
 },
 {
  "c": "C28.920",
  "l": 5,
  "sl": "Proizvodnja rudarskih in gradbenih strojev",
  "en": "Manufacture of machinery for mining, quarrying and construction",
  "p": "C28.92"
 },
 {
  "c": "C28.93",
  "l": 4,
  "sl": "Proizvodnja strojev za živilsko in tobačno industrijo",
  "en": "Manufacture of machinery for food, beverage and tobacco processing",
  "p": "C28.9"
 },
 {
  "c": "C28.930",
  "l": 5,
  "sl": "Proizvodnja strojev za živilsko in tobačno industrijo",
  "en": "Manufacture of machinery for food, beverage and tobacco processing",
  "p": "C28.93"
 },
 {
  "c": "C28.94",
  "l": 4,
  "sl": "Proizvodnja strojev za tekstilno, oblačilno in usnjarsko industrijo",
  "en": "Manufacture of machinery for textile, apparel and leather production",
  "p": "C28.9"
 },
 {
  "c": "C28.940",
  "l": 5,
  "sl": "Proizvodnja strojev za tekstilno, oblačilno in usnjarsko industrijo",
  "en": "Manufacture of machinery for textile, apparel and leather production",
  "p": "C28.94"
 },
 {
  "c": "C28.95",
  "l": 4,
  "sl": "Proizvodnja strojev za industrijo papirja in kartona",
  "en": "Manufacture of machinery for paper and paperboard production",
  "p": "C28.9"
 },
 {
  "c": "C28.950",
  "l": 5,
  "sl": "Proizvodnja strojev za industrijo papirja in kartona",
  "en": "Manufacture of machinery for paper and paperboard production",
  "p": "C28.95"
 },
 {
  "c": "C28.96",
  "l": 4,
  "sl": "Proizvodnja strojev za plastiko in gumo",
  "en": "Manufacture of plastics and rubber machinery",
  "p": "C28.9"
 },
 {
  "c": "C28.960",
  "l": 5,
  "sl": "Proizvodnja strojev za plastiko in gumo",
  "en": "Manufacture of plastics and rubber machinery",
  "p": "C28.96"
 },
 {
  "c": "C28.97",
  "l": 4,
  "sl": "Proizvodnja strojev za aditivno proizvodnjo",
  "en": "Manufacture of additive manufacturing machinery",
  "p": "C28.9"
 },
 {
  "c": "C28.970",
  "l": 5,
  "sl": "Proizvodnja strojev za aditivno proizvodnjo",
  "en": "Manufacture of additive manufacturing machinery",
  "p": "C28.97"
 },
 {
  "c": "C28.99",
  "l": 4,
  "sl": "Proizvodnja drugih strojev za posebne namene, d. n.",
  "en": "Manufacture of other special-purpose machinery n.e.c.",
  "p": "C28.9"
 },
 {
  "c": "C28.990",
  "l": 5,
  "sl": "Proizvodnja drugih strojev za posebne namene, d. n.",
  "en": "Manufacture of other special-purpose machinery n.e.c.",
  "p": "C28.99"
 },
 {
  "c": "C29",
  "l": 2,
  "sl": "Proizvodnja motornih vozil, prikolic in polprikolic",
  "en": "Manufacture of motor vehicles, trailers and semi-trailers",
  "p": "C"
 },
 {
  "c": "C29.1",
  "l": 3,
  "sl": "Proizvodnja motornih vozil",
  "en": "Manufacture of motor vehicles",
  "p": "C29"
 },
 {
  "c": "C29.10",
  "l": 4,
  "sl": "Proizvodnja motornih vozil",
  "en": "Manufacture of motor vehicles",
  "p": "C29.1"
 },
 {
  "c": "C29.100",
  "l": 5,
  "sl": "Proizvodnja motornih vozil",
  "en": "Manufacture of motor vehicles",
  "p": "C29.10"
 },
 {
  "c": "C29.2",
  "l": 3,
  "sl": "Proizvodnja karoserij za motorna vozila, proizvodnja prikolic, polprikolic",
  "en": "Manufacture of bodies and coachwork for motor vehicles, manufacture of trailers and semi-trailers",
  "p": "C29"
 },
 {
  "c": "C29.20",
  "l": 4,
  "sl": "Proizvodnja karoserij za motorna vozila, proizvodnja prikolic, polprikolic",
  "en": "Manufacture of bodies and coachwork for motor vehicles, manufacture of trailers and semi-trailers",
  "p": "C29.2"
 },
 {
  "c": "C29.200",
  "l": 5,
  "sl": "Proizvodnja karoserij za motorna vozila, proizvodnja prikolic, polprikolic",
  "en": "Manufacture of bodies and coachwork for motor vehicles, manufacture of trailers and semi-trailers",
  "p": "C29.20"
 },
 {
  "c": "C29.3",
  "l": 3,
  "sl": "Proizvodnja delov in opreme za motorna vozila",
  "en": "Manufacture of motor vehicle parts and accessories",
  "p": "C29"
 },
 {
  "c": "C29.31",
  "l": 4,
  "sl": "Proizvodnja električne in elektronske opreme za motorna vozila",
  "en": "Manufacture of electrical and electronic equipment for motor vehicles",
  "p": "C29.3"
 },
 {
  "c": "C29.310",
  "l": 5,
  "sl": "Proizvodnja električne in elektronske opreme za motorna vozila",
  "en": "Manufacture of electrical and electronic equipment for motor vehicles",
  "p": "C29.31"
 },
 {
  "c": "C29.32",
  "l": 4,
  "sl": "Proizvodnja drugih delov in opreme za motorna vozila",
  "en": "Manufacture of other parts and accessories for motor vehicles",
  "p": "C29.3"
 },
 {
  "c": "C29.320",
  "l": 5,
  "sl": "Proizvodnja drugih delov in opreme za motorna vozila",
  "en": "Manufacture of other parts and accessories for motor vehicles",
  "p": "C29.32"
 },
 {
  "c": "C30",
  "l": 2,
  "sl": "Proizvodnja drugih vozil in plovil",
  "en": "Manufacture of other transport equipment",
  "p": "C"
 },
 {
  "c": "C30.1",
  "l": 3,
  "sl": "Gradnja ladij in čolnov",
  "en": "Building of ships and boats",
  "p": "C30"
 },
 {
  "c": "C30.11",
  "l": 4,
  "sl": "Gradnja civilnih ladij in plavajočih konstrukcij",
  "en": "Building of civilian ships and floating structures",
  "p": "C30.1"
 },
 {
  "c": "C30.110",
  "l": 5,
  "sl": "Gradnja civilnih ladij in plavajočih konstrukcij",
  "en": "Building of civilian ships and floating structures",
  "p": "C30.11"
 },
 {
  "c": "C30.12",
  "l": 4,
  "sl": "Gradnja čolnov za razvedrilo in šport",
  "en": "Building of pleasure and sporting boats",
  "p": "C30.1"
 },
 {
  "c": "C30.120",
  "l": 5,
  "sl": "Gradnja čolnov za razvedrilo in šport",
  "en": "Building of pleasure and sporting boats",
  "p": "C30.12"
 },
 {
  "c": "C30.13",
  "l": 4,
  "sl": "Gradnja vojaških ladij in plovil",
  "en": "Building of military ships and vessels",
  "p": "C30.1"
 },
 {
  "c": "C30.130",
  "l": 5,
  "sl": "Gradnja vojaških ladij in plovil",
  "en": "Building of military ships and vessels",
  "p": "C30.13"
 },
 {
  "c": "C30.2",
  "l": 3,
  "sl": "Proizvodnja železniških in drugih tirnih vozil",
  "en": "Manufacture of railway locomotives and rolling stock",
  "p": "C30"
 },
 {
  "c": "C30.20",
  "l": 4,
  "sl": "Proizvodnja železniških in drugih tirnih vozil",
  "en": "Manufacture of railway locomotives and rolling stock",
  "p": "C30.2"
 },
 {
  "c": "C30.200",
  "l": 5,
  "sl": "Proizvodnja železniških in drugih tirnih vozil",
  "en": "Manufacture of railway locomotives and rolling stock",
  "p": "C30.20"
 },
 {
  "c": "C30.3",
  "l": 3,
  "sl": "Proizvodnja zračnih in vesoljskih plovil",
  "en": "Manufacture of air and spacecraft and related machinery",
  "p": "C30"
 },
 {
  "c": "C30.31",
  "l": 4,
  "sl": "Proizvodnja civilnih zračnih in vesoljskih plovil",
  "en": "Manufacture of civilian air and spacecraft and related machinery",
  "p": "C30.3"
 },
 {
  "c": "C30.310",
  "l": 5,
  "sl": "Proizvodnja civilnih zračnih in vesoljskih plovil",
  "en": "Manufacture of civilian air and spacecraft and related machinery",
  "p": "C30.31"
 },
 {
  "c": "C30.32",
  "l": 4,
  "sl": "Proizvodnja vojaških zračnih in vesoljskih plovil",
  "en": "Manufacture of military air and spacecraft and related machinery",
  "p": "C30.3"
 },
 {
  "c": "C30.320",
  "l": 5,
  "sl": "Proizvodnja vojaških zračnih in vesoljskih plovil",
  "en": "Manufacture of military air and spacecraft and related machinery",
  "p": "C30.32"
 },
 {
  "c": "C30.4",
  "l": 3,
  "sl": "Proizvodnja bojnih vozil",
  "en": "Manufacture of military fighting vehicles",
  "p": "C30"
 },
 {
  "c": "C30.40",
  "l": 4,
  "sl": "Proizvodnja bojnih vozil",
  "en": "Manufacture of military fighting vehicles",
  "p": "C30.4"
 },
 {
  "c": "C30.400",
  "l": 5,
  "sl": "Proizvodnja bojnih vozil",
  "en": "Manufacture of military fighting vehicles",
  "p": "C30.40"
 },
 {
  "c": "C30.9",
  "l": 3,
  "sl": "Proizvodnja prevoznih sredstev, d. n.",
  "en": "Manufacture of transport equipment n.e.c.",
  "p": "C30"
 },
 {
  "c": "C30.91",
  "l": 4,
  "sl": "Proizvodnja motornih koles",
  "en": "Manufacture of motorcycles",
  "p": "C30.9"
 },
 {
  "c": "C30.910",
  "l": 5,
  "sl": "Proizvodnja motornih koles",
  "en": "Manufacture of motorcycles",
  "p": "C30.91"
 },
 {
  "c": "C30.92",
  "l": 4,
  "sl": "Proizvodnja koles in invalidskih vozičkov",
  "en": "Manufacture of bicycles and invalid carriages",
  "p": "C30.9"
 },
 {
  "c": "C30.920",
  "l": 5,
  "sl": "Proizvodnja koles in invalidskih vozičkov",
  "en": "Manufacture of bicycles and invalid carriages",
  "p": "C30.92"
 },
 {
  "c": "C30.99",
  "l": 4,
  "sl": "Proizvodnja drugih prevoznih sredstev, d. n.",
  "en": "Manufacture of other transport equipment n.e.c.",
  "p": "C30.9"
 },
 {
  "c": "C30.990",
  "l": 5,
  "sl": "Proizvodnja drugih prevoznih sredstev, d. n.",
  "en": "Manufacture of other transport equipment n.e.c.",
  "p": "C30.99"
 },
 {
  "c": "C31",
  "l": 2,
  "sl": "Proizvodnja pohištva",
  "en": "Manufacture of furniture",
  "p": "C"
 },
 {
  "c": "C31.0",
  "l": 3,
  "sl": "Proizvodnja pohištva",
  "en": "Manufacture of furniture",
  "p": "C31"
 },
 {
  "c": "C31.00",
  "l": 4,
  "sl": "Proizvodnja pohištva",
  "en": "Manufacture of furniture",
  "p": "C31.0"
 },
 {
  "c": "C31.000",
  "l": 5,
  "sl": "Proizvodnja pohištva",
  "en": "Manufacture of furniture",
  "p": "C31.00"
 },
 {
  "c": "C32",
  "l": 2,
  "sl": "Druge raznovrstne predelovalne dejavnosti",
  "en": "Other manufacturing",
  "p": "C"
 },
 {
  "c": "C32.1",
  "l": 3,
  "sl": "Proizvodnja nakita, bižuterije in podobnih izdelkov",
  "en": "Manufacture of jewellery, bijouterie and related articles",
  "p": "C32"
 },
 {
  "c": "C32.11",
  "l": 4,
  "sl": "Kovanje kovancev",
  "en": "Striking of coins",
  "p": "C32.1"
 },
 {
  "c": "C32.110",
  "l": 5,
  "sl": "Kovanje kovancev",
  "en": "Striking of coins",
  "p": "C32.11"
 },
 {
  "c": "C32.12",
  "l": 4,
  "sl": "Proizvodnja nakita in podobnih izdelkov",
  "en": "Manufacture of jewellery and related articles",
  "p": "C32.1"
 },
 {
  "c": "C32.120",
  "l": 5,
  "sl": "Proizvodnja nakita in podobnih izdelkov",
  "en": "Manufacture of jewellery and related articles",
  "p": "C32.12"
 },
 {
  "c": "C32.13",
  "l": 4,
  "sl": "Proizvodnja bižuterije",
  "en": "Manufacture of imitation jewellery and related articles",
  "p": "C32.1"
 },
 {
  "c": "C32.130",
  "l": 5,
  "sl": "Proizvodnja bižuterije",
  "en": "Manufacture of imitation jewellery and related articles",
  "p": "C32.13"
 },
 {
  "c": "C32.2",
  "l": 3,
  "sl": "Proizvodnja glasbil",
  "en": "Manufacture of musical instruments",
  "p": "C32"
 },
 {
  "c": "C32.20",
  "l": 4,
  "sl": "Proizvodnja glasbil",
  "en": "Manufacture of musical instruments",
  "p": "C32.2"
 },
 {
  "c": "C32.200",
  "l": 5,
  "sl": "Proizvodnja glasbil",
  "en": "Manufacture of musical instruments",
  "p": "C32.20"
 },
 {
  "c": "C32.3",
  "l": 3,
  "sl": "Proizvodnja športne opreme",
  "en": "Manufacture of sports goods",
  "p": "C32"
 },
 {
  "c": "C32.30",
  "l": 4,
  "sl": "Proizvodnja športne opreme",
  "en": "Manufacture of sports goods",
  "p": "C32.3"
 },
 {
  "c": "C32.300",
  "l": 5,
  "sl": "Proizvodnja športne opreme",
  "en": "Manufacture of sports goods",
  "p": "C32.30"
 },
 {
  "c": "C32.4",
  "l": 3,
  "sl": "Proizvodnja iger in igrač",
  "en": "Manufacture of games and toys",
  "p": "C32"
 },
 {
  "c": "C32.40",
  "l": 4,
  "sl": "Proizvodnja iger in igrač",
  "en": "Manufacture of games and toys",
  "p": "C32.4"
 },
 {
  "c": "C32.400",
  "l": 5,
  "sl": "Proizvodnja iger in igrač",
  "en": "Manufacture of games and toys",
  "p": "C32.40"
 },
 {
  "c": "C32.5",
  "l": 3,
  "sl": "Proizvodnja medicinskih instrumentov, naprav in pripomočkov",
  "en": "Manufacture of medical and dental instruments and supplies",
  "p": "C32"
 },
 {
  "c": "C32.50",
  "l": 4,
  "sl": "Proizvodnja medicinskih instrumentov, naprav in pripomočkov",
  "en": "Manufacture of medical and dental instruments and supplies",
  "p": "C32.5"
 },
 {
  "c": "C32.500",
  "l": 5,
  "sl": "Proizvodnja medicinskih instrumentov, naprav in pripomočkov",
  "en": "Manufacture of medical and dental instruments and supplies",
  "p": "C32.50"
 },
 {
  "c": "C32.9",
  "l": 3,
  "sl": "Predelovalne dejavnosti, d. n.",
  "en": "Manufacturing n.e.c.",
  "p": "C32"
 },
 {
  "c": "C32.91",
  "l": 4,
  "sl": "Proizvodnja metel in krtač",
  "en": "Manufacture of brooms and brushes",
  "p": "C32.9"
 },
 {
  "c": "C32.910",
  "l": 5,
  "sl": "Proizvodnja metel in krtač",
  "en": "Manufacture of brooms and brushes",
  "p": "C32.91"
 },
 {
  "c": "C32.99",
  "l": 4,
  "sl": "Druge predelovalne dejavnosti, d. n.",
  "en": "Other manufacturing n.e.c.",
  "p": "C32.9"
 },
 {
  "c": "C32.990",
  "l": 5,
  "sl": "Druge predelovalne dejavnosti, d. n.",
  "en": "Other manufacturing n.e.c.",
  "p": "C32.99"
 },
 {
  "c": "C33",
  "l": 2,
  "sl": "Popravila, vzdrževanje in montaža strojev in naprav",
  "en": "Repair, maintenance and installation of machinery and equipment",
  "p": "C"
 },
 {
  "c": "C33.1",
  "l": 3,
  "sl": "Popravila in vzdrževanje kovinskih izdelkov, strojev in naprav",
  "en": "Repair and maintenance of fabricated metal products, machinery and equipment",
  "p": "C33"
 },
 {
  "c": "C33.11",
  "l": 4,
  "sl": "Popravila in vzdrževanje kovinskih izdelkov",
  "en": "Repair and maintenance of fabricated metal products",
  "p": "C33.1"
 },
 {
  "c": "C33.110",
  "l": 5,
  "sl": "Popravila in vzdrževanje kovinskih izdelkov",
  "en": "Repair and maintenance of fabricated metal products",
  "p": "C33.11"
 },
 {
  "c": "C33.12",
  "l": 4,
  "sl": "Popravila in vzdrževanje strojev in naprav",
  "en": "Repair and maintenance of machinery",
  "p": "C33.1"
 },
 {
  "c": "C33.120",
  "l": 5,
  "sl": "Popravila in vzdrževanje strojev in naprav",
  "en": "Repair and maintenance of machinery",
  "p": "C33.12"
 },
 {
  "c": "C33.13",
  "l": 4,
  "sl": "Popravila in vzdrževanje elektronskih in optičnih naprav",
  "en": "Repair and maintenance of electronic and optical equipment",
  "p": "C33.1"
 },
 {
  "c": "C33.130",
  "l": 5,
  "sl": "Popravila in vzdrževanje elektronskih in optičnih naprav",
  "en": "Repair and maintenance of electronic and optical equipment",
  "p": "C33.13"
 },
 {
  "c": "C33.14",
  "l": 4,
  "sl": "Popravila in vzdrževanje električnih naprav",
  "en": "Repair and maintenance of electrical equipment",
  "p": "C33.1"
 },
 {
  "c": "C33.140",
  "l": 5,
  "sl": "Popravila in vzdrževanje električnih naprav",
  "en": "Repair and maintenance of electrical equipment",
  "p": "C33.14"
 },
 {
  "c": "C33.15",
  "l": 4,
  "sl": "Popravila in vzdrževanje civilnih ladij in čolnov",
  "en": "Repair and maintenance of civilian ships and boats",
  "p": "C33.1"
 },
 {
  "c": "C33.150",
  "l": 5,
  "sl": "Popravila in vzdrževanje civilnih ladij in čolnov",
  "en": "Repair and maintenance of civilian ships and boats",
  "p": "C33.15"
 },
 {
  "c": "C33.16",
  "l": 4,
  "sl": "Popravila in vzdrževanje civilnih zračnih in vesoljskih plovil",
  "en": "Repair and maintenance of civilian air and spacecraft",
  "p": "C33.1"
 },
 {
  "c": "C33.160",
  "l": 5,
  "sl": "Popravila in vzdrževanje civilnih zračnih in vesoljskih plovil",
  "en": "Repair and maintenance of civilian air and spacecraft",
  "p": "C33.16"
 },
 {
  "c": "C33.17",
  "l": 4,
  "sl": "Popravila in vzdrževanje drugih civilnih prevoznih sredstev",
  "en": "Repair and maintenance of other civilian transport equipment",
  "p": "C33.1"
 },
 {
  "c": "C33.170",
  "l": 5,
  "sl": "Popravila in vzdrževanje drugih civilnih prevoznih sredstev",
  "en": "Repair and maintenance of other civilian transport equipment",
  "p": "C33.17"
 },
 {
  "c": "C33.18",
  "l": 4,
  "sl": "Popravila in vzdrževanje vojaških bojnih vozil, ladij, čolnov ter zračnih in vesoljskih plovil",
  "en": "Repair and maintenance of military fighting vehicles, ships, boats, air and spacecraft",
  "p": "C33.1"
 },
 {
  "c": "C33.180",
  "l": 5,
  "sl": "Popravila in vzdrževanje vojaških bojnih vozil, ladij, čolnov ter zračnih in vesoljskih plovil",
  "en": "Repair and maintenance of military fighting vehicles, ships, boats, air and spacecraft",
  "p": "C33.18"
 },
 {
  "c": "C33.19",
  "l": 4,
  "sl": "Popravila in vzdrževanje drugih naprav",
  "en": "Repair and maintenance of other equipment",
  "p": "C33.1"
 },
 {
  "c": "C33.190",
  "l": 5,
  "sl": "Popravila in vzdrževanje drugih naprav",
  "en": "Repair and maintenance of other equipment",
  "p": "C33.19"
 },
 {
  "c": "C33.2",
  "l": 3,
  "sl": "Montaža industrijskih strojev in naprav",
  "en": "Installation of industrial machinery and equipment",
  "p": "C33"
 },
 {
  "c": "C33.20",
  "l": 4,
  "sl": "Montaža industrijskih strojev in naprav",
  "en": "Installation of industrial machinery and equipment",
  "p": "C33.2"
 },
 {
  "c": "C33.200",
  "l": 5,
  "sl": "Montaža industrijskih strojev in naprav",
  "en": "Installation of industrial machinery and equipment",
  "p": "C33.20"
 },
 {
  "c": "D",
  "l": 1,
  "sl": "OSKRBA Z ELEKTRIČNO ENERGIJO, PLINOM, PARO IN HLADNIM ZRAKOM",
  "en": "ELECTRICITY, GAS, STEAM AND AIR CONDITIONING SUPPLY",
  "p": null
 },
 {
  "c": "D35",
  "l": 2,
  "sl": "Oskrba z električno energijo, plinom, paro in hladnim zrakom",
  "en": "Electricity, gas, steam and air conditioning supply",
  "p": "D"
 },
 {
  "c": "D35.1",
  "l": 3,
  "sl": "Proizvodnja, prenos in distribucija električne energije",
  "en": "Electric power generation, transmission and distribution",
  "p": "D35"
 },
 {
  "c": "D35.11",
  "l": 4,
  "sl": "Proizvodnja električne energije iz neobnovljivih virov",
  "en": "Production of electricity from non-renewable sources",
  "p": "D35.1"
 },
 {
  "c": "D35.110",
  "l": 5,
  "sl": "Proizvodnja električne energije iz neobnovljivih virov",
  "en": "Production of electricity from non-renewable sources",
  "p": "D35.11"
 },
 {
  "c": "D35.12",
  "l": 4,
  "sl": "Proizvodnja električne energije iz obnovljivih virov",
  "en": "Production of electricity from renewable sources",
  "p": "D35.1"
 },
 {
  "c": "D35.120",
  "l": 5,
  "sl": "Proizvodnja električne energije iz obnovljivih virov",
  "en": "Production of electricity from renewable sources",
  "p": "D35.12"
 },
 {
  "c": "D35.13",
  "l": 4,
  "sl": "Prenos električne energije",
  "en": "Transmission of electricity",
  "p": "D35.1"
 },
 {
  "c": "D35.130",
  "l": 5,
  "sl": "Prenos električne energije",
  "en": "Transmission of electricity",
  "p": "D35.13"
 },
 {
  "c": "D35.14",
  "l": 4,
  "sl": "Distribucija električne energije",
  "en": "Distribution of electricity",
  "p": "D35.1"
 },
 {
  "c": "D35.140",
  "l": 5,
  "sl": "Distribucija električne energije",
  "en": "Distribution of electricity",
  "p": "D35.14"
 },
 {
  "c": "D35.15",
  "l": 4,
  "sl": "Trgovanje z električno energijo",
  "en": "Trade of electricity",
  "p": "D35.1"
 },
 {
  "c": "D35.150",
  "l": 5,
  "sl": "Trgovanje z električno energijo",
  "en": "Trade of electricity",
  "p": "D35.15"
 },
 {
  "c": "D35.16",
  "l": 4,
  "sl": "Shranjevanje električne energije",
  "en": "Storage of electricity",
  "p": "D35.1"
 },
 {
  "c": "D35.160",
  "l": 5,
  "sl": "Shranjevanje električne energije",
  "en": "Storage of electricity",
  "p": "D35.16"
 },
 {
  "c": "D35.2",
  "l": 3,
  "sl": "Proizvodnja plina, distribucija plinastih goriv po plinovodni mreži",
  "en": "Manufacture of gas, and distribution of gaseous fuels through mains",
  "p": "D35"
 },
 {
  "c": "D35.21",
  "l": 4,
  "sl": "Proizvodnja plina",
  "en": "Manufacture of gas",
  "p": "D35.2"
 },
 {
  "c": "D35.210",
  "l": 5,
  "sl": "Proizvodnja plina",
  "en": "Manufacture of gas",
  "p": "D35.21"
 },
 {
  "c": "D35.22",
  "l": 4,
  "sl": "Distribucija plinastih goriv po plinovodni mreži",
  "en": "Distribution of gaseous fuels through mains",
  "p": "D35.2"
 },
 {
  "c": "D35.220",
  "l": 5,
  "sl": "Distribucija plinastih goriv po plinovodni mreži",
  "en": "Distribution of gaseous fuels through mains",
  "p": "D35.22"
 },
 {
  "c": "D35.23",
  "l": 4,
  "sl": "Trgovanje s plinastimi gorivi po plinovodni mreži",
  "en": "Trade of gas through mains",
  "p": "D35.2"
 },
 {
  "c": "D35.230",
  "l": 5,
  "sl": "Trgovanje s plinastimi gorivi po plinovodni mreži",
  "en": "Trade of gas through mains",
  "p": "D35.23"
 },
 {
  "c": "D35.24",
  "l": 4,
  "sl": "Skladiščenje plina kot del storitev oskrbe omrežja",
  "en": "Storage of gas as part of network supply services",
  "p": "D35.2"
 },
 {
  "c": "D35.240",
  "l": 5,
  "sl": "Skladiščenje plina kot del storitev oskrbe omrežja",
  "en": "Storage of gas as part of network supply services",
  "p": "D35.24"
 },
 {
  "c": "D35.3",
  "l": 3,
  "sl": "Oskrba s paro in hladnim zrakom",
  "en": "Steam and air conditioning supply",
  "p": "D35"
 },
 {
  "c": "D35.30",
  "l": 4,
  "sl": "Oskrba s paro in hladnim zrakom",
  "en": "Steam and air conditioning supply",
  "p": "D35.3"
 },
 {
  "c": "D35.300",
  "l": 5,
  "sl": "Oskrba s paro in hladnim zrakom",
  "en": "Steam and air conditioning supply",
  "p": "D35.30"
 },
 {
  "c": "D35.4",
  "l": 3,
  "sl": "Dejavnosti posrednikov in agentov za električno energijo in zemeljski plin",
  "en": "Activities of brokers and agents for electric power and natural gas",
  "p": "D35"
 },
 {
  "c": "D35.40",
  "l": 4,
  "sl": "Dejavnosti posrednikov in agentov za električno energijo in zemeljski plin",
  "en": "Activities of brokers and agents for electric power and natural gas",
  "p": "D35.4"
 },
 {
  "c": "D35.400",
  "l": 5,
  "sl": "Dejavnosti posrednikov in agentov za električno energijo in zemeljski plin",
  "en": "Activities of brokers and agents for electric power and natural gas",
  "p": "D35.40"
 },
 {
  "c": "E",
  "l": 1,
  "sl": "OSKRBA Z VODO, RAVNANJE Z ODPLAKAMI IN ODPADKI, SANIRANJE OKOLJA",
  "en": "WATER SUPPLY, SEWERAGE, WASTE MANAGEMENT AND REMEDIATION ACTIVITIES",
  "p": null
 },
 {
  "c": "E36",
  "l": 2,
  "sl": "Zbiranje, prečiščevanje in distribucija vode",
  "en": "Water collection, treatment and supply",
  "p": "E"
 },
 {
  "c": "E36.0",
  "l": 3,
  "sl": "Zbiranje, prečiščevanje in distribucija vode",
  "en": "Water collection, treatment and supply",
  "p": "E36"
 },
 {
  "c": "E36.00",
  "l": 4,
  "sl": "Zbiranje, prečiščevanje in distribucija vode",
  "en": "Water collection, treatment and supply",
  "p": "E36.0"
 },
 {
  "c": "E36.000",
  "l": 5,
  "sl": "Zbiranje, prečiščevanje in distribucija vode",
  "en": "Water collection, treatment and supply",
  "p": "E36.00"
 },
 {
  "c": "E37",
  "l": 2,
  "sl": "Ravnanje z odplakami",
  "en": "Sewerage",
  "p": "E"
 },
 {
  "c": "E37.0",
  "l": 3,
  "sl": "Ravnanje z odplakami",
  "en": "Sewerage",
  "p": "E37"
 },
 {
  "c": "E37.00",
  "l": 4,
  "sl": "Ravnanje z odplakami",
  "en": "Sewerage",
  "p": "E37.0"
 },
 {
  "c": "E37.000",
  "l": 5,
  "sl": "Ravnanje z odplakami",
  "en": "Sewerage",
  "p": "E37.00"
 },
 {
  "c": "E38",
  "l": 2,
  "sl": "Zbiranje, odvoz, predelava in odstranjevanje odpadkov",
  "en": "Waste collection, recovery and disposal activities",
  "p": "E"
 },
 {
  "c": "E38.1",
  "l": 3,
  "sl": "Zbiranje in odvoz odpadkov",
  "en": "Waste collection",
  "p": "E38"
 },
 {
  "c": "E38.11",
  "l": 4,
  "sl": "Zbiranje in odvoz nenevarnih odpadkov",
  "en": "Collection of non-hazardous waste",
  "p": "E38.1"
 },
 {
  "c": "E38.110",
  "l": 5,
  "sl": "Zbiranje in odvoz nenevarnih odpadkov",
  "en": "Collection of non-hazardous waste",
  "p": "E38.11"
 },
 {
  "c": "E38.12",
  "l": 4,
  "sl": "Zbiranje in odvoz nevarnih odpadkov",
  "en": "Collection of hazardous waste",
  "p": "E38.1"
 },
 {
  "c": "E38.120",
  "l": 5,
  "sl": "Zbiranje in odvoz nevarnih odpadkov",
  "en": "Collection of hazardous waste",
  "p": "E38.12"
 },
 {
  "c": "E38.2",
  "l": 3,
  "sl": "Predelava odpadkov",
  "en": "Waste recovery",
  "p": "E38"
 },
 {
  "c": "E38.21",
  "l": 4,
  "sl": "Pridobivanje sekundarnih surovin",
  "en": "Materials recovery",
  "p": "E38.2"
 },
 {
  "c": "E38.210",
  "l": 5,
  "sl": "Pridobivanje sekundarnih surovin",
  "en": "Materials recovery",
  "p": "E38.21"
 },
 {
  "c": "E38.22",
  "l": 4,
  "sl": "Energijska predelava",
  "en": "Energy recovery",
  "p": "E38.2"
 },
 {
  "c": "E38.220",
  "l": 5,
  "sl": "Energijska predelava",
  "en": "Energy recovery",
  "p": "E38.22"
 },
 {
  "c": "E38.23",
  "l": 4,
  "sl": "Druga predelava odpadkov",
  "en": "Other waste recovery",
  "p": "E38.2"
 },
 {
  "c": "E38.230",
  "l": 5,
  "sl": "Druga predelava odpadkov",
  "en": "Other waste recovery",
  "p": "E38.23"
 },
 {
  "c": "E38.3",
  "l": 3,
  "sl": "Odstranjevanje odpadkov brez predelave",
  "en": "Waste disposal without recovery",
  "p": "E38"
 },
 {
  "c": "E38.31",
  "l": 4,
  "sl": "Sežiganje odpadkov brez energijske predelave",
  "en": "Incineration without energy recovery",
  "p": "E38.3"
 },
 {
  "c": "E38.310",
  "l": 5,
  "sl": "Sežiganje odpadkov brez energijske predelave",
  "en": "Incineration without energy recovery",
  "p": "E38.31"
 },
 {
  "c": "E38.32",
  "l": 4,
  "sl": "Odlaganje ali trajno skladiščenje odpadkov",
  "en": "Landfilling or permanent storage",
  "p": "E38.3"
 },
 {
  "c": "E38.320",
  "l": 5,
  "sl": "Odlaganje ali trajno skladiščenje odpadkov",
  "en": "Landfilling or permanent storage",
  "p": "E38.32"
 },
 {
  "c": "E38.33",
  "l": 4,
  "sl": "Drugo odstranjevanje odpadkov",
  "en": "Other waste disposal",
  "p": "E38.3"
 },
 {
  "c": "E38.330",
  "l": 5,
  "sl": "Drugo odstranjevanje odpadkov",
  "en": "Other waste disposal",
  "p": "E38.33"
 },
 {
  "c": "E39",
  "l": 2,
  "sl": "Saniranje okolja in drugo ravnanje z odpadki",
  "en": "Remediation activities and other waste management service activities",
  "p": "E"
 },
 {
  "c": "E39.0",
  "l": 3,
  "sl": "Saniranje okolja in drugo ravnanje z odpadki",
  "en": "Remediation activities and other waste management service activities",
  "p": "E39"
 },
 {
  "c": "E39.00",
  "l": 4,
  "sl": "Saniranje okolja in drugo ravnanje z odpadki",
  "en": "Remediation activities and other waste management service activities",
  "p": "E39.0"
 },
 {
  "c": "E39.000",
  "l": 5,
  "sl": "Saniranje okolja in drugo ravnanje z odpadki",
  "en": "Remediation activities and other waste management service activities",
  "p": "E39.00"
 },
 {
  "c": "F",
  "l": 1,
  "sl": "GRADBENIŠTVO",
  "en": "CONSTRUCTION",
  "p": null
 },
 {
  "c": "F41",
  "l": 2,
  "sl": "Gradnja stanovanjskih in nestanovanjskih stavb",
  "en": "Construction of residential and non-residential buildings",
  "p": "F"
 },
 {
  "c": "F41.0",
  "l": 3,
  "sl": "Gradnja stanovanjskih in nestanovanjskih stavb",
  "en": "Construction of residential and non-residential buildings",
  "p": "F41"
 },
 {
  "c": "F41.00",
  "l": 4,
  "sl": "Gradnja stanovanjskih in nestanovanjskih stavb",
  "en": "Construction of residential and non-residential buildings",
  "p": "F41.0"
 },
 {
  "c": "F41.000",
  "l": 5,
  "sl": "Gradnja stanovanjskih in nestanovanjskih stavb",
  "en": "Construction of residential and non-residential buildings",
  "p": "F41.00"
 },
 {
  "c": "F42",
  "l": 2,
  "sl": "Gradnja inženirskih objektov",
  "en": "Civil engineering",
  "p": "F"
 },
 {
  "c": "F42.1",
  "l": 3,
  "sl": "Gradnja cest in železnic",
  "en": "Construction of roads and railways",
  "p": "F42"
 },
 {
  "c": "F42.11",
  "l": 4,
  "sl": "Gradnja cest in avtocest",
  "en": "Construction of roads and motorways",
  "p": "F42.1"
 },
 {
  "c": "F42.110",
  "l": 5,
  "sl": "Gradnja cest in avtocest",
  "en": "Construction of roads and motorways",
  "p": "F42.11"
 },
 {
  "c": "F42.12",
  "l": 4,
  "sl": "Gradnja železnic in podzemnih železnic",
  "en": "Construction of railways and underground railways",
  "p": "F42.1"
 },
 {
  "c": "F42.120",
  "l": 5,
  "sl": "Gradnja železnic in podzemnih železnic",
  "en": "Construction of railways and underground railways",
  "p": "F42.12"
 },
 {
  "c": "F42.13",
  "l": 4,
  "sl": "Gradnja mostov in predorov",
  "en": "Construction of bridges and tunnels",
  "p": "F42.1"
 },
 {
  "c": "F42.130",
  "l": 5,
  "sl": "Gradnja mostov in predorov",
  "en": "Construction of bridges and tunnels",
  "p": "F42.13"
 },
 {
  "c": "F42.2",
  "l": 3,
  "sl": "Gradnja objektov oskrbne infrastrukture",
  "en": "Construction of utility projects",
  "p": "F42"
 },
 {
  "c": "F42.21",
  "l": 4,
  "sl": "Gradnja objektov oskrbne infrastrukture za tekočine",
  "en": "Construction of utility projects for fluids",
  "p": "F42.2"
 },
 {
  "c": "F42.210",
  "l": 5,
  "sl": "Gradnja objektov oskrbne infrastrukture za tekočine",
  "en": "Construction of utility projects for fluids",
  "p": "F42.21"
 },
 {
  "c": "F42.22",
  "l": 4,
  "sl": "Gradnja objektov oskrbne infrastrukture za elektriko in telekomunikacije",
  "en": "Construction of utility projects for electricity and telecommunications",
  "p": "F42.2"
 },
 {
  "c": "F42.220",
  "l": 5,
  "sl": "Gradnja objektov oskrbne infrastrukture za elektriko in telekomunikacije",
  "en": "Construction of utility projects for electricity and telecommunications",
  "p": "F42.22"
 },
 {
  "c": "F42.9",
  "l": 3,
  "sl": "Gradnja drugih inženirskih objektov",
  "en": "Construction of other civil engineering projects",
  "p": "F42"
 },
 {
  "c": "F42.91",
  "l": 4,
  "sl": "Gradnja vodnih objektov",
  "en": "Construction of water projects",
  "p": "F42.9"
 },
 {
  "c": "F42.910",
  "l": 5,
  "sl": "Gradnja vodnih objektov",
  "en": "Construction of water projects",
  "p": "F42.91"
 },
 {
  "c": "F42.99",
  "l": 4,
  "sl": "Gradnja drugih objektov nizke gradnje, d. n.",
  "en": "Construction of other civil engineering projects n.e.c.",
  "p": "F42.9"
 },
 {
  "c": "F42.990",
  "l": 5,
  "sl": "Gradnja drugih objektov nizke gradnje, d. n.",
  "en": "Construction of other civil engineering projects n.e.c.",
  "p": "F42.99"
 },
 {
  "c": "F43",
  "l": 2,
  "sl": "Specializirana gradbena dela",
  "en": "Specialised construction activities",
  "p": "F"
 },
 {
  "c": "F43.1",
  "l": 3,
  "sl": "Pripravljalna dela na gradbišču",
  "en": "Demolition and site preparation",
  "p": "F43"
 },
 {
  "c": "F43.11",
  "l": 4,
  "sl": "Rušenje objektov",
  "en": "Demolition",
  "p": "F43.1"
 },
 {
  "c": "F43.110",
  "l": 5,
  "sl": "Rušenje objektov",
  "en": "Demolition",
  "p": "F43.11"
 },
 {
  "c": "F43.12",
  "l": 4,
  "sl": "Zemeljska pripravljalna dela",
  "en": "Site preparation",
  "p": "F43.1"
 },
 {
  "c": "F43.120",
  "l": 5,
  "sl": "Zemeljska pripravljalna dela",
  "en": "Site preparation",
  "p": "F43.12"
 },
 {
  "c": "F43.13",
  "l": 4,
  "sl": "Testno vrtanje in sondiranje",
  "en": "Test drilling and boring",
  "p": "F43.1"
 },
 {
  "c": "F43.130",
  "l": 5,
  "sl": "Testno vrtanje in sondiranje",
  "en": "Test drilling and boring",
  "p": "F43.13"
 },
 {
  "c": "F43.2",
  "l": 3,
  "sl": "Elektroinštalacije, vodovodne inštalacije in druge inštalacije pri gradnjah",
  "en": "Electrical, plumbing and other construction installation activities",
  "p": "F43"
 },
 {
  "c": "F43.21",
  "l": 4,
  "sl": "Elektroinštalacije",
  "en": "Electrical installation",
  "p": "F43.2"
 },
 {
  "c": "F43.210",
  "l": 5,
  "sl": "Elektroinštalacije",
  "en": "Electrical installation",
  "p": "F43.21"
 },
 {
  "c": "F43.22",
  "l": 4,
  "sl": "Vodovodne, grelne in hladilne inštalacije",
  "en": "Plumbing, heat and air-conditioning installation",
  "p": "F43.2"
 },
 {
  "c": "F43.220",
  "l": 5,
  "sl": "Vodovodne, grelne in hladilne inštalacije",
  "en": "Plumbing, heat and air-conditioning installation",
  "p": "F43.22"
 },
 {
  "c": "F43.23",
  "l": 4,
  "sl": "Namestitev izolacije",
  "en": "Installation of insulation",
  "p": "F43.2"
 },
 {
  "c": "F43.230",
  "l": 5,
  "sl": "Namestitev izolacije",
  "en": "Installation of insulation",
  "p": "F43.23"
 },
 {
  "c": "F43.24",
  "l": 4,
  "sl": "Druge inštalacije pri gradnjah",
  "en": "Other construction installation",
  "p": "F43.2"
 },
 {
  "c": "F43.240",
  "l": 5,
  "sl": "Druge inštalacije pri gradnjah",
  "en": "Other construction installation",
  "p": "F43.24"
 },
 {
  "c": "F43.3",
  "l": 3,
  "sl": "Zaključna gradbena dela",
  "en": "Building completion and finishing",
  "p": "F43"
 },
 {
  "c": "F43.31",
  "l": 4,
  "sl": "Fasaderska in štukaterska dela",
  "en": "Plastering",
  "p": "F43.3"
 },
 {
  "c": "F43.310",
  "l": 5,
  "sl": "Fasaderska in štukaterska dela",
  "en": "Plastering",
  "p": "F43.31"
 },
 {
  "c": "F43.32",
  "l": 4,
  "sl": "Vgrajevanje stavbnega pohištva",
  "en": "Joinery installation",
  "p": "F43.3"
 },
 {
  "c": "F43.320",
  "l": 5,
  "sl": "Vgrajevanje stavbnega pohištva",
  "en": "Joinery installation",
  "p": "F43.32"
 },
 {
  "c": "F43.33",
  "l": 4,
  "sl": "Oblaganje tal in sten",
  "en": "Floor and wall covering",
  "p": "F43.3"
 },
 {
  "c": "F43.330",
  "l": 5,
  "sl": "Oblaganje tal in sten",
  "en": "Floor and wall covering",
  "p": "F43.33"
 },
 {
  "c": "F43.34",
  "l": 4,
  "sl": "Steklarska in pleskarska dela",
  "en": "Painting and glazing",
  "p": "F43.3"
 },
 {
  "c": "F43.341",
  "l": 5,
  "sl": "Steklarska dela",
  "en": "Glazing",
  "p": "F43.34"
 },
 {
  "c": "F43.342",
  "l": 5,
  "sl": "Pleskarska dela",
  "en": "Painting",
  "p": "F43.34"
 },
 {
  "c": "F43.35",
  "l": 4,
  "sl": "Druga zaključna gradbena dela",
  "en": "Other building completion and finishing",
  "p": "F43.3"
 },
 {
  "c": "F43.350",
  "l": 5,
  "sl": "Druga zaključna gradbena dela",
  "en": "Other building completion and finishing",
  "p": "F43.35"
 },
 {
  "c": "F43.4",
  "l": 3,
  "sl": "Specializirana gradbena dela pri gradnji stavb",
  "en": "Specialised construction activities in construction of buildings",
  "p": "F43"
 },
 {
  "c": "F43.41",
  "l": 4,
  "sl": "Postavljanje ostrešij in krovska dela",
  "en": "Roofing activities",
  "p": "F43.4"
 },
 {
  "c": "F43.410",
  "l": 5,
  "sl": "Postavljanje ostrešij in krovska dela",
  "en": "Roofing activities",
  "p": "F43.41"
 },
 {
  "c": "F43.42",
  "l": 4,
  "sl": "Druga specializirana gradbena dela pri gradnji stavb",
  "en": "Other specialised construction activities in construction of buildings",
  "p": "F43.4"
 },
 {
  "c": "F43.420",
  "l": 5,
  "sl": "Druga specializirana gradbena dela pri gradnji stavb",
  "en": "Other specialised construction activities in construction of buildings",
  "p": "F43.42"
 },
 {
  "c": "F43.5",
  "l": 3,
  "sl": "Specializirana gradbena dela pri gradnji inženirskih objektov",
  "en": "Specialised construction activities in civil engineering",
  "p": "F43"
 },
 {
  "c": "F43.50",
  "l": 4,
  "sl": "Specializirana gradbena dela pri gradnji inženirskih objektov",
  "en": "Specialised construction activities in civil engineering",
  "p": "F43.5"
 },
 {
  "c": "F43.500",
  "l": 5,
  "sl": "Specializirana gradbena dela pri gradnji inženirskih objektov",
  "en": "Specialised construction activities in civil engineering",
  "p": "F43.50"
 },
 {
  "c": "F43.6",
  "l": 3,
  "sl": "Posredniške dejavnosti za specializirane gradbene storitve",
  "en": "Intermediation service activities for specialised construction services",
  "p": "F43"
 },
 {
  "c": "F43.60",
  "l": 4,
  "sl": "Posredniške dejavnosti za specializirane gradbene storitve",
  "en": "Intermediation service activities for specialised construction services",
  "p": "F43.6"
 },
 {
  "c": "F43.600",
  "l": 5,
  "sl": "Posredniške dejavnosti za specializirane gradbene storitve",
  "en": "Intermediation service activities for specialised construction services",
  "p": "F43.60"
 },
 {
  "c": "F43.9",
  "l": 3,
  "sl": "Druga specializirana gradbena dela",
  "en": "Other specialised construction activities",
  "p": "F43"
 },
 {
  "c": "F43.91",
  "l": 4,
  "sl": "Zidarstvo",
  "en": "Masonry and bricklaying activities",
  "p": "F43.9"
 },
 {
  "c": "F43.910",
  "l": 5,
  "sl": "Zidarstvo",
  "en": "Masonry and bricklaying activities",
  "p": "F43.91"
 },
 {
  "c": "F43.99",
  "l": 4,
  "sl": "Druga specializirana gradbena dela, d. n.",
  "en": "Other specialised construction activities n.e.c.",
  "p": "F43.9"
 },
 {
  "c": "F43.990",
  "l": 5,
  "sl": "Druga specializirana gradbena dela, d. n.",
  "en": "Other specialised construction activities n.e.c.",
  "p": "F43.99"
 },
 {
  "c": "G",
  "l": 1,
  "sl": "TRGOVINA",
  "en": "WHOLESALE AND RETAIL TRADE",
  "p": null
 },
 {
  "c": "G46",
  "l": 2,
  "sl": "Trgovina na debelo",
  "en": "Wholesale trade",
  "p": "G"
 },
 {
  "c": "G46.1",
  "l": 3,
  "sl": "Trgovina na debelo za plačilo ali po pogodbi",
  "en": "Wholesale on a fee or contract basis",
  "p": "G46"
 },
 {
  "c": "G46.11",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo kmetijskih surovin, živih živali, tekstilnih surovin, polizdelkov",
  "en": "Activities of agents involved in the wholesale of agricultural raw materials, live animals, textile raw materials and semi-finished goods",
  "p": "G46.1"
 },
 {
  "c": "G46.110",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo kmetijskih surovin, živih živali, tekstilnih surovin, polizdelkov",
  "en": "Activities of agents involved in the wholesale of agricultural raw materials, live animals, textile raw materials and semi-finished goods",
  "p": "G46.11"
 },
 {
  "c": "G46.12",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo goriv, rud, kovin, tehničnih kemikalij",
  "en": "Activities of agents involved in the wholesale of fuels, ores, metals and industrial chemicals",
  "p": "G46.1"
 },
 {
  "c": "G46.120",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo goriv, rud, kovin, tehničnih kemikalij",
  "en": "Activities of agents involved in the wholesale of fuels, ores, metals and industrial chemicals",
  "p": "G46.12"
 },
 {
  "c": "G46.13",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo lesa in gradbenega materiala",
  "en": "Activities of agents involved in the wholesale of timber and building materials",
  "p": "G46.1"
 },
 {
  "c": "G46.130",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo lesa in gradbenega materiala",
  "en": "Activities of agents involved in the wholesale of timber and building materials",
  "p": "G46.13"
 },
 {
  "c": "G46.14",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo strojev, industrijske opreme, ladij, letal",
  "en": "Activities of agents involved in the wholesale of machinery, industrial equipment, ships and aircraft",
  "p": "G46.1"
 },
 {
  "c": "G46.140",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo strojev, industrijske opreme, ladij, letal",
  "en": "Activities of agents involved in the wholesale of machinery, industrial equipment, ships and aircraft",
  "p": "G46.14"
 },
 {
  "c": "G46.15",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo pohištva, predmetov in naprav za gospodinjstvo in železnine",
  "en": "Activities of agents involved in the wholesale of furniture, household goods, hardware and ironmongery",
  "p": "G46.1"
 },
 {
  "c": "G46.150",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo pohištva, predmetov in naprav za gospodinjstvo in železnine",
  "en": "Activities of agents involved in the wholesale of furniture, household goods, hardware and ironmongery",
  "p": "G46.15"
 },
 {
  "c": "G46.16",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo tekstila, oblačil, krzna, obutve, usnjenih izdelkov",
  "en": "Activities of agents involved in the wholesale of textiles, clothing, fur, footwear and leather goods",
  "p": "G46.1"
 },
 {
  "c": "G46.160",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo tekstila, oblačil, krzna, obutve, usnjenih izdelkov",
  "en": "Activities of agents involved in the wholesale of textiles, clothing, fur, footwear and leather goods",
  "p": "G46.16"
 },
 {
  "c": "G46.17",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo živil, pijač, tobačnih izdelkov",
  "en": "Activities of agents involved in the wholesale of food, beverages and tobacco",
  "p": "G46.1"
 },
 {
  "c": "G46.170",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo živil, pijač, tobačnih izdelkov",
  "en": "Activities of agents involved in the wholesale of food, beverages and tobacco",
  "p": "G46.17"
 },
 {
  "c": "G46.18",
  "l": 4,
  "sl": "Posredništvo pri prodaji na debelo drugih specializiranih izdelkov",
  "en": "Activities of agents involved in the wholesale of other particular products",
  "p": "G46.1"
 },
 {
  "c": "G46.180",
  "l": 5,
  "sl": "Posredništvo pri prodaji na debelo drugih specializiranih izdelkov",
  "en": "Activities of agents involved in the wholesale of other particular products",
  "p": "G46.18"
 },
 {
  "c": "G46.19",
  "l": 4,
  "sl": "Posredništvo pri nespecializirani prodaji na debelo",
  "en": "Activities of agents involved in non-specialised wholesale",
  "p": "G46.1"
 },
 {
  "c": "G46.190",
  "l": 5,
  "sl": "Posredništvo pri nespecializirani prodaji na debelo",
  "en": "Activities of agents involved in non-specialised wholesale",
  "p": "G46.19"
 },
 {
  "c": "G46.2",
  "l": 3,
  "sl": "Trgovina na debelo s kmetijskimi surovinami in živimi živalmi",
  "en": "Wholesale of agricultural raw materials and live animals",
  "p": "G46"
 },
 {
  "c": "G46.21",
  "l": 4,
  "sl": "Trgovina na debelo z žiti, tobakom, semeni in krmo",
  "en": "Wholesale of grain, unmanufactured tobacco, seeds and animal feeds",
  "p": "G46.2"
 },
 {
  "c": "G46.210",
  "l": 5,
  "sl": "Trgovina na debelo z žiti, tobakom, semeni in krmo",
  "en": "Wholesale of grain, unmanufactured tobacco, seeds and animal feeds",
  "p": "G46.21"
 },
 {
  "c": "G46.22",
  "l": 4,
  "sl": "Trgovina na debelo s cvetjem in rastlinami",
  "en": "Wholesale of flowers and plants",
  "p": "G46.2"
 },
 {
  "c": "G46.220",
  "l": 5,
  "sl": "Trgovina na debelo s cvetjem in rastlinami",
  "en": "Wholesale of flowers and plants",
  "p": "G46.22"
 },
 {
  "c": "G46.23",
  "l": 4,
  "sl": "Trgovina na debelo z živimi živalmi",
  "en": "Wholesale of live animals",
  "p": "G46.2"
 },
 {
  "c": "G46.230",
  "l": 5,
  "sl": "Trgovina na debelo z živimi živalmi",
  "en": "Wholesale of live animals",
  "p": "G46.23"
 },
 {
  "c": "G46.24",
  "l": 4,
  "sl": "Trgovina na debelo s kožami, usnjem",
  "en": "Wholesale of hides, skins and leather",
  "p": "G46.2"
 },
 {
  "c": "G46.240",
  "l": 5,
  "sl": "Trgovina na debelo s kožami, usnjem",
  "en": "Wholesale of hides, skins and leather",
  "p": "G46.24"
 },
 {
  "c": "G46.3",
  "l": 3,
  "sl": "Trgovina na debelo z živili, pijačami, tobačnimi izdelki",
  "en": "Wholesale of food, beverages and tobacco",
  "p": "G46"
 },
 {
  "c": "G46.31",
  "l": 4,
  "sl": "Trgovina na debelo s sadjem in zelenjavo",
  "en": "Wholesale of fruit and vegetables",
  "p": "G46.3"
 },
 {
  "c": "G46.310",
  "l": 5,
  "sl": "Trgovina na debelo s sadjem in zelenjavo",
  "en": "Wholesale of fruit and vegetables",
  "p": "G46.31"
 },
 {
  "c": "G46.32",
  "l": 4,
  "sl": "Trgovina na debelo z mesom, mesnimi izdelki, ribami in ribjimi izdelki",
  "en": "Wholesale of meat, meat products, fish and fish products",
  "p": "G46.3"
 },
 {
  "c": "G46.320",
  "l": 5,
  "sl": "Trgovina na debelo z mesom, mesnimi izdelki, ribami in ribjimi izdelki",
  "en": "Wholesale of meat, meat products, fish and fish products",
  "p": "G46.32"
 },
 {
  "c": "G46.33",
  "l": 4,
  "sl": "Trgovina na debelo z mlekom, mlečnimi izdelki, jajci, jedilnimi olji in maščobami",
  "en": "Wholesale of dairy products, eggs and edible oils and fats",
  "p": "G46.3"
 },
 {
  "c": "G46.330",
  "l": 5,
  "sl": "Trgovina na debelo z mlekom, mlečnimi izdelki, jajci, jedilnimi olji in maščobami",
  "en": "Wholesale of dairy products, eggs and edible oils and fats",
  "p": "G46.33"
 },
 {
  "c": "G46.34",
  "l": 4,
  "sl": "Trgovina na debelo s pijačami",
  "en": "Wholesale of beverages",
  "p": "G46.3"
 },
 {
  "c": "G46.340",
  "l": 5,
  "sl": "Trgovina na debelo s pijačami",
  "en": "Wholesale of beverages",
  "p": "G46.34"
 },
 {
  "c": "G46.35",
  "l": 4,
  "sl": "Trgovina na debelo s tobačnimi izdelki",
  "en": "Wholesale of tobacco products",
  "p": "G46.3"
 },
 {
  "c": "G46.350",
  "l": 5,
  "sl": "Trgovina na debelo s tobačnimi izdelki",
  "en": "Wholesale of tobacco products",
  "p": "G46.35"
 },
 {
  "c": "G46.36",
  "l": 4,
  "sl": "Trgovina na debelo s sladkorjem, čokolado, sladkornimi izdelki",
  "en": "Wholesale of sugar, chocolate and sugar confectionery",
  "p": "G46.3"
 },
 {
  "c": "G46.360",
  "l": 5,
  "sl": "Trgovina na debelo s sladkorjem, čokolado, sladkornimi izdelki",
  "en": "Wholesale of sugar, chocolate and sugar confectionery",
  "p": "G46.36"
 },
 {
  "c": "G46.37",
  "l": 4,
  "sl": "Trgovina na debelo s kavo, čajem, kakavom, začimbami",
  "en": "Wholesale of coffee, tea, cocoa and spices",
  "p": "G46.3"
 },
 {
  "c": "G46.370",
  "l": 5,
  "sl": "Trgovina na debelo s kavo, čajem, kakavom, začimbami",
  "en": "Wholesale of coffee, tea, cocoa and spices",
  "p": "G46.37"
 },
 {
  "c": "G46.38",
  "l": 4,
  "sl": "Trgovina na debelo z drugimi živili",
  "en": "Wholesale of other food",
  "p": "G46.3"
 },
 {
  "c": "G46.380",
  "l": 5,
  "sl": "Trgovina na debelo z drugimi živili",
  "en": "Wholesale of other food",
  "p": "G46.38"
 },
 {
  "c": "G46.39",
  "l": 4,
  "sl": "Nespecializirana trgovina na debelo z živili, pijačami, tobačnimi izdelki",
  "en": "Non-specialised wholesale of food, beverages and tobacco",
  "p": "G46.3"
 },
 {
  "c": "G46.390",
  "l": 5,
  "sl": "Nespecializirana trgovina na debelo z živili, pijačami, tobačnimi izdelki",
  "en": "Non-specialised wholesale of food, beverages and tobacco",
  "p": "G46.39"
 },
 {
  "c": "G46.4",
  "l": 3,
  "sl": "Trgovina na debelo z izdelki za široko rabo",
  "en": "Wholesale of household goods",
  "p": "G46"
 },
 {
  "c": "G46.41",
  "l": 4,
  "sl": "Trgovina na debelo s tekstilom",
  "en": "Wholesale of textiles",
  "p": "G46.4"
 },
 {
  "c": "G46.410",
  "l": 5,
  "sl": "Trgovina na debelo s tekstilom",
  "en": "Wholesale of textiles",
  "p": "G46.41"
 },
 {
  "c": "G46.42",
  "l": 4,
  "sl": "Trgovina na debelo z oblačili in obutvijo",
  "en": "Wholesale of clothing and footwear",
  "p": "G46.4"
 },
 {
  "c": "G46.420",
  "l": 5,
  "sl": "Trgovina na debelo z oblačili in obutvijo",
  "en": "Wholesale of clothing and footwear",
  "p": "G46.42"
 },
 {
  "c": "G46.43",
  "l": 4,
  "sl": "Trgovina na debelo z električnimi gospodinjskimi napravami",
  "en": "Wholesale of electrical household appliances",
  "p": "G46.4"
 },
 {
  "c": "G46.430",
  "l": 5,
  "sl": "Trgovina na debelo z električnimi gospodinjskimi napravami",
  "en": "Wholesale of electrical household appliances",
  "p": "G46.43"
 },
 {
  "c": "G46.44",
  "l": 4,
  "sl": "Trgovina na debelo s porcelanom, steklenino, čistili",
  "en": "Wholesale of china and glassware and cleaning materials",
  "p": "G46.4"
 },
 {
  "c": "G46.440",
  "l": 5,
  "sl": "Trgovina na debelo s porcelanom, steklenino, čistili",
  "en": "Wholesale of china and glassware and cleaning materials",
  "p": "G46.44"
 },
 {
  "c": "G46.45",
  "l": 4,
  "sl": "Trgovina na debelo s parfumi in kozmetiko",
  "en": "Wholesale of perfume and cosmetics",
  "p": "G46.4"
 },
 {
  "c": "G46.450",
  "l": 5,
  "sl": "Trgovina na debelo s parfumi in kozmetiko",
  "en": "Wholesale of perfume and cosmetics",
  "p": "G46.45"
 },
 {
  "c": "G46.46",
  "l": 4,
  "sl": "Trgovina na debelo s farmacevtskimi in medicinskimi izdelki",
  "en": "Wholesale of pharmaceutical and medical goods",
  "p": "G46.4"
 },
 {
  "c": "G46.460",
  "l": 5,
  "sl": "Trgovina na debelo s farmacevtskimi in medicinskimi izdelki",
  "en": "Wholesale of pharmaceutical and medical goods",
  "p": "G46.46"
 },
 {
  "c": "G46.47",
  "l": 4,
  "sl": "Trgovina na debelo s pohištvom, preprogami in svetili za dom, pisarne in trgovine",
  "en": "Wholesale of household, office and shop furniture, carpets and lighting equipment",
  "p": "G46.4"
 },
 {
  "c": "G46.470",
  "l": 5,
  "sl": "Trgovina na debelo s pohištvom, preprogami in svetili za dom, pisarne in trgovine",
  "en": "Wholesale of household, office and shop furniture, carpets and lighting equipment",
  "p": "G46.47"
 },
 {
  "c": "G46.48",
  "l": 4,
  "sl": "Trgovina na debelo z urami in nakitom",
  "en": "Wholesale of watches and jewellery",
  "p": "G46.4"
 },
 {
  "c": "G46.480",
  "l": 5,
  "sl": "Trgovina na debelo z urami in nakitom",
  "en": "Wholesale of watches and jewellery",
  "p": "G46.48"
 },
 {
  "c": "G46.49",
  "l": 4,
  "sl": "Trgovina na debelo z drugimi izdelki široke porabe",
  "en": "Wholesale of other household goods",
  "p": "G46.4"
 },
 {
  "c": "G46.490",
  "l": 5,
  "sl": "Trgovina na debelo z drugimi izdelki široke porabe",
  "en": "Wholesale of other household goods",
  "p": "G46.49"
 },
 {
  "c": "G46.5",
  "l": 3,
  "sl": "Trgovina na debelo z napravami za informacijsko-komunikacijsko tehnologijo",
  "en": "Wholesale of information and communication equipment",
  "p": "G46"
 },
 {
  "c": "G46.50",
  "l": 4,
  "sl": "Trgovina na debelo z napravami za informacijsko-komunikacijsko tehnologijo",
  "en": "Wholesale of information and communication equipment",
  "p": "G46.5"
 },
 {
  "c": "G46.500",
  "l": 5,
  "sl": "Trgovina na debelo z napravami za informacijsko-komunikacijsko tehnologijo",
  "en": "Wholesale of information and communication equipment",
  "p": "G46.50"
 },
 {
  "c": "G46.6",
  "l": 3,
  "sl": "Trgovina na debelo z drugimi stroji, napravami, opremo",
  "en": "Wholesale of other machinery, equipment and supplies",
  "p": "G46"
 },
 {
  "c": "G46.61",
  "l": 4,
  "sl": "Trgovina na debelo s kmetijskimi stroji, priključki, opremo",
  "en": "Wholesale of agricultural machinery, equipment and supplies",
  "p": "G46.6"
 },
 {
  "c": "G46.610",
  "l": 5,
  "sl": "Trgovina na debelo s kmetijskimi stroji, priključki, opremo",
  "en": "Wholesale of agricultural machinery, equipment and supplies",
  "p": "G46.61"
 },
 {
  "c": "G46.62",
  "l": 4,
  "sl": "Trgovina na debelo z obdelovalnimi stroji",
  "en": "Wholesale of machine tools",
  "p": "G46.6"
 },
 {
  "c": "G46.620",
  "l": 5,
  "sl": "Trgovina na debelo z obdelovalnimi stroji",
  "en": "Wholesale of machine tools",
  "p": "G46.62"
 },
 {
  "c": "G46.63",
  "l": 4,
  "sl": "Trgovina na debelo z rudarskimi in gradbenimi stroji",
  "en": "Wholesale of mining, construction and civil engineering machinery",
  "p": "G46.6"
 },
 {
  "c": "G46.630",
  "l": 5,
  "sl": "Trgovina na debelo z rudarskimi in gradbenimi stroji",
  "en": "Wholesale of mining, construction and civil engineering machinery",
  "p": "G46.63"
 },
 {
  "c": "G46.64",
  "l": 4,
  "sl": "Trgovina na debelo z drugimi napravami in opremo",
  "en": "Wholesale of other machinery and equipment",
  "p": "G46.6"
 },
 {
  "c": "G46.640",
  "l": 5,
  "sl": "Trgovina na debelo z drugimi napravami in opremo",
  "en": "Wholesale of other machinery and equipment",
  "p": "G46.64"
 },
 {
  "c": "G46.7",
  "l": 3,
  "sl": "Trgovina na debelo z motornimi vozili, motornimi kolesi ter deli in opremo zanje",
  "en": "Wholesale of motor vehicles, motorcycles and related parts and accessories",
  "p": "G46"
 },
 {
  "c": "G46.71",
  "l": 4,
  "sl": "Trgovina na debelo z motornimi vozili",
  "en": "Wholesale of motor vehicles",
  "p": "G46.7"
 },
 {
  "c": "G46.710",
  "l": 5,
  "sl": "Trgovina na debelo z motornimi vozili",
  "en": "Wholesale of motor vehicles",
  "p": "G46.71"
 },
 {
  "c": "G46.72",
  "l": 4,
  "sl": "Trgovina na debelo z deli in opremo za motorna vozila",
  "en": "Wholesale of motor vehicle parts and accessories",
  "p": "G46.7"
 },
 {
  "c": "G46.720",
  "l": 5,
  "sl": "Trgovina na debelo z deli in opremo za motorna vozila",
  "en": "Wholesale of motor vehicle parts and accessories",
  "p": "G46.72"
 },
 {
  "c": "G46.73",
  "l": 4,
  "sl": "Trgovina na debelo z motornimi kolesi ter deli in opremo zanje",
  "en": "Wholesale of motorcycles, motorcycle parts and accessories",
  "p": "G46.7"
 },
 {
  "c": "G46.730",
  "l": 5,
  "sl": "Trgovina na debelo z motornimi kolesi ter deli in opremo zanje",
  "en": "Wholesale of motorcycles, motorcycle parts and accessories",
  "p": "G46.73"
 },
 {
  "c": "G46.8",
  "l": 3,
  "sl": "Druga specializirana trgovina na debelo",
  "en": "Other specialised wholesale",
  "p": "G46"
 },
 {
  "c": "G46.81",
  "l": 4,
  "sl": "Trgovina na debelo s trdimi, tekočimi in plinastimi gorivi ter povezanimi proizvodi",
  "en": "Wholesale of solid, liquid and gaseous fuels and related products",
  "p": "G46.8"
 },
 {
  "c": "G46.810",
  "l": 5,
  "sl": "Trgovina na debelo s trdimi, tekočimi in plinastimi gorivi ter povezanimi proizvodi",
  "en": "Wholesale of solid, liquid and gaseous fuels and related products",
  "p": "G46.81"
 },
 {
  "c": "G46.82",
  "l": 4,
  "sl": "Trgovina na debelo s kovinami in rudami",
  "en": "Wholesale of metals and metal ores",
  "p": "G46.8"
 },
 {
  "c": "G46.820",
  "l": 5,
  "sl": "Trgovina na debelo s kovinami in rudami",
  "en": "Wholesale of metals and metal ores",
  "p": "G46.82"
 },
 {
  "c": "G46.83",
  "l": 4,
  "sl": "Trgovina na debelo z lesom, gradbenim materialom in sanitarno opremo",
  "en": "Wholesale of wood, construction materials and sanitary equipment",
  "p": "G46.8"
 },
 {
  "c": "G46.830",
  "l": 5,
  "sl": "Trgovina na debelo z lesom, gradbenim materialom in sanitarno opremo",
  "en": "Wholesale of wood, construction materials and sanitary equipment",
  "p": "G46.83"
 },
 {
  "c": "G46.84",
  "l": 4,
  "sl": "Trgovina na debelo s kovinskimi proizvodi, inštalacijskim materialom, napravami za ogrevanje",
  "en": "Wholesale of hardware, plumbing and heating equipment and supplies",
  "p": "G46.8"
 },
 {
  "c": "G46.840",
  "l": 5,
  "sl": "Trgovina na debelo s kovinskimi proizvodi, inštalacijskim materialom, napravami za ogrevanje",
  "en": "Wholesale of hardware, plumbing and heating equipment and supplies",
  "p": "G46.84"
 },
 {
  "c": "G46.85",
  "l": 4,
  "sl": "Trgovina na debelo s kemičnimi izdelki",
  "en": "Wholesale of chemical products",
  "p": "G46.8"
 },
 {
  "c": "G46.850",
  "l": 5,
  "sl": "Trgovina na debelo s kemičnimi izdelki",
  "en": "Wholesale of chemical products",
  "p": "G46.85"
 },
 {
  "c": "G46.86",
  "l": 4,
  "sl": "Trgovina na debelo z drugimi polizdelki",
  "en": "Wholesale of other intermediate products",
  "p": "G46.8"
 },
 {
  "c": "G46.860",
  "l": 5,
  "sl": "Trgovina na debelo z drugimi polizdelki",
  "en": "Wholesale of other intermediate products",
  "p": "G46.86"
 },
 {
  "c": "G46.87",
  "l": 4,
  "sl": "Trgovina na debelo z ostanki in odpadki",
  "en": "Wholesale of waste and scrap",
  "p": "G46.8"
 },
 {
  "c": "G46.870",
  "l": 5,
  "sl": "Trgovina na debelo z ostanki in odpadki",
  "en": "Wholesale of waste and scrap",
  "p": "G46.87"
 },
 {
  "c": "G46.89",
  "l": 4,
  "sl": "Druga specializirana trgovina na debelo, d. n.",
  "en": "Other specialised wholesale n.e.c.",
  "p": "G46.8"
 },
 {
  "c": "G46.890",
  "l": 5,
  "sl": "Druga specializirana trgovina na debelo, d. n.",
  "en": "Other specialised wholesale n.e.c.",
  "p": "G46.89"
 },
 {
  "c": "G46.9",
  "l": 3,
  "sl": "Nespecializirana trgovina na debelo",
  "en": "Non-specialised wholesale trade",
  "p": "G46"
 },
 {
  "c": "G46.90",
  "l": 4,
  "sl": "Nespecializirana trgovina na debelo",
  "en": "Non-specialised wholesale trade",
  "p": "G46.9"
 },
 {
  "c": "G46.900",
  "l": 5,
  "sl": "Nespecializirana trgovina na debelo",
  "en": "Non-specialised wholesale trade",
  "p": "G46.90"
 },
 {
  "c": "G47",
  "l": 2,
  "sl": "Trgovina na drobno",
  "en": "Retail trade",
  "p": "G"
 },
 {
  "c": "G47.1",
  "l": 3,
  "sl": "Nespecializirana trgovina na drobno",
  "en": "Non-specialised retail sale",
  "p": "G47"
 },
 {
  "c": "G47.11",
  "l": 4,
  "sl": "Nespecializirana trgovina na drobno, predvsem z živili, pijačami ali tobačnimi izdelki",
  "en": "Non-specialised retail sale of predominately food, beverages or tobacco",
  "p": "G47.1"
 },
 {
  "c": "G47.110",
  "l": 5,
  "sl": "Nespecializirana trgovina na drobno, predvsem z živili, pijačami ali tobačnimi izdelki",
  "en": "Non-specialised retail sale of predominately food, beverages or tobacco",
  "p": "G47.11"
 },
 {
  "c": "G47.12",
  "l": 4,
  "sl": "Druga nespecializirana trgovina na drobno",
  "en": "Other non-specialised retail sale",
  "p": "G47.1"
 },
 {
  "c": "G47.120",
  "l": 5,
  "sl": "Druga nespecializirana trgovina na drobno",
  "en": "Other non-specialised retail sale",
  "p": "G47.12"
 },
 {
  "c": "G47.2",
  "l": 3,
  "sl": "Trgovina na drobno z živili, pijačami in tobačnimi izdelki",
  "en": "Retail sale of food, beverages and tobacco",
  "p": "G47"
 },
 {
  "c": "G47.21",
  "l": 4,
  "sl": "Trgovina na drobno s sadjem in zelenjavo",
  "en": "Retail sale of fruit and vegetables",
  "p": "G47.2"
 },
 {
  "c": "G47.210",
  "l": 5,
  "sl": "Trgovina na drobno s sadjem in zelenjavo",
  "en": "Retail sale of fruit and vegetables",
  "p": "G47.21"
 },
 {
  "c": "G47.22",
  "l": 4,
  "sl": "Trgovina na drobno z mesom in mesnimi izdelki",
  "en": "Retail sale of meat and meat products",
  "p": "G47.2"
 },
 {
  "c": "G47.220",
  "l": 5,
  "sl": "Trgovina na drobno z mesom in mesnimi izdelki",
  "en": "Retail sale of meat and meat products",
  "p": "G47.22"
 },
 {
  "c": "G47.23",
  "l": 4,
  "sl": "Trgovina na drobno z ribami, raki, mehkužci",
  "en": "Retail sale of fish, crustaceans and molluscs",
  "p": "G47.2"
 },
 {
  "c": "G47.230",
  "l": 5,
  "sl": "Trgovina na drobno z ribami, raki, mehkužci",
  "en": "Retail sale of fish, crustaceans and molluscs",
  "p": "G47.23"
 },
 {
  "c": "G47.24",
  "l": 4,
  "sl": "Trgovina na drobno s kruhom, pecivom in slaščicami",
  "en": "Retail sale of bread, cake and confectionery",
  "p": "G47.2"
 },
 {
  "c": "G47.240",
  "l": 5,
  "sl": "Trgovina na drobno s kruhom, pecivom in slaščicami",
  "en": "Retail sale of bread, cake and confectionery",
  "p": "G47.24"
 },
 {
  "c": "G47.25",
  "l": 4,
  "sl": "Trgovina na drobno s pijačami",
  "en": "Retail sale of beverages",
  "p": "G47.2"
 },
 {
  "c": "G47.250",
  "l": 5,
  "sl": "Trgovina na drobno s pijačami",
  "en": "Retail sale of beverages",
  "p": "G47.25"
 },
 {
  "c": "G47.26",
  "l": 4,
  "sl": "Trgovina na drobno s tobačnimi izdelki",
  "en": "Retail sale of tobacco products",
  "p": "G47.2"
 },
 {
  "c": "G47.260",
  "l": 5,
  "sl": "Trgovina na drobno s tobačnimi izdelki",
  "en": "Retail sale of tobacco products",
  "p": "G47.26"
 },
 {
  "c": "G47.27",
  "l": 4,
  "sl": "Trgovina na drobno z drugimi živili",
  "en": "Retail sale of other food",
  "p": "G47.2"
 },
 {
  "c": "G47.270",
  "l": 5,
  "sl": "Trgovina na drobno z drugimi živili",
  "en": "Retail sale of other food",
  "p": "G47.27"
 },
 {
  "c": "G47.3",
  "l": 3,
  "sl": "Trgovina na drobno z motornimi gorivi",
  "en": "Retail sale of automotive fuel",
  "p": "G47"
 },
 {
  "c": "G47.30",
  "l": 4,
  "sl": "Trgovina na drobno z motornimi gorivi",
  "en": "Retail sale of automotive fuel",
  "p": "G47.3"
 },
 {
  "c": "G47.301",
  "l": 5,
  "sl": "Trgovina na drobno z lastnimi motornimi gorivi",
  "en": "Retail sale of own automotive fuel",
  "p": "G47.30"
 },
 {
  "c": "G47.302",
  "l": 5,
  "sl": "Posredništvo pri prodaji motornih goriv na drobno",
  "en": "Agents involved in retail sale of automotive fuel",
  "p": "G47.30"
 },
 {
  "c": "G47.4",
  "l": 3,
  "sl": "Trgovina na drobno z računalniškimi in komunikacijskimi napravami",
  "en": "Retail sale of information and communication equipment",
  "p": "G47"
 },
 {
  "c": "G47.40",
  "l": 4,
  "sl": "Trgovina na drobno z računalniškimi in komunikacijskimi napravami",
  "en": "Retail sale of information and communication equipment",
  "p": "G47.4"
 },
 {
  "c": "G47.400",
  "l": 5,
  "sl": "Trgovina na drobno z računalniškimi in komunikacijskimi napravami",
  "en": "Retail sale of information and communication equipment",
  "p": "G47.40"
 },
 {
  "c": "G47.5",
  "l": 3,
  "sl": "Trgovina na drobno z drugo gospodinjsko opremo",
  "en": "Retail sale of other household equipment",
  "p": "G47"
 },
 {
  "c": "G47.51",
  "l": 4,
  "sl": "Trgovina na drobno s tekstilom",
  "en": "Retail sale of textiles",
  "p": "G47.5"
 },
 {
  "c": "G47.510",
  "l": 5,
  "sl": "Trgovina na drobno s tekstilom",
  "en": "Retail sale of textiles",
  "p": "G47.51"
 },
 {
  "c": "G47.52",
  "l": 4,
  "sl": "Trgovina na drobno s kovinskimi izdelki, gradbenim materialom, barvami in steklom",
  "en": "Retail sale of hardware, building materials, paints and glass",
  "p": "G47.5"
 },
 {
  "c": "G47.520",
  "l": 5,
  "sl": "Trgovina na drobno s kovinskimi izdelki, gradbenim materialom, barvami in steklom",
  "en": "Retail sale of hardware, building materials, paints and glass",
  "p": "G47.52"
 },
 {
  "c": "G47.53",
  "l": 4,
  "sl": "Trgovina na drobno s preprogami, talnimi in stenskimi oblogami",
  "en": "Retail sale of carpets, rugs, wall and floor coverings",
  "p": "G47.5"
 },
 {
  "c": "G47.530",
  "l": 5,
  "sl": "Trgovina na drobno s preprogami, talnimi in stenskimi oblogami",
  "en": "Retail sale of carpets, rugs, wall and floor coverings",
  "p": "G47.53"
 },
 {
  "c": "G47.54",
  "l": 4,
  "sl": "Trgovina na drobno z električnimi gospodinjskimi napravami",
  "en": "Retail sale of electrical household appliances",
  "p": "G47.5"
 },
 {
  "c": "G47.540",
  "l": 5,
  "sl": "Trgovina na drobno z električnimi gospodinjskimi napravami",
  "en": "Retail sale of electrical household appliances",
  "p": "G47.54"
 },
 {
  "c": "G47.55",
  "l": 4,
  "sl": "Trgovina na drobno s pohištvom, svetili, namizno posodo in drugimi izdelki za gospodinjstvo",
  "en": "Retail sale of furniture, lighting equipment, tableware and other household goods",
  "p": "G47.5"
 },
 {
  "c": "G47.550",
  "l": 5,
  "sl": "Trgovina na drobno s pohištvom, svetili, namizno posodo in drugimi izdelki za gospodinjstvo",
  "en": "Retail sale of furniture, lighting equipment, tableware and other household goods",
  "p": "G47.55"
 },
 {
  "c": "G47.6",
  "l": 3,
  "sl": "Trgovina na drobno z izdelki za kulturo, šport in zabavo",
  "en": "Retail sale of cultural and recreational goods",
  "p": "G47"
 },
 {
  "c": "G47.61",
  "l": 4,
  "sl": "Trgovina na drobno s knjigami",
  "en": "Retail sale of books",
  "p": "G47.6"
 },
 {
  "c": "G47.610",
  "l": 5,
  "sl": "Trgovina na drobno s knjigami",
  "en": "Retail sale of books",
  "p": "G47.61"
 },
 {
  "c": "G47.62",
  "l": 4,
  "sl": "Trgovina na drobno s časopisi in drugimi periodičnimi publikacijami ter pisalnimi potrebščinami",
  "en": "Retail sale of newspapers, and other periodical publications and stationery",
  "p": "G47.6"
 },
 {
  "c": "G47.621",
  "l": 5,
  "sl": "Trgovina na drobno s časopisi in revijami",
  "en": "Retail sale of newspapers",
  "p": "G47.62"
 },
 {
  "c": "G47.622",
  "l": 5,
  "sl": "Trgovina na drobno s papirjem in pisalnimi potrebščinami",
  "en": "Retail sale of stationery",
  "p": "G47.62"
 },
 {
  "c": "G47.63",
  "l": 4,
  "sl": "Trgovina na drobno s športno opremo",
  "en": "Retail sale of sporting equipment",
  "p": "G47.6"
 },
 {
  "c": "G47.630",
  "l": 5,
  "sl": "Trgovina na drobno s športno opremo",
  "en": "Retail sale of sporting equipment",
  "p": "G47.63"
 },
 {
  "c": "G47.64",
  "l": 4,
  "sl": "Trgovina na drobno z igrami in igračami",
  "en": "Retail sale of games and toys",
  "p": "G47.6"
 },
 {
  "c": "G47.640",
  "l": 5,
  "sl": "Trgovina na drobno z igrami in igračami",
  "en": "Retail sale of games and toys",
  "p": "G47.64"
 },
 {
  "c": "G47.69",
  "l": 4,
  "sl": "Trgovina na drobno z izdelki za kulturo, šport in zabavo, d. n.",
  "en": "Retail sale of cultural and recreational goods n.e.c.",
  "p": "G47.6"
 },
 {
  "c": "G47.690",
  "l": 5,
  "sl": "Trgovina na drobno z izdelki za kulturo, šport in zabavo, d. n.",
  "en": "Retail sale of cultural and recreational goods n.e.c.",
  "p": "G47.69"
 },
 {
  "c": "G47.7",
  "l": 3,
  "sl": "Trgovina na drobno z drugim blagom, razen motornih vozil in motornih koles",
  "en": "Retail sale of other goods, except motor vehicles and motorcycles",
  "p": "G47"
 },
 {
  "c": "G47.71",
  "l": 4,
  "sl": "Trgovina na drobno z oblačili",
  "en": "Retail sale of clothing",
  "p": "G47.7"
 },
 {
  "c": "G47.710",
  "l": 5,
  "sl": "Trgovina na drobno z oblačili",
  "en": "Retail sale of clothing",
  "p": "G47.71"
 },
 {
  "c": "G47.72",
  "l": 4,
  "sl": "Trgovina na drobno z obutvijo in usnjenimi izdelki",
  "en": "Retail sale of footwear and leather goods",
  "p": "G47.7"
 },
 {
  "c": "G47.720",
  "l": 5,
  "sl": "Trgovina na drobno z obutvijo in usnjenimi izdelki",
  "en": "Retail sale of footwear and leather goods",
  "p": "G47.72"
 },
 {
  "c": "G47.73",
  "l": 4,
  "sl": "Trgovina na drobno s farmacevtskimi izdelki",
  "en": "Retail sale of pharmaceutical products",
  "p": "G47.7"
 },
 {
  "c": "G47.730",
  "l": 5,
  "sl": "Trgovina na drobno s farmacevtskimi izdelki",
  "en": "Retail sale of pharmaceutical products",
  "p": "G47.73"
 },
 {
  "c": "G47.74",
  "l": 4,
  "sl": "Trgovina na drobno z medicinskimi in ortopedskimi izdelki",
  "en": "Retail sale of medical and orthopaedic goods",
  "p": "G47.7"
 },
 {
  "c": "G47.740",
  "l": 5,
  "sl": "Trgovina na drobno z medicinskimi in ortopedskimi izdelki",
  "en": "Retail sale of medical and orthopaedic goods",
  "p": "G47.74"
 },
 {
  "c": "G47.75",
  "l": 4,
  "sl": "Trgovina na drobno s kozmetičnimi in toaletnimi izdelki",
  "en": "Retail sale of cosmetic and toilet articles",
  "p": "G47.7"
 },
 {
  "c": "G47.750",
  "l": 5,
  "sl": "Trgovina na drobno s kozmetičnimi in toaletnimi izdelki",
  "en": "Retail sale of cosmetic and toilet articles",
  "p": "G47.75"
 },
 {
  "c": "G47.76",
  "l": 4,
  "sl": "Trgovina na drobno s cvetjem, rastlinami, gnojili, hišnimi živalmi in hrano za živali",
  "en": "Retail sale of flowers, plants, fertilisers, pets and pet food",
  "p": "G47.7"
 },
 {
  "c": "G47.761",
  "l": 5,
  "sl": "Trgovina na drobno v cvetličarnah",
  "en": "Retail sale in florists shops",
  "p": "G47.76"
 },
 {
  "c": "G47.762",
  "l": 5,
  "sl": "Trgovina na drobno z vrtnarsko opremo in hišnimi živalmi",
  "en": "Retail sale of gardening material, pet animals and pet food",
  "p": "G47.76"
 },
 {
  "c": "G47.77",
  "l": 4,
  "sl": "Trgovina na drobno z urami in nakitom",
  "en": "Retail sale of watches and jewellery",
  "p": "G47.7"
 },
 {
  "c": "G47.770",
  "l": 5,
  "sl": "Trgovina na drobno z urami in nakitom",
  "en": "Retail sale of watches and jewellery",
  "p": "G47.77"
 },
 {
  "c": "G47.78",
  "l": 4,
  "sl": "Trgovina na drobno z drugim novim blagom",
  "en": "Retail sale of other new goods",
  "p": "G47.7"
 },
 {
  "c": "G47.780",
  "l": 5,
  "sl": "Trgovina na drobno z drugim novim blagom",
  "en": "Retail sale of other new goods",
  "p": "G47.78"
 },
 {
  "c": "G47.79",
  "l": 4,
  "sl": "Trgovina na drobno z rabljenim blagom",
  "en": "Retail sale of second-hand goods",
  "p": "G47.7"
 },
 {
  "c": "G47.790",
  "l": 5,
  "sl": "Trgovina na drobno z rabljenim blagom",
  "en": "Retail sale of second-hand goods",
  "p": "G47.79"
 },
 {
  "c": "G47.8",
  "l": 3,
  "sl": "Trgovina na drobno z motornimi vozili, motornimi kolesi ter deli in opremo zanje",
  "en": "Retail sale of motor vehicles, motorcycles and related parts and accessories",
  "p": "G47"
 },
 {
  "c": "G47.81",
  "l": 4,
  "sl": "Trgovina na drobno z motornimi vozili",
  "en": "Retail sale of motor vehicles",
  "p": "G47.8"
 },
 {
  "c": "G47.810",
  "l": 5,
  "sl": "Trgovina na drobno z motornimi vozili",
  "en": "Retail sale of motor vehicles",
  "p": "G47.81"
 },
 {
  "c": "G47.82",
  "l": 4,
  "sl": "Trgovina na drobno z rezervnimi deli in opremo za motorna vozila",
  "en": "Retail sale of motor vehicle parts and accessories",
  "p": "G47.8"
 },
 {
  "c": "G47.820",
  "l": 5,
  "sl": "Trgovina na drobno z rezervnimi deli in opremo za motorna vozila",
  "en": "Retail sale of motor vehicle parts and accessories",
  "p": "G47.82"
 },
 {
  "c": "G47.83",
  "l": 4,
  "sl": "Trgovina na drobno z motornimi kolesi ter deli in opremo zanje",
  "en": "Retail sale of motorcycles, motorcycle parts and accessories",
  "p": "G47.8"
 },
 {
  "c": "G47.830",
  "l": 5,
  "sl": "Trgovina na drobno z motornimi kolesi ter deli in opremo zanje",
  "en": "Retail sale of motorcycles, motorcycle parts and accessories",
  "p": "G47.83"
 },
 {
  "c": "G47.9",
  "l": 3,
  "sl": "Posredniške dejavnosti za prodajo na drobno",
  "en": "Intermediation service activities for retail sale",
  "p": "G47"
 },
 {
  "c": "G47.91",
  "l": 4,
  "sl": "Posredniške dejavnosti za nespecializirano prodajo na drobno",
  "en": "Intermediation service activities for non-specialised retail sale",
  "p": "G47.9"
 },
 {
  "c": "G47.910",
  "l": 5,
  "sl": "Posredniške dejavnosti za nespecializirano prodajo na drobno",
  "en": "Intermediation service activities for non-specialised retail sale",
  "p": "G47.91"
 },
 {
  "c": "G47.92",
  "l": 4,
  "sl": "Posredniške dejavnosti za specializirano prodajo na drobno",
  "en": "Intermediation service activities for specialised retail sale",
  "p": "G47.9"
 },
 {
  "c": "G47.920",
  "l": 5,
  "sl": "Posredniške dejavnosti za specializirano prodajo na drobno",
  "en": "Intermediation service activities for specialised retail sale",
  "p": "G47.92"
 },
 {
  "c": "H",
  "l": 1,
  "sl": "PREVOZ IN SKLADIŠČENJE",
  "en": "TRANSPORTATION AND STORAGE",
  "p": null
 },
 {
  "c": "H49",
  "l": 2,
  "sl": "Kopenski prevoz, cevovodni transport",
  "en": "Land transport and transport via pipelines",
  "p": "H"
 },
 {
  "c": "H49.1",
  "l": 3,
  "sl": "Železniški potniški prevoz",
  "en": "Passenger rail transport",
  "p": "H49"
 },
 {
  "c": "H49.11",
  "l": 4,
  "sl": "Težek železniški potniški prevoz",
  "en": "Passenger heavy rail transport",
  "p": "H49.1"
 },
 {
  "c": "H49.110",
  "l": 5,
  "sl": "Težek železniški potniški prevoz",
  "en": "Passenger heavy rail transport",
  "p": "H49.11"
 },
 {
  "c": "H49.12",
  "l": 4,
  "sl": "Drug železniški potniški prevoz",
  "en": "Other passenger rail transport",
  "p": "H49.1"
 },
 {
  "c": "H49.120",
  "l": 5,
  "sl": "Drug železniški potniški prevoz",
  "en": "Other passenger rail transport",
  "p": "H49.12"
 },
 {
  "c": "H49.2",
  "l": 3,
  "sl": "Železniški tovorni prevoz",
  "en": "Freight rail transport",
  "p": "H49"
 },
 {
  "c": "H49.20",
  "l": 4,
  "sl": "Železniški tovorni prevoz",
  "en": "Freight rail transport",
  "p": "H49.2"
 },
 {
  "c": "H49.200",
  "l": 5,
  "sl": "Železniški tovorni prevoz",
  "en": "Freight rail transport",
  "p": "H49.20"
 },
 {
  "c": "H49.3",
  "l": 3,
  "sl": "Drug kopenski potniški prevoz",
  "en": "Other passenger land transport",
  "p": "H49"
 },
 {
  "c": "H49.31",
  "l": 4,
  "sl": "Linijski cestni potniški prevoz",
  "en": "Scheduled passenger transport by road",
  "p": "H49.3"
 },
 {
  "c": "H49.310",
  "l": 5,
  "sl": "Linijski cestni potniški prevoz",
  "en": "Scheduled passenger transport by road",
  "p": "H49.31"
 },
 {
  "c": "H49.32",
  "l": 4,
  "sl": "Posebni cestni potniški prevoz",
  "en": "Non-scheduled passenger transport by road",
  "p": "H49.3"
 },
 {
  "c": "H49.320",
  "l": 5,
  "sl": "Posebni cestni potniški prevoz",
  "en": "Non-scheduled passenger transport by road",
  "p": "H49.32"
 },
 {
  "c": "H49.33",
  "l": 4,
  "sl": "Storitve potniškega prevoza na zahtevo z vozilom z voznikom",
  "en": "On-demand passenger transport service activities by vehicle with driver",
  "p": "H49.3"
 },
 {
  "c": "H49.330",
  "l": 5,
  "sl": "Storitve potniškega prevoza na zahtevo z vozilom z voznikom",
  "en": "On-demand passenger transport service activities by vehicle with driver",
  "p": "H49.33"
 },
 {
  "c": "H49.34",
  "l": 4,
  "sl": "Potniški prevoz z žičnicami in sedežnicami",
  "en": "Passenger transport by cableways and ski lifts",
  "p": "H49.3"
 },
 {
  "c": "H49.340",
  "l": 5,
  "sl": "Potniški prevoz z žičnicami in sedežnicami",
  "en": "Passenger transport by cableways and ski lifts",
  "p": "H49.34"
 },
 {
  "c": "H49.39",
  "l": 4,
  "sl": "Drug kopenski potniški prevoz, d. n.",
  "en": "Other passenger land transport n.e.c.",
  "p": "H49.3"
 },
 {
  "c": "H49.390",
  "l": 5,
  "sl": "Drug kopenski potniški prevoz, d. n.",
  "en": "Other passenger land transport n.e.c.",
  "p": "H49.39"
 },
 {
  "c": "H49.4",
  "l": 3,
  "sl": "Cestni tovorni prevoz in selitvena dejavnost",
  "en": "Freight transport by road and removal services",
  "p": "H49"
 },
 {
  "c": "H49.41",
  "l": 4,
  "sl": "Cestni tovorni prevoz",
  "en": "Freight transport by road",
  "p": "H49.4"
 },
 {
  "c": "H49.410",
  "l": 5,
  "sl": "Cestni tovorni prevoz",
  "en": "Freight transport by road",
  "p": "H49.41"
 },
 {
  "c": "H49.42",
  "l": 4,
  "sl": "Selitvena dejavnost",
  "en": "Removal services",
  "p": "H49.4"
 },
 {
  "c": "H49.420",
  "l": 5,
  "sl": "Selitvena dejavnost",
  "en": "Removal services",
  "p": "H49.42"
 },
 {
  "c": "H49.5",
  "l": 3,
  "sl": "Cevovodni transport",
  "en": "Transport via pipeline",
  "p": "H49"
 },
 {
  "c": "H49.50",
  "l": 4,
  "sl": "Cevovodni transport",
  "en": "Transport via pipeline",
  "p": "H49.5"
 },
 {
  "c": "H49.500",
  "l": 5,
  "sl": "Cevovodni transport",
  "en": "Transport via pipeline",
  "p": "H49.50"
 },
 {
  "c": "H50",
  "l": 2,
  "sl": "Vodni prevoz",
  "en": "Water transport",
  "p": "H"
 },
 {
  "c": "H50.1",
  "l": 3,
  "sl": "Pomorski potniški prevoz",
  "en": "Sea and coastal passenger water transport",
  "p": "H50"
 },
 {
  "c": "H50.10",
  "l": 4,
  "sl": "Pomorski potniški prevoz",
  "en": "Sea and coastal passenger water transport",
  "p": "H50.1"
 },
 {
  "c": "H50.100",
  "l": 5,
  "sl": "Pomorski potniški prevoz",
  "en": "Sea and coastal passenger water transport",
  "p": "H50.10"
 },
 {
  "c": "H50.2",
  "l": 3,
  "sl": "Pomorski tovorni prevoz",
  "en": "Sea and coastal freight water transport",
  "p": "H50"
 },
 {
  "c": "H50.20",
  "l": 4,
  "sl": "Pomorski tovorni prevoz",
  "en": "Sea and coastal freight water transport",
  "p": "H50.2"
 },
 {
  "c": "H50.200",
  "l": 5,
  "sl": "Pomorski tovorni prevoz",
  "en": "Sea and coastal freight water transport",
  "p": "H50.20"
 },
 {
  "c": "H50.3",
  "l": 3,
  "sl": "Potniški prevoz po celinskih vodah",
  "en": "Inland passenger water transport",
  "p": "H50"
 },
 {
  "c": "H50.30",
  "l": 4,
  "sl": "Potniški prevoz po celinskih vodah",
  "en": "Inland passenger water transport",
  "p": "H50.3"
 },
 {
  "c": "H50.300",
  "l": 5,
  "sl": "Potniški prevoz po celinskih vodah",
  "en": "Inland passenger water transport",
  "p": "H50.30"
 },
 {
  "c": "H50.4",
  "l": 3,
  "sl": "Tovorni prevoz po celinskih vodah",
  "en": "Inland freight water transport",
  "p": "H50"
 },
 {
  "c": "H50.40",
  "l": 4,
  "sl": "Tovorni prevoz po celinskih vodah",
  "en": "Inland freight water transport",
  "p": "H50.4"
 },
 {
  "c": "H50.400",
  "l": 5,
  "sl": "Tovorni prevoz po celinskih vodah",
  "en": "Inland freight water transport",
  "p": "H50.40"
 },
 {
  "c": "H51",
  "l": 2,
  "sl": "Zračni prevoz",
  "en": "Air transport",
  "p": "H"
 },
 {
  "c": "H51.1",
  "l": 3,
  "sl": "Potniški zračni prevoz",
  "en": "Passenger air transport",
  "p": "H51"
 },
 {
  "c": "H51.10",
  "l": 4,
  "sl": "Potniški zračni prevoz",
  "en": "Passenger air transport",
  "p": "H51.1"
 },
 {
  "c": "H51.100",
  "l": 5,
  "sl": "Potniški zračni prevoz",
  "en": "Passenger air transport",
  "p": "H51.10"
 },
 {
  "c": "H51.2",
  "l": 3,
  "sl": "Tovorni zračni in vesoljski prevoz",
  "en": "Freight air transport and space transport",
  "p": "H51"
 },
 {
  "c": "H51.21",
  "l": 4,
  "sl": "Tovorni zračni prevoz",
  "en": "Freight air transport",
  "p": "H51.2"
 },
 {
  "c": "H51.210",
  "l": 5,
  "sl": "Tovorni zračni prevoz",
  "en": "Freight air transport",
  "p": "H51.21"
 },
 {
  "c": "H51.22",
  "l": 4,
  "sl": "Vesoljski prevoz",
  "en": "Space transport",
  "p": "H51.2"
 },
 {
  "c": "H51.220",
  "l": 5,
  "sl": "Vesoljski prevoz",
  "en": "Space transport",
  "p": "H51.22"
 },
 {
  "c": "H52",
  "l": 2,
  "sl": "Skladiščenje in spremljajoče prevozne dejavnosti",
  "en": "Warehousing, storage and support activities for transportation",
  "p": "H"
 },
 {
  "c": "H52.1",
  "l": 3,
  "sl": "Skladiščenje",
  "en": "Warehousing and storage",
  "p": "H52"
 },
 {
  "c": "H52.10",
  "l": 4,
  "sl": "Skladiščenje",
  "en": "Warehousing and storage",
  "p": "H52.1"
 },
 {
  "c": "H52.100",
  "l": 5,
  "sl": "Skladiščenje",
  "en": "Warehousing and storage",
  "p": "H52.10"
 },
 {
  "c": "H52.2",
  "l": 3,
  "sl": "Spremljajoče prevozne dejavnosti",
  "en": "Support activities for transportation",
  "p": "H52"
 },
 {
  "c": "H52.21",
  "l": 4,
  "sl": "Spremljajoče storitvene dejavnosti v kopenskem prevozu",
  "en": "Service activities incidental to land transportation",
  "p": "H52.2"
 },
 {
  "c": "H52.210",
  "l": 5,
  "sl": "Spremljajoče storitvene dejavnosti v kopenskem prevozu",
  "en": "Service activities incidental to land transportation",
  "p": "H52.21"
 },
 {
  "c": "H52.22",
  "l": 4,
  "sl": "Spremljajoče storitvene dejavnosti v vodnem prevozu",
  "en": "Service activities incidental to water transportation",
  "p": "H52.2"
 },
 {
  "c": "H52.220",
  "l": 5,
  "sl": "Spremljajoče storitvene dejavnosti v vodnem prevozu",
  "en": "Service activities incidental to water transportation",
  "p": "H52.22"
 },
 {
  "c": "H52.23",
  "l": 4,
  "sl": "Spremljajoče storitvene dejavnosti v zračnem prevozu",
  "en": "Service activities incidental to air transportation",
  "p": "H52.2"
 },
 {
  "c": "H52.230",
  "l": 5,
  "sl": "Spremljajoče storitvene dejavnosti v zračnem prevozu",
  "en": "Service activities incidental to air transportation",
  "p": "H52.23"
 },
 {
  "c": "H52.24",
  "l": 4,
  "sl": "Pretovarjanje",
  "en": "Cargo handling",
  "p": "H52.2"
 },
 {
  "c": "H52.240",
  "l": 5,
  "sl": "Pretovarjanje",
  "en": "Cargo handling",
  "p": "H52.24"
 },
 {
  "c": "H52.25",
  "l": 4,
  "sl": "Logistične storitve",
  "en": "Logistics service activities",
  "p": "H52.2"
 },
 {
  "c": "H52.250",
  "l": 5,
  "sl": "Logistične storitve",
  "en": "Logistics service activities",
  "p": "H52.25"
 },
 {
  "c": "H52.26",
  "l": 4,
  "sl": "Druge spremljajoče prevozne dejavnosti",
  "en": "Other support activities for transportation",
  "p": "H52.2"
 },
 {
  "c": "H52.260",
  "l": 5,
  "sl": "Druge spremljajoče prevozne dejavnosti",
  "en": "Other support activities for transportation",
  "p": "H52.26"
 },
 {
  "c": "H52.3",
  "l": 3,
  "sl": "Posredniške prevozne dejavnosti",
  "en": "Intermediation service activities for transportation",
  "p": "H52"
 },
 {
  "c": "H52.31",
  "l": 4,
  "sl": "Posredniške dejavnosti za tovorni prevoz",
  "en": "Intermediation service activities for freight transportation",
  "p": "H52.3"
 },
 {
  "c": "H52.310",
  "l": 5,
  "sl": "Posredniške dejavnosti za tovorni prevoz",
  "en": "Intermediation service activities for freight transportation",
  "p": "H52.31"
 },
 {
  "c": "H52.32",
  "l": 4,
  "sl": "Posredniške dejavnosti za potniški prevoz",
  "en": "Intermediation service activities for passenger transportation",
  "p": "H52.3"
 },
 {
  "c": "H52.320",
  "l": 5,
  "sl": "Posredniške dejavnosti za potniški prevoz",
  "en": "Intermediation service activities for passenger transportation",
  "p": "H52.32"
 },
 {
  "c": "H53",
  "l": 2,
  "sl": "Poštna in kurirska dejavnost",
  "en": "Postal and courier activities",
  "p": "H"
 },
 {
  "c": "H53.1",
  "l": 3,
  "sl": "Izvajanje univerzalne poštne storitve",
  "en": "Postal activities under universal service obligation",
  "p": "H53"
 },
 {
  "c": "H53.10",
  "l": 4,
  "sl": "Izvajanje univerzalne poštne storitve",
  "en": "Postal activities under universal service obligation",
  "p": "H53.1"
 },
 {
  "c": "H53.100",
  "l": 5,
  "sl": "Izvajanje univerzalne poštne storitve",
  "en": "Postal activities under universal service obligation",
  "p": "H53.10"
 },
 {
  "c": "H53.2",
  "l": 3,
  "sl": "Druga poštna in kurirska dejavnost",
  "en": "Other postal and courier activities",
  "p": "H53"
 },
 {
  "c": "H53.20",
  "l": 4,
  "sl": "Druga poštna in kurirska dejavnost",
  "en": "Other postal and courier activities",
  "p": "H53.2"
 },
 {
  "c": "H53.200",
  "l": 5,
  "sl": "Druga poštna in kurirska dejavnost",
  "en": "Other postal and courier activities",
  "p": "H53.20"
 },
 {
  "c": "H53.3",
  "l": 3,
  "sl": "Posredniške storitve za poštno in kurirsko dejavnost",
  "en": "Intermediation service activities for postal and courier activities",
  "p": "H53"
 },
 {
  "c": "H53.30",
  "l": 4,
  "sl": "Posredniške storitve za poštno in kurirsko dejavnost",
  "en": "Intermediation service activities for postal and courier activities",
  "p": "H53.3"
 },
 {
  "c": "H53.300",
  "l": 5,
  "sl": "Posredniške storitve za poštno in kurirsko dejavnost",
  "en": "Intermediation service activities for postal and courier activities",
  "p": "H53.30"
 },
 {
  "c": "I",
  "l": 1,
  "sl": "NASTANITVENE IN GOSTINSKE DEJAVNOSTI",
  "en": "ACCOMMODATION AND FOOD SERVICE ACTIVITIES",
  "p": null
 },
 {
  "c": "I55",
  "l": 2,
  "sl": "Nastanitvene dejavnosti",
  "en": "Accommodation",
  "p": "I"
 },
 {
  "c": "I55.1",
  "l": 3,
  "sl": "Dejavnost hotelov in podobnih nastanitvenih obratov",
  "en": "Hotels and similar accommodation",
  "p": "I55"
 },
 {
  "c": "I55.10",
  "l": 4,
  "sl": "Dejavnost hotelov in podobnih nastanitvenih obratov",
  "en": "Hotels and similar accommodation",
  "p": "I55.1"
 },
 {
  "c": "I55.100",
  "l": 5,
  "sl": "Dejavnost hotelov in podobnih nastanitvenih obratov",
  "en": "Hotels and similar accommodation",
  "p": "I55.10"
 },
 {
  "c": "I55.2",
  "l": 3,
  "sl": "Dejavnost počitniških domov in podobnih nastanitvenih obratov za kratkotrajno bivanje",
  "en": "Holiday and other short-stay accommodation",
  "p": "I55"
 },
 {
  "c": "I55.20",
  "l": 4,
  "sl": "Dejavnost počitniških domov in podobnih nastanitvenih obratov za kratkotrajno bivanje",
  "en": "Holiday and other short-stay accommodation",
  "p": "I55.2"
 },
 {
  "c": "I55.201",
  "l": 5,
  "sl": "Počitniški domovi in letovišča",
  "en": "Children and other holiday homes",
  "p": "I55.20"
 },
 {
  "c": "I55.202",
  "l": 5,
  "sl": "Turistične kmetije s sobami",
  "en": "Tourist farm houses with lodging",
  "p": "I55.20"
 },
 {
  "c": "I55.203",
  "l": 5,
  "sl": "Oddajanje zasebnih sob gostom",
  "en": "Letting of private tourist rooms",
  "p": "I55.20"
 },
 {
  "c": "I55.204",
  "l": 5,
  "sl": "Planinski domovi in mladinska prenočišča",
  "en": "Mountain refuges and youth hostels",
  "p": "I55.20"
 },
 {
  "c": "I55.209",
  "l": 5,
  "sl": "Druge nastanitve za krajši čas",
  "en": "Other short-stay accommodation",
  "p": "I55.20"
 },
 {
  "c": "I55.3",
  "l": 3,
  "sl": "Dejavnost avtokampov",
  "en": "Camping grounds and recreational vehicle parks",
  "p": "I55"
 },
 {
  "c": "I55.30",
  "l": 4,
  "sl": "Dejavnost avtokampov",
  "en": "Camping grounds and recreational vehicle parks",
  "p": "I55.3"
 },
 {
  "c": "I55.300",
  "l": 5,
  "sl": "Dejavnost avtokampov",
  "en": "Camping grounds and recreational vehicle parks",
  "p": "I55.30"
 },
 {
  "c": "I55.4",
  "l": 3,
  "sl": "Posredniške nastanitvene storitve",
  "en": "Intermediation service activities for accommodation",
  "p": "I55"
 },
 {
  "c": "I55.40",
  "l": 4,
  "sl": "Posredniške nastanitvene storitve",
  "en": "Intermediation service activities for accommodation",
  "p": "I55.4"
 },
 {
  "c": "I55.400",
  "l": 5,
  "sl": "Posredniške nastanitvene storitve",
  "en": "Intermediation service activities for accommodation",
  "p": "I55.40"
 },
 {
  "c": "I55.9",
  "l": 3,
  "sl": "Druge nastanitvene dejavnosti",
  "en": "Other accommodation",
  "p": "I55"
 },
 {
  "c": "I55.90",
  "l": 4,
  "sl": "Druge nastanitvene dejavnosti",
  "en": "Other accommodation",
  "p": "I55.9"
 },
 {
  "c": "I55.900",
  "l": 5,
  "sl": "Druge nastanitvene dejavnosti",
  "en": "Other accommodation",
  "p": "I55.90"
 },
 {
  "c": "I56",
  "l": 2,
  "sl": "Dejavnost strežbe hrane in pijač",
  "en": "Food and beverage service activities",
  "p": "I"
 },
 {
  "c": "I56.1",
  "l": 3,
  "sl": "Dejavnost restavracij in mobilna strežba hrane",
  "en": "Restaurants and mobile food service activities",
  "p": "I56"
 },
 {
  "c": "I56.11",
  "l": 4,
  "sl": "Dejavnost restavracij",
  "en": "Restaurant activities",
  "p": "I56.1"
 },
 {
  "c": "I56.111",
  "l": 5,
  "sl": "Gostilne in restavracije",
  "en": "Inns and restaurants",
  "p": "I56.11"
 },
 {
  "c": "I56.112",
  "l": 5,
  "sl": "Okrepčevalnice in podobni obrati",
  "en": "Snack bars and similar",
  "p": "I56.11"
 },
 {
  "c": "I56.113",
  "l": 5,
  "sl": "Slaščičarne in kavarne",
  "en": "Sweetshops and coffee-houses",
  "p": "I56.11"
 },
 {
  "c": "I56.114",
  "l": 5,
  "sl": "Turistične kmetije brez sob",
  "en": "Tourist farm houses without lodging",
  "p": "I56.11"
 },
 {
  "c": "I56.12",
  "l": 4,
  "sl": "Mobilna strežba hrane",
  "en": "Mobile food service activities",
  "p": "I56.1"
 },
 {
  "c": "I56.120",
  "l": 5,
  "sl": "Mobilna strežba hrane",
  "en": "Mobile food service activities",
  "p": "I56.12"
 },
 {
  "c": "I56.2",
  "l": 3,
  "sl": "Priložnostna in pogodbena priprava in dostava hrane ter druga oskrba s hrano",
  "en": "Event catering, contract catering service activities and other food service activities",
  "p": "I56"
 },
 {
  "c": "I56.21",
  "l": 4,
  "sl": "Priložnostna priprava in dostava hrane",
  "en": "Event catering activities",
  "p": "I56.2"
 },
 {
  "c": "I56.210",
  "l": 5,
  "sl": "Priložnostna priprava in dostava hrane",
  "en": "Event catering activities",
  "p": "I56.21"
 },
 {
  "c": "I56.22",
  "l": 4,
  "sl": "Pogodbena priprava in dostava hrane ter druga oskrba s hrano",
  "en": "Contract catering service activities and other food service activities",
  "p": "I56.2"
 },
 {
  "c": "I56.220",
  "l": 5,
  "sl": "Pogodbena priprava in dostava hrane ter druga oskrba s hrano",
  "en": "Contract catering service activities and other food service activities",
  "p": "I56.22"
 },
 {
  "c": "I56.3",
  "l": 3,
  "sl": "Strežba pijač",
  "en": "Beverage serving activities",
  "p": "I56"
 },
 {
  "c": "I56.30",
  "l": 4,
  "sl": "Strežba pijač",
  "en": "Beverage serving activities",
  "p": "I56.3"
 },
 {
  "c": "I56.300",
  "l": 5,
  "sl": "Strežba pijač",
  "en": "Beverage serving activities",
  "p": "I56.30"
 },
 {
  "c": "I56.4",
  "l": 3,
  "sl": "Posredniške storitve za dejavnosti strežbe hrane in pijač",
  "en": "Intermediation service activities for food and beverage services activities",
  "p": "I56"
 },
 {
  "c": "I56.40",
  "l": 4,
  "sl": "Posredniške storitve za dejavnosti strežbe hrane in pijač",
  "en": "Intermediation service activities for food and beverage services activities",
  "p": "I56.4"
 },
 {
  "c": "I56.400",
  "l": 5,
  "sl": "Posredniške storitve za dejavnosti strežbe hrane in pijač",
  "en": "Intermediation service activities for food and beverage services activities",
  "p": "I56.40"
 },
 {
  "c": "J",
  "l": 1,
  "sl": "ZALOŽNIŠTVO, RADIODIFUZIJA TER PRODUKCIJA IN DISTRIBUCIJA VSEBIN",
  "en": "PUBLISHING, BROADCASTING, AND CONTENT PRODUCTION AND DISTRIBUTION ACTIVITIES",
  "p": null
 },
 {
  "c": "J58",
  "l": 2,
  "sl": "Založništvo",
  "en": "Publishing activities",
  "p": "J"
 },
 {
  "c": "J58.1",
  "l": 3,
  "sl": "Izdajanje knjig, časopisov in drugo založništvo, razen izdajanja programske opreme",
  "en": "Publishing of books, newspapers and other publishing activities, except software publishing",
  "p": "J58"
 },
 {
  "c": "J58.11",
  "l": 4,
  "sl": "Izdajanje knjig",
  "en": "Publishing of books",
  "p": "J58.1"
 },
 {
  "c": "J58.110",
  "l": 5,
  "sl": "Izdajanje knjig",
  "en": "Publishing of books",
  "p": "J58.11"
 },
 {
  "c": "J58.12",
  "l": 4,
  "sl": "Izdajanje časopisov",
  "en": "Publishing of newspapers",
  "p": "J58.1"
 },
 {
  "c": "J58.120",
  "l": 5,
  "sl": "Izdajanje časopisov",
  "en": "Publishing of newspapers",
  "p": "J58.12"
 },
 {
  "c": "J58.13",
  "l": 4,
  "sl": "Izdajanje revij in druge periodike",
  "en": "Publishing of journals and periodicals",
  "p": "J58.1"
 },
 {
  "c": "J58.130",
  "l": 5,
  "sl": "Izdajanje revij in druge periodike",
  "en": "Publishing of journals and periodicals",
  "p": "J58.13"
 },
 {
  "c": "J58.19",
  "l": 4,
  "sl": "Drugo založništvo, razen izdajanja programske opreme",
  "en": "Other publishing activities, except software publishing",
  "p": "J58.1"
 },
 {
  "c": "J58.190",
  "l": 5,
  "sl": "Drugo založništvo, razen izdajanja programske opreme",
  "en": "Other publishing activities, except software publishing",
  "p": "J58.19"
 },
 {
  "c": "J58.2",
  "l": 3,
  "sl": "Izdajanje programske opreme",
  "en": "Software publishing",
  "p": "J58"
 },
 {
  "c": "J58.21",
  "l": 4,
  "sl": "Izdajanje videoiger",
  "en": "Publishing of video games",
  "p": "J58.2"
 },
 {
  "c": "J58.210",
  "l": 5,
  "sl": "Izdajanje videoiger",
  "en": "Publishing of video games",
  "p": "J58.21"
 },
 {
  "c": "J58.29",
  "l": 4,
  "sl": "Drugo izdajanje programske opreme",
  "en": "Other software publishing",
  "p": "J58.2"
 },
 {
  "c": "J58.290",
  "l": 5,
  "sl": "Drugo izdajanje programske opreme",
  "en": "Other software publishing",
  "p": "J58.29"
 },
 {
  "c": "J59",
  "l": 2,
  "sl": "Dejavnosti produkcije filmov, videofilmov in televizijskih oddaj ter snemanja in izdajanja zvočnih zapisov in muzikalij",
  "en": "Motion picture, video and television programme production, sound recording and music publishing activities",
  "p": "J"
 },
 {
  "c": "J59.1",
  "l": 3,
  "sl": "Filmska in video dejavnost",
  "en": "Motion picture, video and television programme activities",
  "p": "J59"
 },
 {
  "c": "J59.11",
  "l": 4,
  "sl": "Produkcija filmov, videofilmov, televizijskih oddaj",
  "en": "Motion picture, video and television programme production activities",
  "p": "J59.1"
 },
 {
  "c": "J59.110",
  "l": 5,
  "sl": "Produkcija filmov, videofilmov, televizijskih oddaj",
  "en": "Motion picture, video and television programme production activities",
  "p": "J59.11"
 },
 {
  "c": "J59.12",
  "l": 4,
  "sl": "Postprodukcijske dejavnosti pri izdelavi filmov, videofilmov, televizijskih oddaj",
  "en": "Motion picture, video and television programme post-production activities",
  "p": "J59.1"
 },
 {
  "c": "J59.120",
  "l": 5,
  "sl": "Postprodukcijske dejavnosti pri izdelavi filmov, videofilmov, televizijskih oddaj",
  "en": "Motion picture, video and television programme post-production activities",
  "p": "J59.12"
 },
 {
  "c": "J59.13",
  "l": 4,
  "sl": "Distribucija filmov in videofilmov",
  "en": "Motion picture and video distribution activities",
  "p": "J59.1"
 },
 {
  "c": "J59.130",
  "l": 5,
  "sl": "Distribucija filmov in videofilmov",
  "en": "Motion picture and video distribution activities",
  "p": "J59.13"
 },
 {
  "c": "J59.14",
  "l": 4,
  "sl": "Kinematografska dejavnost",
  "en": "Motion picture projection activities",
  "p": "J59.1"
 },
 {
  "c": "J59.140",
  "l": 5,
  "sl": "Kinematografska dejavnost",
  "en": "Motion picture projection activities",
  "p": "J59.14"
 },
 {
  "c": "J59.2",
  "l": 3,
  "sl": "Snemanje in izdajanje zvočnih zapisov in muzikalij",
  "en": "Sound recording and music publishing activities",
  "p": "J59"
 },
 {
  "c": "J59.20",
  "l": 4,
  "sl": "Snemanje in izdajanje zvočnih zapisov in muzikalij",
  "en": "Sound recording and music publishing activities",
  "p": "J59.2"
 },
 {
  "c": "J59.200",
  "l": 5,
  "sl": "Snemanje in izdajanje zvočnih zapisov in muzikalij",
  "en": "Sound recording and music publishing activities",
  "p": "J59.20"
 },
 {
  "c": "J60",
  "l": 2,
  "sl": "Radijska in televizijska dejavnost, dejavnost tiskovnih agencij in druge dejavnosti distribucije vsebin",
  "en": "Programming, broadcasting, news agency and other content distribution activities",
  "p": "J"
 },
 {
  "c": "J60.1",
  "l": 3,
  "sl": "Radijska dejavnost in distribucija zvoka",
  "en": "Radio broadcasting and audio distribution activities",
  "p": "J60"
 },
 {
  "c": "J60.10",
  "l": 4,
  "sl": "Radijska dejavnost in distribucija zvoka",
  "en": "Radio broadcasting and audio distribution activities",
  "p": "J60.1"
 },
 {
  "c": "J60.100",
  "l": 5,
  "sl": "Radijska dejavnost in distribucija zvoka",
  "en": "Radio broadcasting and audio distribution activities",
  "p": "J60.10"
 },
 {
  "c": "J60.2",
  "l": 3,
  "sl": "Televizijska dejavnost in distribucija videoposnetkov",
  "en": "Television programming, broadcasting and video distribution activities",
  "p": "J60"
 },
 {
  "c": "J60.20",
  "l": 4,
  "sl": "Televizijska dejavnost in distribucija videoposnetkov",
  "en": "Television programming, broadcasting and video distribution activities",
  "p": "J60.2"
 },
 {
  "c": "J60.200",
  "l": 5,
  "sl": "Televizijska dejavnost in distribucija videoposnetkov",
  "en": "Television programming, broadcasting and video distribution activities",
  "p": "J60.20"
 },
 {
  "c": "J60.3",
  "l": 3,
  "sl": "Dejavnost tiskovnih agencij in druge dejavnosti distribucije vsebin",
  "en": "News agency and other content distribution activities",
  "p": "J60"
 },
 {
  "c": "J60.31",
  "l": 4,
  "sl": "Dejavnost tiskovnih agencij",
  "en": "News agency activities",
  "p": "J60.3"
 },
 {
  "c": "J60.310",
  "l": 5,
  "sl": "Dejavnost tiskovnih agencij",
  "en": "News agency activities",
  "p": "J60.31"
 },
 {
  "c": "J60.39",
  "l": 4,
  "sl": "Druge dejavnosti distribucije vsebin",
  "en": "Other content distribution activities",
  "p": "J60.3"
 },
 {
  "c": "J60.390",
  "l": 5,
  "sl": "Druge dejavnosti distribucije vsebin",
  "en": "Other content distribution activities",
  "p": "J60.39"
 },
 {
  "c": "K",
  "l": 1,
  "sl": "DEJAVNOSTI V ZVEZI S TELEKOMUNIKACIJAMI, RAČUNALNIŠKIM PROGRAMIRANJEM, SVETOVANJEM, RAČUNALNIŠKO INFRASTRUKTURO IN DRUGIMI INFORMACIJSKIMI STORITVAMI",
  "en": "TELECOMMUNICATION, COMPUTER PROGRAMMING, CONSULTING, COMPUTING INFRASTRUCTURE AND OTHER INFORMATION SERVICE ACTIVITIES",
  "p": null
 },
 {
  "c": "K61",
  "l": 2,
  "sl": "Telekomunikacijske dejavnosti",
  "en": "Telecommunication",
  "p": "K"
 },
 {
  "c": "K61.1",
  "l": 3,
  "sl": "Telekomunikacijske dejavnosti po vodih, brezžične in satelitske telekomunikacijske dejavnosti",
  "en": "Wired, wireless, and satellite telecommunication activities",
  "p": "K61"
 },
 {
  "c": "K61.10",
  "l": 4,
  "sl": "Telekomunikacijske dejavnosti po vodih, brezžične in satelitske telekomunikacijske dejavnosti",
  "en": "Wired, wireless, and satellite telecommunication activities",
  "p": "K61.1"
 },
 {
  "c": "K61.100",
  "l": 5,
  "sl": "Telekomunikacijske dejavnosti po vodih, brezžične in satelitske telekomunikacijske dejavnosti",
  "en": "Wired, wireless, and satellite telecommunication activities",
  "p": "K61.10"
 },
 {
  "c": "K61.2",
  "l": 3,
  "sl": "Preprodaja telekomunikacijskih storitev in posredniške storitve v zvezi s telekomunikacijami",
  "en": "Telecommunication reselling activities and intermediation service activities for telecommunication",
  "p": "K61"
 },
 {
  "c": "K61.20",
  "l": 4,
  "sl": "Preprodaja telekomunikacijskih storitev in posredniške storitve v zvezi s telekomunikacijami",
  "en": "Telecommunication reselling activities and intermediation service activities for telecommunication",
  "p": "K61.2"
 },
 {
  "c": "K61.200",
  "l": 5,
  "sl": "Preprodaja telekomunikacijskih storitev in posredniške storitve v zvezi s telekomunikacijami",
  "en": "Telecommunication reselling activities and intermediation service activities for telecommunication",
  "p": "K61.20"
 },
 {
  "c": "K61.9",
  "l": 3,
  "sl": "Druge telekomunikacijske dejavnosti",
  "en": "Other telecommunication activities",
  "p": "K61"
 },
 {
  "c": "K61.90",
  "l": 4,
  "sl": "Druge telekomunikacijske dejavnosti",
  "en": "Other telecommunication activities",
  "p": "K61.9"
 },
 {
  "c": "K61.900",
  "l": 5,
  "sl": "Druge telekomunikacijske dejavnosti",
  "en": "Other telecommunication activities",
  "p": "K61.90"
 },
 {
  "c": "K62",
  "l": 2,
  "sl": "Računalniško programiranje, svetovanje in druge s tem povezane dejavnosti",
  "en": "Computer programming, consultancy and related activities",
  "p": "K"
 },
 {
  "c": "K62.1",
  "l": 3,
  "sl": "Računalniško programiranje",
  "en": "Computer programming activities",
  "p": "K62"
 },
 {
  "c": "K62.10",
  "l": 4,
  "sl": "Računalniško programiranje",
  "en": "Computer programming activities",
  "p": "K62.1"
 },
 {
  "c": "K62.100",
  "l": 5,
  "sl": "Računalniško programiranje",
  "en": "Computer programming activities",
  "p": "K62.10"
 },
 {
  "c": "K62.2",
  "l": 3,
  "sl": "Svetovanje o računalniških napravah in programih ter upravljanje računalniških naprav in sistemov",
  "en": "Computer consultancy and computer facilities management activities",
  "p": "K62"
 },
 {
  "c": "K62.20",
  "l": 4,
  "sl": "Svetovanje o računalniških napravah in programih ter upravljanje računalniških naprav in sistemov",
  "en": "Computer consultancy and computer facilities management activities",
  "p": "K62.2"
 },
 {
  "c": "K62.200",
  "l": 5,
  "sl": "Svetovanje o računalniških napravah in programih ter upravljanje računalniških naprav in sistemov",
  "en": "Computer consultancy and computer facilities management activities",
  "p": "K62.20"
 },
 {
  "c": "K62.9",
  "l": 3,
  "sl": "Druge z informacijsko tehnologijo in računalniškimi storitvami povezane dejavnosti",
  "en": "Other information technology and computer service activities",
  "p": "K62"
 },
 {
  "c": "K62.90",
  "l": 4,
  "sl": "Druge z informacijsko tehnologijo in računalniškimi storitvami povezane dejavnosti",
  "en": "Other information technology and computer service activities",
  "p": "K62.9"
 },
 {
  "c": "K62.900",
  "l": 5,
  "sl": "Druge z informacijsko tehnologijo in računalniškimi storitvami povezane dejavnosti",
  "en": "Other information technology and computer service activities",
  "p": "K62.90"
 },
 {
  "c": "K63",
  "l": 2,
  "sl": "Dejavnosti v zvezi z računalniško infrastrukturo, obdelavo podatkov in gostovanjem ter druge informacijske dejavnosti",
  "en": "Computing infrastructure, data processing, hosting and other information service activities",
  "p": "K"
 },
 {
  "c": "K63.1",
  "l": 3,
  "sl": "Dejavnosti v zvezi z računalniško infrastrukturo, obdelavo podatkov in gostovanjem ter povezane dejavnosti",
  "en": "Computing infrastructure, data processing, hosting and related activities",
  "p": "K63"
 },
 {
  "c": "K63.10",
  "l": 4,
  "sl": "Dejavnosti v zvezi z računalniško infrastrukturo, obdelavo podatkov in gostovanjem ter povezane dejavnosti",
  "en": "Computing infrastructure, data processing, hosting and related activities",
  "p": "K63.1"
 },
 {
  "c": "K63.100",
  "l": 5,
  "sl": "Dejavnosti v zvezi z računalniško infrastrukturo, obdelavo podatkov in gostovanjem ter povezane dejavnosti",
  "en": "Computing infrastructure, data processing, hosting and related activities",
  "p": "K63.10"
 },
 {
  "c": "K63.9",
  "l": 3,
  "sl": "Dejavnosti spletnih iskalnikov in druge informacijske dejavnosti",
  "en": "Web search portal activities and other information service activities",
  "p": "K63"
 },
 {
  "c": "K63.91",
  "l": 4,
  "sl": "Dejavnosti spletnih iskalnikov",
  "en": "Web search portal activities",
  "p": "K63.9"
 },
 {
  "c": "K63.910",
  "l": 5,
  "sl": "Dejavnosti spletnih iskalnikov",
  "en": "Web search portal activities",
  "p": "K63.91"
 },
 {
  "c": "K63.92",
  "l": 4,
  "sl": "Druge informacijske dejavnosti",
  "en": "Other information service activities",
  "p": "K63.9"
 },
 {
  "c": "K63.920",
  "l": 5,
  "sl": "Druge informacijske dejavnosti",
  "en": "Other information service activities",
  "p": "K63.92"
 },
 {
  "c": "L",
  "l": 1,
  "sl": "FINANČNE IN ZAVAROVALNIŠKE DEJAVNOSTI",
  "en": "FINANCIAL AND INSURANCE ACTIVITIES",
  "p": null
 },
 {
  "c": "L64",
  "l": 2,
  "sl": "Dejavnosti finančnih storitev, razen zavarovalništva in dejavnosti pokojninskih skladov",
  "en": "Financial service activities, except insurance and pension funding",
  "p": "L"
 },
 {
  "c": "L64.1",
  "l": 3,
  "sl": "Denarno posredništvo",
  "en": "Monetary intermediation",
  "p": "L64"
 },
 {
  "c": "L64.11",
  "l": 4,
  "sl": "Centralno bančništvo",
  "en": "Central banking",
  "p": "L64.1"
 },
 {
  "c": "L64.110",
  "l": 5,
  "sl": "Centralno bančništvo",
  "en": "Central banking",
  "p": "L64.11"
 },
 {
  "c": "L64.19",
  "l": 4,
  "sl": "Drugo denarno posredništvo",
  "en": "Other monetary intermediation",
  "p": "L64.1"
 },
 {
  "c": "L64.190",
  "l": 5,
  "sl": "Drugo denarno posredništvo",
  "en": "Other monetary intermediation",
  "p": "L64.19"
 },
 {
  "c": "L64.2",
  "l": 3,
  "sl": "Dejavnost holdingov in prehodnih struktur financiranja",
  "en": "Activities of holding companies and financing conduits",
  "p": "L64"
 },
 {
  "c": "L64.21",
  "l": 4,
  "sl": "Dejavnost holdingov",
  "en": "Activities of holding companies",
  "p": "L64.2"
 },
 {
  "c": "L64.210",
  "l": 5,
  "sl": "Dejavnost holdingov",
  "en": "Activities of holding companies",
  "p": "L64.21"
 },
 {
  "c": "L64.22",
  "l": 4,
  "sl": "Dejavnost prehodnih struktur financiranja",
  "en": "Activities of financing conduits",
  "p": "L64.2"
 },
 {
  "c": "L64.220",
  "l": 5,
  "sl": "Dejavnost prehodnih struktur financiranja",
  "en": "Activities of financing conduits",
  "p": "L64.22"
 },
 {
  "c": "L64.3",
  "l": 3,
  "sl": "Dejavnost skrbniških in drugih skladov ter podobnih finančnih subjektov",
  "en": "Activities of trusts, funds and similar financial entities",
  "p": "L64"
 },
 {
  "c": "L64.31",
  "l": 4,
  "sl": "Dejavnost investicijskih skladov denarnih in nedenarnih trgov",
  "en": "Activities of money market and non-money market investments funds",
  "p": "L64.3"
 },
 {
  "c": "L64.310",
  "l": 5,
  "sl": "Dejavnost investicijskih skladov denarnih in nedenarnih trgov",
  "en": "Activities of money market and non-money market investments funds",
  "p": "L64.31"
 },
 {
  "c": "L64.32",
  "l": 4,
  "sl": "Dejavnosti računov skladov, nepremičninskih in agencijskih računov",
  "en": "Activities of trust, estate and agency accounts",
  "p": "L64.3"
 },
 {
  "c": "L64.320",
  "l": 5,
  "sl": "Dejavnosti računov skladov, nepremičninskih in agencijskih računov",
  "en": "Activities of trust, estate and agency accounts",
  "p": "L64.32"
 },
 {
  "c": "L64.9",
  "l": 3,
  "sl": "Dejavnosti finančnih storitev, razen zavarovalništva in dejavnosti pokojninskih skladov",
  "en": "Other financial service activities, except insurance and pension funding",
  "p": "L64"
 },
 {
  "c": "L64.91",
  "l": 4,
  "sl": "Dejavnost finančnega zakupa",
  "en": "Financial leasing",
  "p": "L64.9"
 },
 {
  "c": "L64.910",
  "l": 5,
  "sl": "Dejavnost finančnega zakupa",
  "en": "Financial leasing",
  "p": "L64.91"
 },
 {
  "c": "L64.92",
  "l": 4,
  "sl": "Drugo kreditiranje",
  "en": "Other credit granting",
  "p": "L64.9"
 },
 {
  "c": "L64.920",
  "l": 5,
  "sl": "Drugo kreditiranje",
  "en": "Other credit granting",
  "p": "L64.92"
 },
 {
  "c": "L64.99",
  "l": 4,
  "sl": "Druge dejavnosti finančnih storitev, razen zavarovalništva in dejavnosti pokojninskih skladov, d. n.",
  "en": "Other financial service activities, except insurance and pension funding n.e.c.",
  "p": "L64.9"
 },
 {
  "c": "L64.990",
  "l": 5,
  "sl": "Druge dejavnosti finančnih storitev, razen zavarovalništva in dejavnosti pokojninskih skladov, d. n.",
  "en": "Other financial service activities, except insurance and pension funding n.e.c.",
  "p": "L64.99"
 },
 {
  "c": "L65",
  "l": 2,
  "sl": "Dejavnost zavarovanja, pozavarovanja in pokojninskih skladov, razen obvezne socialne varnosti",
  "en": "Insurance, reinsurance and pension funding, except compulsory social security",
  "p": "L"
 },
 {
  "c": "L65.1",
  "l": 3,
  "sl": "Dejavnost zavarovanja",
  "en": "Insurance",
  "p": "L65"
 },
 {
  "c": "L65.11",
  "l": 4,
  "sl": "Dejavnost življenjskega zavarovanja",
  "en": "Life insurance",
  "p": "L65.1"
 },
 {
  "c": "L65.110",
  "l": 5,
  "sl": "Dejavnost življenjskega zavarovanja",
  "en": "Life insurance",
  "p": "L65.11"
 },
 {
  "c": "L65.12",
  "l": 4,
  "sl": "Dejavnosti zavarovanja, razen življenjskega",
  "en": "Non-life insurance",
  "p": "L65.1"
 },
 {
  "c": "L65.120",
  "l": 5,
  "sl": "Dejavnosti zavarovanja, razen življenjskega",
  "en": "Non-life insurance",
  "p": "L65.12"
 },
 {
  "c": "L65.2",
  "l": 3,
  "sl": "Dejavnost pozavarovanja",
  "en": "Reinsurance",
  "p": "L65"
 },
 {
  "c": "L65.20",
  "l": 4,
  "sl": "Dejavnost pozavarovanja",
  "en": "Reinsurance",
  "p": "L65.2"
 },
 {
  "c": "L65.200",
  "l": 5,
  "sl": "Dejavnost pozavarovanja",
  "en": "Reinsurance",
  "p": "L65.20"
 },
 {
  "c": "L65.3",
  "l": 3,
  "sl": "Dejavnost pokojninskih skladov",
  "en": "Pension funding",
  "p": "L65"
 },
 {
  "c": "L65.30",
  "l": 4,
  "sl": "Dejavnost pokojninskih skladov",
  "en": "Pension funding",
  "p": "L65.3"
 },
 {
  "c": "L65.300",
  "l": 5,
  "sl": "Dejavnost pokojninskih skladov",
  "en": "Pension funding",
  "p": "L65.30"
 },
 {
  "c": "L66",
  "l": 2,
  "sl": "Pomožne dejavnosti za finančne in zavarovalniške storitve",
  "en": "Activities auxiliary to financial services and insurance activities",
  "p": "L"
 },
 {
  "c": "L66.1",
  "l": 3,
  "sl": "Pomožne dejavnosti za finančne storitve, razen za zavarovalništvo in pokojninske sklade",
  "en": "Activities auxiliary to financial services, except insurance and pension funding",
  "p": "L66"
 },
 {
  "c": "L66.11",
  "l": 4,
  "sl": "Upravljanje finančnih trgov",
  "en": "Administration of financial markets",
  "p": "L66.1"
 },
 {
  "c": "L66.110",
  "l": 5,
  "sl": "Upravljanje finančnih trgov",
  "en": "Administration of financial markets",
  "p": "L66.11"
 },
 {
  "c": "L66.12",
  "l": 4,
  "sl": "Posredništvo pri trgovanju z vrednostnimi papirji in borznim blagom",
  "en": "Security and commodity contracts brokerage",
  "p": "L66.1"
 },
 {
  "c": "L66.120",
  "l": 5,
  "sl": "Posredništvo pri trgovanju z vrednostnimi papirji in borznim blagom",
  "en": "Security and commodity contracts brokerage",
  "p": "L66.12"
 },
 {
  "c": "L66.19",
  "l": 4,
  "sl": "Druge pomožne dejavnosti za finančne storitve, razen za zavarovalništvo in pokojninske sklade",
  "en": "Other activities auxiliary to financial services, except insurance and pension funding",
  "p": "L66.1"
 },
 {
  "c": "L66.190",
  "l": 5,
  "sl": "Druge pomožne dejavnosti za finančne storitve, razen za zavarovalništvo in pokojninske sklade",
  "en": "Other activities auxiliary to financial services, except insurance and pension funding",
  "p": "L66.19"
 },
 {
  "c": "L66.2",
  "l": 3,
  "sl": "Pomožne dejavnosti za zavarovalništvo in pokojninske sklade",
  "en": "Activities auxiliary to insurance and pension funding",
  "p": "L66"
 },
 {
  "c": "L66.21",
  "l": 4,
  "sl": "Vrednotenje tveganja in škode",
  "en": "Risk and damage evaluation",
  "p": "L66.2"
 },
 {
  "c": "L66.210",
  "l": 5,
  "sl": "Vrednotenje tveganja in škode",
  "en": "Risk and damage evaluation",
  "p": "L66.21"
 },
 {
  "c": "L66.22",
  "l": 4,
  "sl": "Dejavnost zavarovalniških agentov",
  "en": "Activities of insurance agents and brokers",
  "p": "L66.2"
 },
 {
  "c": "L66.220",
  "l": 5,
  "sl": "Dejavnost zavarovalniških agentov",
  "en": "Activities of insurance agents and brokers",
  "p": "L66.22"
 },
 {
  "c": "L66.29",
  "l": 4,
  "sl": "Pomožne dejavnosti za zavarovalništvo in pokojninske sklade, d. n.",
  "en": "Activities auxiliary to insurance and pension funding n.e.c.",
  "p": "L66.2"
 },
 {
  "c": "L66.290",
  "l": 5,
  "sl": "Pomožne dejavnosti za zavarovalništvo in pokojninske sklade, d. n.",
  "en": "Activities auxiliary to insurance and pension funding n.e.c.",
  "p": "L66.29"
 },
 {
  "c": "L66.3",
  "l": 3,
  "sl": "Upravljanje finančnih skladov",
  "en": "Fund management activities",
  "p": "L66"
 },
 {
  "c": "L66.30",
  "l": 4,
  "sl": "Upravljanje finančnih skladov",
  "en": "Fund management activities",
  "p": "L66.3"
 },
 {
  "c": "L66.300",
  "l": 5,
  "sl": "Upravljanje finančnih skladov",
  "en": "Fund management activities",
  "p": "L66.30"
 },
 {
  "c": "M",
  "l": 1,
  "sl": "POSLOVANJE Z NEPREMIČNINAMI",
  "en": "REAL ESTATE ACTIVITIES",
  "p": null
 },
 {
  "c": "M68",
  "l": 2,
  "sl": "Poslovanje z nepremičninami",
  "en": "Real estate activities",
  "p": "M"
 },
 {
  "c": "M68.1",
  "l": 3,
  "sl": "Poslovanje z lastnimi nepremičninami in organizacija izvedbe gradbenih projektov",
  "en": "Real estate activities with own property and development of building projects",
  "p": "M68"
 },
 {
  "c": "M68.11",
  "l": 4,
  "sl": "Trgovanje z lastnimi nepremičninami",
  "en": "Buying and selling of own real estate",
  "p": "M68.1"
 },
 {
  "c": "M68.110",
  "l": 5,
  "sl": "Trgovanje z lastnimi nepremičninami",
  "en": "Buying and selling of own real estate",
  "p": "M68.11"
 },
 {
  "c": "M68.12",
  "l": 4,
  "sl": "Organizacija izvedbe gradbenih projektov",
  "en": "Development of building projects",
  "p": "M68.1"
 },
 {
  "c": "M68.120",
  "l": 5,
  "sl": "Organizacija izvedbe gradbenih projektov",
  "en": "Development of building projects",
  "p": "M68.12"
 },
 {
  "c": "M68.2",
  "l": 3,
  "sl": "Oddajanje in obratovanje lastnih ali najetih nepremičnin",
  "en": "Rental and operating of own or leased real estate",
  "p": "M68"
 },
 {
  "c": "M68.20",
  "l": 4,
  "sl": "Oddajanje in obratovanje lastnih ali najetih nepremičnin",
  "en": "Rental and operating of own or leased real estate",
  "p": "M68.2"
 },
 {
  "c": "M68.200",
  "l": 5,
  "sl": "Oddajanje in obratovanje lastnih ali najetih nepremičnin",
  "en": "Rental and operating of own or leased real estate",
  "p": "M68.20"
 },
 {
  "c": "M68.3",
  "l": 3,
  "sl": "Poslovanje z nepremičninami za plačilo ali po pogodbi",
  "en": "Real estate activities on a fee or contract basis",
  "p": "M68"
 },
 {
  "c": "M68.31",
  "l": 4,
  "sl": "Posredniške storitve za poslovanje z nepremičninami",
  "en": "Intermediation service activities for real estate activities",
  "p": "M68.3"
 },
 {
  "c": "M68.310",
  "l": 5,
  "sl": "Posredniške storitve za poslovanje z nepremičninami",
  "en": "Intermediation service activities for real estate activities",
  "p": "M68.31"
 },
 {
  "c": "M68.32",
  "l": 4,
  "sl": "Drugo poslovanje z nepremičninami za plačilo ali po pogodbi",
  "en": "Other real estate activities on a fee or contract basis",
  "p": "M68.3"
 },
 {
  "c": "M68.320",
  "l": 5,
  "sl": "Drugo poslovanje z nepremičninami za plačilo ali po pogodbi",
  "en": "Other real estate activities on a fee or contract basis",
  "p": "M68.32"
 },
 {
  "c": "N",
  "l": 1,
  "sl": "STROKOVNE, ZNANSTVENE IN TEHNIČNE DEJAVNOSTI",
  "en": "PROFESSIONAL, SCIENTIFIC AND TECHNICAL ACTIVITIES",
  "p": null
 },
 {
  "c": "N69",
  "l": 2,
  "sl": "Pravne in računovodske dejavnosti",
  "en": "Legal and accounting activities",
  "p": "N"
 },
 {
  "c": "N69.1",
  "l": 3,
  "sl": "Pravne dejavnosti",
  "en": "Legal activities",
  "p": "N69"
 },
 {
  "c": "N69.10",
  "l": 4,
  "sl": "Pravne dejavnosti",
  "en": "Legal activities",
  "p": "N69.1"
 },
 {
  "c": "N69.101",
  "l": 5,
  "sl": "Odvetništvo",
  "en": "Attorneyship",
  "p": "N69.10"
 },
 {
  "c": "N69.102",
  "l": 5,
  "sl": "Notariat",
  "en": "Notary",
  "p": "N69.10"
 },
 {
  "c": "N69.103",
  "l": 5,
  "sl": "Izvršitelji, arbitri in sodni izvedenci",
  "en": "Court bailiffs, arbiters and court experts",
  "p": "N69.10"
 },
 {
  "c": "N69.109",
  "l": 5,
  "sl": "Druge pravne dejavnosti",
  "en": "Other legal activities",
  "p": "N69.10"
 },
 {
  "c": "N69.2",
  "l": 3,
  "sl": "Računovodske, knjigovodske in revizijske dejavnosti, davčno svetovanje",
  "en": "Accounting, bookkeeping and auditing activities, tax consultancy",
  "p": "N69"
 },
 {
  "c": "N69.20",
  "l": 4,
  "sl": "Računovodske, knjigovodske in revizijske dejavnosti, davčno svetovanje",
  "en": "Accounting, bookkeeping and auditing activities, tax consultancy",
  "p": "N69.2"
 },
 {
  "c": "N69.200",
  "l": 5,
  "sl": "Računovodske, knjigovodske in revizijske dejavnosti, davčno svetovanje",
  "en": "Accounting, bookkeeping and auditing activities, tax consultancy",
  "p": "N69.20"
 },
 {
  "c": "N70",
  "l": 2,
  "sl": "Dejavnost uprav podjetij, podjetniško in poslovno svetovanje",
  "en": "Activities of head offices and management consultancy",
  "p": "N"
 },
 {
  "c": "N70.1",
  "l": 3,
  "sl": "Dejavnost uprav podjetij",
  "en": "Activities of head offices",
  "p": "N70"
 },
 {
  "c": "N70.10",
  "l": 4,
  "sl": "Dejavnost uprav podjetij",
  "en": "Activities of head offices",
  "p": "N70.1"
 },
 {
  "c": "N70.100",
  "l": 5,
  "sl": "Dejavnost uprav podjetij",
  "en": "Activities of head offices",
  "p": "N70.10"
 },
 {
  "c": "N70.2",
  "l": 3,
  "sl": "Drugo podjetniško in poslovno svetovanje",
  "en": "Business and other management consultancy activities",
  "p": "N70"
 },
 {
  "c": "N70.20",
  "l": 4,
  "sl": "Drugo podjetniško in poslovno svetovanje",
  "en": "Business and other management consultancy activities",
  "p": "N70.2"
 },
 {
  "c": "N70.200",
  "l": 5,
  "sl": "Drugo podjetniško in poslovno svetovanje",
  "en": "Business and other management consultancy activities",
  "p": "N70.20"
 },
 {
  "c": "N71",
  "l": 2,
  "sl": "Arhitekturna in inženirska dejavnost, tehnično preizkušanje in analiziranje",
  "en": "Architectural and engineering activities, technical testing and analysis",
  "p": "N"
 },
 {
  "c": "N71.1",
  "l": 3,
  "sl": "Arhitekturna in inženirska dejavnost in s tem povezano svetovanje",
  "en": "Architectural and engineering activities and related technical consultancy",
  "p": "N71"
 },
 {
  "c": "N71.11",
  "l": 4,
  "sl": "Arhitekturna dejavnost",
  "en": "Architectural activities",
  "p": "N71.1"
 },
 {
  "c": "N71.111",
  "l": 5,
  "sl": "Arhitekturno projektiranje",
  "en": "Architectural planning",
  "p": "N71.11"
 },
 {
  "c": "N71.112",
  "l": 5,
  "sl": "Krajinsko arhitekturno, urbanistično in drugo projektiranje",
  "en": "Landscape architecture, urban and other planning",
  "p": "N71.11"
 },
 {
  "c": "N71.12",
  "l": 4,
  "sl": "Inženirska dejavnost in s tem povezano svetovanje",
  "en": "Engineering activities and related technical consultancy",
  "p": "N71.1"
 },
 {
  "c": "N71.121",
  "l": 5,
  "sl": "Geofizikalne meritve, geodetska dejavnost",
  "en": "Geophysical surveying, geodetic surveying activities",
  "p": "N71.12"
 },
 {
  "c": "N71.129",
  "l": 5,
  "sl": "Druge inženirske dejavnosti in tehnično svetovanje",
  "en": "Other engineering activities and related technical consultancy",
  "p": "N71.12"
 },
 {
  "c": "N71.2",
  "l": 3,
  "sl": "Tehnično preizkušanje in analiziranje",
  "en": "Technical testing and analysis",
  "p": "N71"
 },
 {
  "c": "N71.20",
  "l": 4,
  "sl": "Tehnično preizkušanje in analiziranje",
  "en": "Technical testing and analysis",
  "p": "N71.2"
 },
 {
  "c": "N71.200",
  "l": 5,
  "sl": "Tehnično preizkušanje in analiziranje",
  "en": "Technical testing and analysis",
  "p": "N71.20"
 },
 {
  "c": "N72",
  "l": 2,
  "sl": "Znanstvena raziskovalna in razvojna dejavnost",
  "en": "Scientific research and development",
  "p": "N"
 },
 {
  "c": "N72.1",
  "l": 3,
  "sl": "Raziskovalna in razvojna dejavnost na področju naravoslovja in tehnologije",
  "en": "Research and experimental development on natural sciences and engineering",
  "p": "N72"
 },
 {
  "c": "N72.10",
  "l": 4,
  "sl": "Raziskovalna in razvojna dejavnost na področju naravoslovja in tehnologije",
  "en": "Research and experimental development on natural sciences and engineering",
  "p": "N72.1"
 },
 {
  "c": "N72.100",
  "l": 5,
  "sl": "Raziskovalna in razvojna dejavnost na področju naravoslovja in tehnologije",
  "en": "Research and experimental development on natural sciences and engineering",
  "p": "N72.10"
 },
 {
  "c": "N72.2",
  "l": 3,
  "sl": "Raziskovalna in razvojna dejavnost na področju družboslovja in humanistike",
  "en": "Research and experimental development on social sciences and humanities",
  "p": "N72"
 },
 {
  "c": "N72.20",
  "l": 4,
  "sl": "Raziskovalna in razvojna dejavnost na področju družboslovja in humanistike",
  "en": "Research and experimental development on social sciences and humanities",
  "p": "N72.2"
 },
 {
  "c": "N72.200",
  "l": 5,
  "sl": "Raziskovalna in razvojna dejavnost na področju družboslovja in humanistike",
  "en": "Research and experimental development on social sciences and humanities",
  "p": "N72.20"
 },
 {
  "c": "N73",
  "l": 2,
  "sl": "Oglaševanje, raziskovanje trga, stiki z javnostjo",
  "en": "Activities of advertising, market research and public relations",
  "p": "N"
 },
 {
  "c": "N73.1",
  "l": 3,
  "sl": "Oglaševanje",
  "en": "Advertising",
  "p": "N73"
 },
 {
  "c": "N73.11",
  "l": 4,
  "sl": "Dejavnost oglaševalskih agencij",
  "en": "Activities of advertising agencies",
  "p": "N73.1"
 },
 {
  "c": "N73.110",
  "l": 5,
  "sl": "Dejavnost oglaševalskih agencij",
  "en": "Activities of advertising agencies",
  "p": "N73.11"
 },
 {
  "c": "N73.12",
  "l": 4,
  "sl": "Posredovanje oglaševalskega prostora",
  "en": "Media representation",
  "p": "N73.1"
 },
 {
  "c": "N73.120",
  "l": 5,
  "sl": "Posredovanje oglaševalskega prostora",
  "en": "Media representation",
  "p": "N73.12"
 },
 {
  "c": "N73.2",
  "l": 3,
  "sl": "Raziskovanje trga in javnega mnenja",
  "en": "Market research and public opinion polling",
  "p": "N73"
 },
 {
  "c": "N73.20",
  "l": 4,
  "sl": "Raziskovanje trga in javnega mnenja",
  "en": "Market research and public opinion polling",
  "p": "N73.2"
 },
 {
  "c": "N73.200",
  "l": 5,
  "sl": "Raziskovanje trga in javnega mnenja",
  "en": "Market research and public opinion polling",
  "p": "N73.20"
 },
 {
  "c": "N73.3",
  "l": 3,
  "sl": "Dejavnost stikov z javnostjo",
  "en": "Public relations and communication activities",
  "p": "N73"
 },
 {
  "c": "N73.30",
  "l": 4,
  "sl": "Dejavnost stikov z javnostjo",
  "en": "Public relations and communication activities",
  "p": "N73.3"
 },
 {
  "c": "N73.300",
  "l": 5,
  "sl": "Dejavnost stikov z javnostjo",
  "en": "Public relations and communication activities",
  "p": "N73.30"
 },
 {
  "c": "N74",
  "l": 2,
  "sl": "Druge strokovne, znanstvene in tehnične dejavnosti",
  "en": "Other professional, scientific and technical activities",
  "p": "N"
 },
 {
  "c": "N74.1",
  "l": 3,
  "sl": "Specializirano oblikovanje",
  "en": "Specialised design activities",
  "p": "N74"
 },
 {
  "c": "N74.11",
  "l": 4,
  "sl": "Oblikovanje industrijskih izdelkov in modno oblikovanje",
  "en": "Industrial product and fashion design activities",
  "p": "N74.1"
 },
 {
  "c": "N74.110",
  "l": 5,
  "sl": "Oblikovanje industrijskih izdelkov in modno oblikovanje",
  "en": "Industrial product and fashion design activities",
  "p": "N74.11"
 },
 {
  "c": "N74.12",
  "l": 4,
  "sl": "Grafično oblikovanje in vizualno komuniciranje",
  "en": "Graphic design and visual communication activities",
  "p": "N74.1"
 },
 {
  "c": "N74.120",
  "l": 5,
  "sl": "Grafično oblikovanje in vizualno komuniciranje",
  "en": "Graphic design and visual communication activities",
  "p": "N74.12"
 },
 {
  "c": "N74.13",
  "l": 4,
  "sl": "Notranje oblikovanje",
  "en": "Interior design activities",
  "p": "N74.1"
 },
 {
  "c": "N74.130",
  "l": 5,
  "sl": "Notranje oblikovanje",
  "en": "Interior design activities",
  "p": "N74.13"
 },
 {
  "c": "N74.14",
  "l": 4,
  "sl": "Drugo specializirano oblikovanje",
  "en": "Other specialised design activities",
  "p": "N74.1"
 },
 {
  "c": "N74.140",
  "l": 5,
  "sl": "Drugo specializirano oblikovanje",
  "en": "Other specialised design activities",
  "p": "N74.14"
 },
 {
  "c": "N74.2",
  "l": 3,
  "sl": "Fotografska dejavnost",
  "en": "Photographic activities",
  "p": "N74"
 },
 {
  "c": "N74.20",
  "l": 4,
  "sl": "Fotografska dejavnost",
  "en": "Photographic activities",
  "p": "N74.2"
 },
 {
  "c": "N74.200",
  "l": 5,
  "sl": "Fotografska dejavnost",
  "en": "Photographic activities",
  "p": "N74.20"
 },
 {
  "c": "N74.3",
  "l": 3,
  "sl": "Prevajanje in tolmačenje",
  "en": "Translation and interpretation activities",
  "p": "N74"
 },
 {
  "c": "N74.30",
  "l": 4,
  "sl": "Prevajanje in tolmačenje",
  "en": "Translation and interpretation activities",
  "p": "N74.3"
 },
 {
  "c": "N74.300",
  "l": 5,
  "sl": "Prevajanje in tolmačenje",
  "en": "Translation and interpretation activities",
  "p": "N74.30"
 },
 {
  "c": "N74.9",
  "l": 3,
  "sl": "Druge strokovne, znanstvene in tehnične dejavnosti, d. n.",
  "en": "Other professional, scientific and technical activities n.e.c.",
  "p": "N74"
 },
 {
  "c": "N74.91",
  "l": 4,
  "sl": "Storitve patentnega posredništva in trženja",
  "en": "Patent brokering and marketing service activities",
  "p": "N74.9"
 },
 {
  "c": "N74.910",
  "l": 5,
  "sl": "Storitve patentnega posredništva in trženja",
  "en": "Patent brokering and marketing service activities",
  "p": "N74.91"
 },
 {
  "c": "N74.99",
  "l": 4,
  "sl": "Vse druge strokovne, znanstvene in tehnične dejavnosti, d. n.",
  "en": "All other professional, scientific and technical activities n.e.c.",
  "p": "N74.9"
 },
 {
  "c": "N74.990",
  "l": 5,
  "sl": "Vse druge strokovne, znanstvene in tehnične dejavnosti, d. n.",
  "en": "All other professional, scientific and technical activities n.e.c.",
  "p": "N74.99"
 },
 {
  "c": "N75",
  "l": 2,
  "sl": "Veterinarstvo",
  "en": "Veterinary activities",
  "p": "N"
 },
 {
  "c": "N75.0",
  "l": 3,
  "sl": "Veterinarstvo",
  "en": "Veterinary activities",
  "p": "N75"
 },
 {
  "c": "N75.00",
  "l": 4,
  "sl": "Veterinarstvo",
  "en": "Veterinary activities",
  "p": "N75.0"
 },
 {
  "c": "N75.000",
  "l": 5,
  "sl": "Veterinarstvo",
  "en": "Veterinary activities",
  "p": "N75.00"
 },
 {
  "c": "O",
  "l": 1,
  "sl": "DRUGE RAZNOVRSTNE POSLOVNE DEJAVNOSTI",
  "en": "ADMINISTRATIVE AND SUPPORT SERVICE ACTIVITIES",
  "p": null
 },
 {
  "c": "O77",
  "l": 2,
  "sl": "Dajanje v najem in zakup",
  "en": "Rental and leasing activities",
  "p": "O"
 },
 {
  "c": "O77.1",
  "l": 3,
  "sl": "Dajanje motornih vozil v najem in zakup",
  "en": "Rental and leasing of motor vehicles",
  "p": "O77"
 },
 {
  "c": "O77.11",
  "l": 4,
  "sl": "Dajanje lahkih motornih vozil v najem in zakup",
  "en": "Rental and leasing of cars and light motor vehicles",
  "p": "O77.1"
 },
 {
  "c": "O77.110",
  "l": 5,
  "sl": "Dajanje lahkih motornih vozil v najem in zakup",
  "en": "Rental and leasing of cars and light motor vehicles",
  "p": "O77.11"
 },
 {
  "c": "O77.12",
  "l": 4,
  "sl": "Dajanje tovornjakov v najem in zakup",
  "en": "Rental and leasing of trucks",
  "p": "O77.1"
 },
 {
  "c": "O77.120",
  "l": 5,
  "sl": "Dajanje tovornjakov v najem in zakup",
  "en": "Rental and leasing of trucks",
  "p": "O77.12"
 },
 {
  "c": "O77.2",
  "l": 3,
  "sl": "Dajanje izdelkov za široko rabo v najem in zakup",
  "en": "Rental and leasing of personal and household goods",
  "p": "O77"
 },
 {
  "c": "O77.21",
  "l": 4,
  "sl": "Dajanje športne opreme v najem in zakup",
  "en": "Rental and leasing of recreational and sports goods",
  "p": "O77.2"
 },
 {
  "c": "O77.210",
  "l": 5,
  "sl": "Dajanje športne opreme v najem in zakup",
  "en": "Rental and leasing of recreational and sports goods",
  "p": "O77.21"
 },
 {
  "c": "O77.22",
  "l": 4,
  "sl": "Dajanje drugih izdelkov za široko rabo v najem in zakup",
  "en": "Rental and leasing of other personal and household goods",
  "p": "O77.2"
 },
 {
  "c": "O77.220",
  "l": 5,
  "sl": "Dajanje drugih izdelkov za široko rabo v najem in zakup",
  "en": "Rental and leasing of other personal and household goods",
  "p": "O77.22"
 },
 {
  "c": "O77.3",
  "l": 3,
  "sl": "Dajanje strojev, naprav in drugih opredmetenih sredstev v najem in zakup",
  "en": "Rental and leasing of other machinery, equipment and tangible goods",
  "p": "O77"
 },
 {
  "c": "O77.31",
  "l": 4,
  "sl": "Dajanje kmetijskih strojev in opreme v najem in zakup",
  "en": "Rental and leasing of agricultural machinery and equipment",
  "p": "O77.3"
 },
 {
  "c": "O77.310",
  "l": 5,
  "sl": "Dajanje kmetijskih strojev in opreme v najem in zakup",
  "en": "Rental and leasing of agricultural machinery and equipment",
  "p": "O77.31"
 },
 {
  "c": "O77.32",
  "l": 4,
  "sl": "Dajanje gradbenih strojev in opreme v najem in zakup",
  "en": "Rental and leasing of construction and civil engineering machinery and equipment",
  "p": "O77.3"
 },
 {
  "c": "O77.320",
  "l": 5,
  "sl": "Dajanje gradbenih strojev in opreme v najem in zakup",
  "en": "Rental and leasing of construction and civil engineering machinery and equipment",
  "p": "O77.32"
 },
 {
  "c": "O77.33",
  "l": 4,
  "sl": "Dajanje pisarniške opreme in računalniških naprav v najem in zakup",
  "en": "Rental and leasing of office machinery, equipment and computers",
  "p": "O77.3"
 },
 {
  "c": "O77.330",
  "l": 5,
  "sl": "Dajanje pisarniške opreme in računalniških naprav v najem in zakup",
  "en": "Rental and leasing of office machinery, equipment and computers",
  "p": "O77.33"
 },
 {
  "c": "O77.34",
  "l": 4,
  "sl": "Dajanje vodnih plovil v najem in zakup",
  "en": "Rental and leasing of water transport equipment",
  "p": "O77.3"
 },
 {
  "c": "O77.340",
  "l": 5,
  "sl": "Dajanje vodnih plovil v najem in zakup",
  "en": "Rental and leasing of water transport equipment",
  "p": "O77.34"
 },
 {
  "c": "O77.35",
  "l": 4,
  "sl": "Dajanje zračnih plovil v najem in zakup",
  "en": "Rental and leasing of air transport equipment",
  "p": "O77.3"
 },
 {
  "c": "O77.350",
  "l": 5,
  "sl": "Dajanje zračnih plovil v najem in zakup",
  "en": "Rental and leasing of air transport equipment",
  "p": "O77.35"
 },
 {
  "c": "O77.39",
  "l": 4,
  "sl": "Dajanje drugih strojev, naprav in opredmetenih sredstev, d. n., v najem in zakup",
  "en": "Rental and leasing of other machinery, equipment and tangible goods n.e.c.",
  "p": "O77.3"
 },
 {
  "c": "O77.390",
  "l": 5,
  "sl": "Dajanje drugih strojev, naprav in opredmetenih sredstev, d. n., v najem in zakup",
  "en": "Rental and leasing of other machinery, equipment and tangible goods n.e.c.",
  "p": "O77.39"
 },
 {
  "c": "O77.4",
  "l": 3,
  "sl": "Dajanje pravic uporabe intelektualne lastnine v zakup, razen avtorsko zaščitenih del",
  "en": "Leasing of intellectual property and similar products, except copyrighted works",
  "p": "O77"
 },
 {
  "c": "O77.40",
  "l": 4,
  "sl": "Dajanje pravic uporabe intelektualne lastnine v zakup, razen avtorsko zaščitenih del",
  "en": "Leasing of intellectual property and similar products, except copyrighted works",
  "p": "O77.4"
 },
 {
  "c": "O77.400",
  "l": 5,
  "sl": "Dajanje pravic uporabe intelektualne lastnine v zakup, razen avtorsko zaščitenih del",
  "en": "Leasing of intellectual property and similar products, except copyrighted works",
  "p": "O77.40"
 },
 {
  "c": "O77.5",
  "l": 3,
  "sl": "Posredništvo pri dajanju opredmetenih sredstev in nefinančnih neopredmetenih sredstev v najem in zakup",
  "en": "Intermediation service activities for rental and leasing of tangible goods and non-financial intangible assets",
  "p": "O77"
 },
 {
  "c": "O77.51",
  "l": 4,
  "sl": "Posredništvo pri dajanju avtomobilov, avtodomov in prikolic v najem in zakup",
  "en": "Intermediation service activities for rental and leasing of cars, motorhomes and trailers",
  "p": "O77.5"
 },
 {
  "c": "O77.510",
  "l": 5,
  "sl": "Posredništvo pri dajanju avtomobilov, avtodomov in prikolic v najem in zakup",
  "en": "Intermediation service activities for rental and leasing of cars, motorhomes and trailers",
  "p": "O77.51"
 },
 {
  "c": "O77.52",
  "l": 4,
  "sl": "Posredništvo pri dajanju drugih opredmetenih sredstev in nefinančnih neopredmetenih sredstev v najem in zakup",
  "en": "Intermediation service activities for rental and leasing of other tangible goods and non-financial intangible assets",
  "p": "O77.5"
 },
 {
  "c": "O77.520",
  "l": 5,
  "sl": "Posredništvo pri dajanju drugih opredmetenih sredstev in nefinančnih neopredmetenih sredstev v najem in zakup",
  "en": "Intermediation service activities for rental and leasing of other tangible goods and non-financial intangible assets",
  "p": "O77.52"
 },
 {
  "c": "O78",
  "l": 2,
  "sl": "Zaposlovalne dejavnosti",
  "en": "Employment activities",
  "p": "O"
 },
 {
  "c": "O78.1",
  "l": 3,
  "sl": "Dejavnost pri iskanju zaposlitve",
  "en": "Activities of employment placement agencies",
  "p": "O78"
 },
 {
  "c": "O78.10",
  "l": 4,
  "sl": "Dejavnost pri iskanju zaposlitve",
  "en": "Activities of employment placement agencies",
  "p": "O78.1"
 },
 {
  "c": "O78.100",
  "l": 5,
  "sl": "Dejavnost pri iskanju zaposlitve",
  "en": "Activities of employment placement agencies",
  "p": "O78.10"
 },
 {
  "c": "O78.2",
  "l": 3,
  "sl": "Posredovanje začasne delovne sile in druga oskrba s človeškimi viri",
  "en": "Temporary employment agency activities and other human resource provisions",
  "p": "O78"
 },
 {
  "c": "O78.20",
  "l": 4,
  "sl": "Posredovanje začasne delovne sile in druga oskrba s človeškimi viri",
  "en": "Temporary employment agency activities and other human resource provisions",
  "p": "O78.2"
 },
 {
  "c": "O78.200",
  "l": 5,
  "sl": "Posredovanje začasne delovne sile in druga oskrba s človeškimi viri",
  "en": "Temporary employment agency activities and other human resource provisions",
  "p": "O78.20"
 },
 {
  "c": "O79",
  "l": 2,
  "sl": "Dejavnost potovalnih agencij, organizatorjev potovanj ter druge storitve rezervacij in druge s potovanji povezane dejavnosti",
  "en": "Travel agency, tour operator and other reservation service and related activities",
  "p": "O"
 },
 {
  "c": "O79.1",
  "l": 3,
  "sl": "Dejavnost potovalnih agencij in organizatorjev potovanj",
  "en": "Travel agency and tour operator activities",
  "p": "O79"
 },
 {
  "c": "O79.11",
  "l": 4,
  "sl": "Dejavnost potovalnih agencij",
  "en": "Travel agency activities",
  "p": "O79.1"
 },
 {
  "c": "O79.110",
  "l": 5,
  "sl": "Dejavnost potovalnih agencij",
  "en": "Travel agency activities",
  "p": "O79.11"
 },
 {
  "c": "O79.12",
  "l": 4,
  "sl": "Dejavnost organizatorjev potovanj",
  "en": "Tour operator activities",
  "p": "O79.1"
 },
 {
  "c": "O79.120",
  "l": 5,
  "sl": "Dejavnost organizatorjev potovanj",
  "en": "Tour operator activities",
  "p": "O79.12"
 },
 {
  "c": "O79.9",
  "l": 3,
  "sl": "Druge storitve rezervacij in druge s potovanji povezane dejavnosti",
  "en": "Other reservation service and related activities",
  "p": "O79"
 },
 {
  "c": "O79.90",
  "l": 4,
  "sl": "Druge storitve rezervacij in druge s potovanji povezane dejavnosti",
  "en": "Other reservation service and related activities",
  "p": "O79.9"
 },
 {
  "c": "O79.900",
  "l": 5,
  "sl": "Druge storitve rezervacij in druge s potovanji povezane dejavnosti",
  "en": "Other reservation service and related activities",
  "p": "O79.90"
 },
 {
  "c": "O80",
  "l": 2,
  "sl": "Preiskovalne dejavnosti in varovanje",
  "en": "Investigation and security activities",
  "p": "O"
 },
 {
  "c": "O80.0",
  "l": 3,
  "sl": "Preiskovalne dejavnosti in varovanje",
  "en": "Investigation and security activities",
  "p": "O80"
 },
 {
  "c": "O80.01",
  "l": 4,
  "sl": "Preiskovalne dejavnosti in zasebno varovanje",
  "en": "Investigation and private security activities",
  "p": "O80.0"
 },
 {
  "c": "O80.011",
  "l": 5,
  "sl": "Detektivske dejavnosti",
  "en": "Detective activities",
  "p": "O80.01"
 },
 {
  "c": "O80.012",
  "l": 5,
  "sl": "Zasebno varovanje",
  "en": "Private security",
  "p": "O80.01"
 },
 {
  "c": "O80.019",
  "l": 5,
  "sl": "Druge preiskovalne dejavnosti",
  "en": "Other investigative activities",
  "p": "O80.01"
 },
 {
  "c": "O80.09",
  "l": 4,
  "sl": "Varovanje, d. n.",
  "en": "Security activities n.e.c.",
  "p": "O80.0"
 },
 {
  "c": "O80.090",
  "l": 5,
  "sl": "Varovanje, d. n.",
  "en": "Security activities n.e.c.",
  "p": "O80.09"
 },
 {
  "c": "O81",
  "l": 2,
  "sl": "Dejavnost oskrbe stavb in okolice",
  "en": "Services to buildings and landscape activities",
  "p": "O"
 },
 {
  "c": "O81.1",
  "l": 3,
  "sl": "Vzdrževanje objektov in hišniška dejavnost",
  "en": "Combined facilities support activities",
  "p": "O81"
 },
 {
  "c": "O81.10",
  "l": 4,
  "sl": "Vzdrževanje objektov in hišniška dejavnost",
  "en": "Combined facilities support activities",
  "p": "O81.1"
 },
 {
  "c": "O81.100",
  "l": 5,
  "sl": "Vzdrževanje objektov in hišniška dejavnost",
  "en": "Combined facilities support activities",
  "p": "O81.10"
 },
 {
  "c": "O81.2",
  "l": 3,
  "sl": "Čiščenje",
  "en": "Cleaning activities",
  "p": "O81"
 },
 {
  "c": "O81.21",
  "l": 4,
  "sl": "Splošno čiščenje stavb",
  "en": "General cleaning of buildings",
  "p": "O81.2"
 },
 {
  "c": "O81.210",
  "l": 5,
  "sl": "Splošno čiščenje stavb",
  "en": "General cleaning of buildings",
  "p": "O81.21"
 },
 {
  "c": "O81.22",
  "l": 4,
  "sl": "Drugo čiščenje stavb, industrijskih naprav in opreme",
  "en": "Other building and industrial cleaning activities",
  "p": "O81.2"
 },
 {
  "c": "O81.220",
  "l": 5,
  "sl": "Drugo čiščenje stavb, industrijskih naprav in opreme",
  "en": "Other building and industrial cleaning activities",
  "p": "O81.22"
 },
 {
  "c": "O81.23",
  "l": 4,
  "sl": "Drugo čiščenje",
  "en": "Other cleaning activities",
  "p": "O81.2"
 },
 {
  "c": "O81.230",
  "l": 5,
  "sl": "Drugo čiščenje",
  "en": "Other cleaning activities",
  "p": "O81.23"
 },
 {
  "c": "O81.3",
  "l": 3,
  "sl": "Urejanje in vzdrževanje zelenih površin in okolice",
  "en": "Landscape service activities",
  "p": "O81"
 },
 {
  "c": "O81.30",
  "l": 4,
  "sl": "Urejanje in vzdrževanje zelenih površin in okolice",
  "en": "Landscape service activities",
  "p": "O81.3"
 },
 {
  "c": "O81.300",
  "l": 5,
  "sl": "Urejanje in vzdrževanje zelenih površin in okolice",
  "en": "Landscape service activities",
  "p": "O81.30"
 },
 {
  "c": "O82",
  "l": 2,
  "sl": "Pisarniške in spremljajoče poslovne storitvene dejavnosti",
  "en": "Office administrative, office support and other business support activities",
  "p": "O"
 },
 {
  "c": "O82.1",
  "l": 3,
  "sl": "Pisarniške dejavnosti",
  "en": "Office administrative and support activities",
  "p": "O82"
 },
 {
  "c": "O82.10",
  "l": 4,
  "sl": "Pisarniške dejavnosti",
  "en": "Office administrative and support activities",
  "p": "O82.1"
 },
 {
  "c": "O82.100",
  "l": 5,
  "sl": "Pisarniške dejavnosti",
  "en": "Office administrative and support activities",
  "p": "O82.10"
 },
 {
  "c": "O82.2",
  "l": 3,
  "sl": "Dejavnosti klicnih centrov",
  "en": "Activities of call centres",
  "p": "O82"
 },
 {
  "c": "O82.20",
  "l": 4,
  "sl": "Dejavnosti klicnih centrov",
  "en": "Activities of call centres",
  "p": "O82.2"
 },
 {
  "c": "O82.200",
  "l": 5,
  "sl": "Dejavnosti klicnih centrov",
  "en": "Activities of call centres",
  "p": "O82.20"
 },
 {
  "c": "O82.3",
  "l": 3,
  "sl": "Organiziranje razstav, sejmov, srečanj",
  "en": "Organisation of conventions and trade shows",
  "p": "O82"
 },
 {
  "c": "O82.30",
  "l": 4,
  "sl": "Organiziranje razstav, sejmov, srečanj",
  "en": "Organisation of conventions and trade shows",
  "p": "O82.3"
 },
 {
  "c": "O82.300",
  "l": 5,
  "sl": "Organiziranje razstav, sejmov, srečanj",
  "en": "Organisation of conventions and trade shows",
  "p": "O82.30"
 },
 {
  "c": "O82.4",
  "l": 3,
  "sl": "Posredniške storitve za spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Intermediation service activities for business support service activities n.e.c.",
  "p": "O82"
 },
 {
  "c": "O82.40",
  "l": 4,
  "sl": "Posredniške storitve za spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Intermediation service activities for business support service activities n.e.c.",
  "p": "O82.4"
 },
 {
  "c": "O82.400",
  "l": 5,
  "sl": "Posredniške storitve za spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Intermediation service activities for business support service activities n.e.c.",
  "p": "O82.40"
 },
 {
  "c": "O82.9",
  "l": 3,
  "sl": "Spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Business support service activities n.e.c.",
  "p": "O82"
 },
 {
  "c": "O82.91",
  "l": 4,
  "sl": "Izterjava in ocenjevanje kreditne sposobnosti",
  "en": "Activities of collection agencies and credit bureaus",
  "p": "O82.9"
 },
 {
  "c": "O82.910",
  "l": 5,
  "sl": "Izterjava in ocenjevanje kreditne sposobnosti",
  "en": "Activities of collection agencies and credit bureaus",
  "p": "O82.91"
 },
 {
  "c": "O82.92",
  "l": 4,
  "sl": "Pakiranje",
  "en": "Packaging activities",
  "p": "O82.9"
 },
 {
  "c": "O82.920",
  "l": 5,
  "sl": "Pakiranje",
  "en": "Packaging activities",
  "p": "O82.92"
 },
 {
  "c": "O82.99",
  "l": 4,
  "sl": "Druge spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Other business support service activities n.e.c.",
  "p": "O82.9"
 },
 {
  "c": "O82.990",
  "l": 5,
  "sl": "Druge spremljajoče poslovne storitvene dejavnosti, d. n.",
  "en": "Other business support service activities n.e.c.",
  "p": "O82.99"
 },
 {
  "c": "P",
  "l": 1,
  "sl": "DEJAVNOST JAVNE UPRAVE IN OBRAMBE, DEJAVNOST OBVEZNE SOCIALNE VARNOSTI",
  "en": "PUBLIC ADMINISTRATION AND DEFENCE, COMPULSORY SOCIAL SECURITY",
  "p": null
 },
 {
  "c": "P84",
  "l": 2,
  "sl": "Dejavnost javne uprave in obrambe, dejavnost obvezne socialne varnosti",
  "en": "Public administration and defence, compulsory social security",
  "p": "P"
 },
 {
  "c": "P84.1",
  "l": 3,
  "sl": "Dejavnost državne uprave ter ekonomska, socialna in okoljska politika skupnosti",
  "en": "Administration of the State and the economic, social and environmental policies of the community",
  "p": "P84"
 },
 {
  "c": "P84.11",
  "l": 4,
  "sl": "Splošna dejavnost javne uprave",
  "en": "General public administration activities",
  "p": "P84.1"
 },
 {
  "c": "P84.110",
  "l": 5,
  "sl": "Splošna dejavnost javne uprave",
  "en": "General public administration activities",
  "p": "P84.11"
 },
 {
  "c": "P84.12",
  "l": 4,
  "sl": "Urejanje zdravstva, izobraževanja, kulturnih in drugih socialnih storitev",
  "en": "Regulation of health care, education, cultural services and other social services",
  "p": "P84.1"
 },
 {
  "c": "P84.120",
  "l": 5,
  "sl": "Urejanje zdravstva, izobraževanja, kulturnih in drugih socialnih storitev",
  "en": "Regulation of health care, education, cultural services and other social services",
  "p": "P84.12"
 },
 {
  "c": "P84.13",
  "l": 4,
  "sl": "Urejanje gospodarskih področij za učinkovitejše poslovanje",
  "en": "Regulation of and contribution to more efficient operation of businesses",
  "p": "P84.1"
 },
 {
  "c": "P84.130",
  "l": 5,
  "sl": "Urejanje gospodarskih področij za učinkovitejše poslovanje",
  "en": "Regulation of and contribution to more efficient operation of businesses",
  "p": "P84.13"
 },
 {
  "c": "P84.2",
  "l": 3,
  "sl": "Posebne dejavnosti za celotno družbeno skupnost",
  "en": "Provision of services to the community as a whole",
  "p": "P84"
 },
 {
  "c": "P84.21",
  "l": 4,
  "sl": "Urejanje zunanjih zadev",
  "en": "Foreign affairs",
  "p": "P84.2"
 },
 {
  "c": "P84.210",
  "l": 5,
  "sl": "Urejanje zunanjih zadev",
  "en": "Foreign affairs",
  "p": "P84.21"
 },
 {
  "c": "P84.22",
  "l": 4,
  "sl": "Obramba",
  "en": "Defence activities",
  "p": "P84.2"
 },
 {
  "c": "P84.220",
  "l": 5,
  "sl": "Obramba",
  "en": "Defence activities",
  "p": "P84.22"
 },
 {
  "c": "P84.23",
  "l": 4,
  "sl": "Sodstvo",
  "en": "Justice and judicial activities",
  "p": "P84.2"
 },
 {
  "c": "P84.230",
  "l": 5,
  "sl": "Sodstvo",
  "en": "Justice and judicial activities",
  "p": "P84.23"
 },
 {
  "c": "P84.24",
  "l": 4,
  "sl": "Dejavnosti za javni red in varnost",
  "en": "Public order and safety activities",
  "p": "P84.2"
 },
 {
  "c": "P84.240",
  "l": 5,
  "sl": "Dejavnosti za javni red in varnost",
  "en": "Public order and safety activities",
  "p": "P84.24"
 },
 {
  "c": "P84.25",
  "l": 4,
  "sl": "Zaščita in reševanje pri požarih in nesrečah",
  "en": "Fire service activities",
  "p": "P84.2"
 },
 {
  "c": "P84.250",
  "l": 5,
  "sl": "Zaščita in reševanje pri požarih in nesrečah",
  "en": "Fire service activities",
  "p": "P84.25"
 },
 {
  "c": "P84.3",
  "l": 3,
  "sl": "Dejavnost obvezne socialne varnosti",
  "en": "Compulsory social security activities",
  "p": "P84"
 },
 {
  "c": "P84.30",
  "l": 4,
  "sl": "Dejavnost obvezne socialne varnosti",
  "en": "Compulsory social security activities",
  "p": "P84.3"
 },
 {
  "c": "P84.300",
  "l": 5,
  "sl": "Dejavnost obvezne socialne varnosti",
  "en": "Compulsory social security activities",
  "p": "P84.30"
 },
 {
  "c": "Q",
  "l": 1,
  "sl": "IZOBRAŽEVANJE",
  "en": "EDUCATION",
  "p": null
 },
 {
  "c": "Q85",
  "l": 2,
  "sl": "Izobraževanje",
  "en": "Education",
  "p": "Q"
 },
 {
  "c": "Q85.1",
  "l": 3,
  "sl": "Predprimarna vzgoja in izobraževanje",
  "en": "Pre-primary education",
  "p": "Q85"
 },
 {
  "c": "Q85.10",
  "l": 4,
  "sl": "Predprimarna vzgoja in izobraževanje",
  "en": "Pre-primary education",
  "p": "Q85.1"
 },
 {
  "c": "Q85.100",
  "l": 5,
  "sl": "Predprimarna vzgoja in izobraževanje",
  "en": "Pre-primary education",
  "p": "Q85.10"
 },
 {
  "c": "Q85.2",
  "l": 3,
  "sl": "Primarno izobraževanje",
  "en": "Primary education",
  "p": "Q85"
 },
 {
  "c": "Q85.20",
  "l": 4,
  "sl": "Primarno izobraževanje",
  "en": "Primary education",
  "p": "Q85.2"
 },
 {
  "c": "Q85.200",
  "l": 5,
  "sl": "Primarno izobraževanje",
  "en": "Primary education",
  "p": "Q85.20"
 },
 {
  "c": "Q85.3",
  "l": 3,
  "sl": "Sekundarno in posekundarno neterciarno izobraževanje",
  "en": "Secondary and post-secondary non-tertiary education",
  "p": "Q85"
 },
 {
  "c": "Q85.31",
  "l": 4,
  "sl": "Splošno sekundarno izobraževanje",
  "en": "General secondary education",
  "p": "Q85.3"
 },
 {
  "c": "Q85.310",
  "l": 5,
  "sl": "Splošno sekundarno izobraževanje",
  "en": "General secondary education",
  "p": "Q85.31"
 },
 {
  "c": "Q85.32",
  "l": 4,
  "sl": "Poklicno sekundarno izobraževanje",
  "en": "Vocational secondary education",
  "p": "Q85.3"
 },
 {
  "c": "Q85.320",
  "l": 5,
  "sl": "Poklicno sekundarno izobraževanje",
  "en": "Vocational secondary education",
  "p": "Q85.32"
 },
 {
  "c": "Q85.33",
  "l": 4,
  "sl": "Posekundarno neterciarno izobraževanje",
  "en": "Post-secondary non-tertiary education",
  "p": "Q85.3"
 },
 {
  "c": "Q85.330",
  "l": 5,
  "sl": "Posekundarno neterciarno izobraževanje",
  "en": "Post-secondary non-tertiary education",
  "p": "Q85.33"
 },
 {
  "c": "Q85.4",
  "l": 3,
  "sl": "Terciarno izobraževanje",
  "en": "Tertiary education",
  "p": "Q85"
 },
 {
  "c": "Q85.40",
  "l": 4,
  "sl": "Terciarno izobraževanje",
  "en": "Tertiary education",
  "p": "Q85.4"
 },
 {
  "c": "Q85.401",
  "l": 5,
  "sl": "Višješolsko izobraževanje",
  "en": "First and second stages of tertiary education",
  "p": "Q85.40"
 },
 {
  "c": "Q85.402",
  "l": 5,
  "sl": "Visokošolsko izobraževanje",
  "en": "Third stage of tertiary education",
  "p": "Q85.40"
 },
 {
  "c": "Q85.5",
  "l": 3,
  "sl": "Drugo izobraževanje, izpopolnjevanje in usposabljanje",
  "en": "Other education",
  "p": "Q85"
 },
 {
  "c": "Q85.51",
  "l": 4,
  "sl": "Izobraževanje, izpopolnjevanje in usposabljanje na področju športa in rekreacije",
  "en": "Sports and recreation education",
  "p": "Q85.5"
 },
 {
  "c": "Q85.510",
  "l": 5,
  "sl": "Izobraževanje, izpopolnjevanje in usposabljanje na področju športa in rekreacije",
  "en": "Sports and recreation education",
  "p": "Q85.51"
 },
 {
  "c": "Q85.52",
  "l": 4,
  "sl": "Izobraževanje, izpopolnjevanje in usposabljanje na področju kulture in umetnosti",
  "en": "Cultural education",
  "p": "Q85.5"
 },
 {
  "c": "Q85.520",
  "l": 5,
  "sl": "Izobraževanje, izpopolnjevanje in usposabljanje na področju kulture in umetnosti",
  "en": "Cultural education",
  "p": "Q85.52"
 },
 {
  "c": "Q85.53",
  "l": 4,
  "sl": "Dejavnost vozniških šol",
  "en": "Driving school activities",
  "p": "Q85.5"
 },
 {
  "c": "Q85.530",
  "l": 5,
  "sl": "Dejavnost vozniških šol",
  "en": "Driving school activities",
  "p": "Q85.53"
 },
 {
  "c": "Q85.59",
  "l": 4,
  "sl": "Drugo izobraževanje, izpopolnjevanje in usposabljanje, d. n.",
  "en": "Other education n.e.c.",
  "p": "Q85.5"
 },
 {
  "c": "Q85.590",
  "l": 5,
  "sl": "Drugo izobraževanje, izpopolnjevanje in usposabljanje, d. n.",
  "en": "Other education n.e.c.",
  "p": "Q85.59"
 },
 {
  "c": "Q85.6",
  "l": 3,
  "sl": "Pomožne dejavnosti za izobraževanje",
  "en": "Educational support activities",
  "p": "Q85"
 },
 {
  "c": "Q85.61",
  "l": 4,
  "sl": "Posredniške dejavnosti za tečaje in inštruiranje",
  "en": "Intermediation service activities for courses and tutors",
  "p": "Q85.6"
 },
 {
  "c": "Q85.610",
  "l": 5,
  "sl": "Posredniške dejavnosti za tečaje in inštruiranje",
  "en": "Intermediation service activities for courses and tutors",
  "p": "Q85.61"
 },
 {
  "c": "Q85.69",
  "l": 4,
  "sl": "Pomožne dejavnosti za izobraževanje, d. n.",
  "en": "Educational support activities n.e.c.",
  "p": "Q85.6"
 },
 {
  "c": "Q85.690",
  "l": 5,
  "sl": "Pomožne dejavnosti za izobraževanje, d. n.",
  "en": "Educational support activities n.e.c.",
  "p": "Q85.69"
 },
 {
  "c": "R",
  "l": 1,
  "sl": "ZDRAVSTVO IN SOCIALNO VARSTVO",
  "en": "HUMAN HEALTH AND SOCIAL WORK ACTIVITIES",
  "p": null
 },
 {
  "c": "R86",
  "l": 2,
  "sl": "Zdravstvo",
  "en": "Human health activities",
  "p": "R"
 },
 {
  "c": "R86.1",
  "l": 3,
  "sl": "Bolnišnična zdravstvena dejavnost",
  "en": "Hospital activities",
  "p": "R86"
 },
 {
  "c": "R86.10",
  "l": 4,
  "sl": "Bolnišnična zdravstvena dejavnost",
  "en": "Hospital activities",
  "p": "R86.1"
 },
 {
  "c": "R86.100",
  "l": 5,
  "sl": "Bolnišnična zdravstvena dejavnost",
  "en": "Hospital activities",
  "p": "R86.10"
 },
 {
  "c": "R86.2",
  "l": 3,
  "sl": "Zunajbolnišnična zdravstvena in zobozdravstvena dejavnost",
  "en": "Medical and dental practice activities",
  "p": "R86"
 },
 {
  "c": "R86.21",
  "l": 4,
  "sl": "Splošna zunajbolnišnična zdravstvena dejavnost",
  "en": "General medical practice activities",
  "p": "R86.2"
 },
 {
  "c": "R86.210",
  "l": 5,
  "sl": "Splošna zunajbolnišnična zdravstvena dejavnost",
  "en": "General medical practice activities",
  "p": "R86.21"
 },
 {
  "c": "R86.22",
  "l": 4,
  "sl": "Specializirana zdravstvena dejavnost",
  "en": "Medical specialists activities",
  "p": "R86.2"
 },
 {
  "c": "R86.220",
  "l": 5,
  "sl": "Specializirana zdravstvena dejavnost",
  "en": "Medical specialists activities",
  "p": "R86.22"
 },
 {
  "c": "R86.23",
  "l": 4,
  "sl": "Zobozdravstvena dejavnost",
  "en": "Dental practice care activities",
  "p": "R86.2"
 },
 {
  "c": "R86.230",
  "l": 5,
  "sl": "Zobozdravstvena dejavnost",
  "en": "Dental practice care activities",
  "p": "R86.23"
 },
 {
  "c": "R86.9",
  "l": 3,
  "sl": "Druge dejavnosti za zdravje",
  "en": "Other human health activities",
  "p": "R86"
 },
 {
  "c": "R86.91",
  "l": 4,
  "sl": "Storitve diagnostičnega slikanja in dejavnosti medicinskih laboratorijev",
  "en": "Diagnostic imaging services and medical laboratory activities",
  "p": "R86.9"
 },
 {
  "c": "R86.910",
  "l": 5,
  "sl": "Storitve diagnostičnega slikanja in dejavnosti medicinskih laboratorijev",
  "en": "Diagnostic imaging services and medical laboratory activities",
  "p": "R86.91"
 },
 {
  "c": "R86.92",
  "l": 4,
  "sl": "Prevoz bolnikov z reševalnim vozilom",
  "en": "Patient transportation by ambulance",
  "p": "R86.9"
 },
 {
  "c": "R86.920",
  "l": 5,
  "sl": "Prevoz bolnikov z reševalnim vozilom",
  "en": "Patient transportation by ambulance",
  "p": "R86.92"
 },
 {
  "c": "R86.93",
  "l": 4,
  "sl": "Dejavnost psihologov in psihoterapevtov, razen zdravnikov",
  "en": "Activities of psychologists and psychotherapists, except medical doctors",
  "p": "R86.9"
 },
 {
  "c": "R86.930",
  "l": 5,
  "sl": "Dejavnost psihologov in psihoterapevtov, razen zdravnikov",
  "en": "Activities of psychologists and psychotherapists, except medical doctors",
  "p": "R86.93"
 },
 {
  "c": "R86.94",
  "l": 4,
  "sl": "Zdravstvena in babiška nega",
  "en": "Nursing and midwifery activities",
  "p": "R86.9"
 },
 {
  "c": "R86.940",
  "l": 5,
  "sl": "Zdravstvena in babiška nega",
  "en": "Nursing and midwifery activities",
  "p": "R86.94"
 },
 {
  "c": "R86.95",
  "l": 4,
  "sl": "Fizioterapija",
  "en": "Physiotherapy activities",
  "p": "R86.9"
 },
 {
  "c": "R86.950",
  "l": 5,
  "sl": "Fizioterapija",
  "en": "Physiotherapy activities",
  "p": "R86.95"
 },
 {
  "c": "R86.96",
  "l": 4,
  "sl": "Dejavnost tradicionalne, dopolnilne ali alternativne medicine",
  "en": "Traditional, complementary and alternative medicine activities",
  "p": "R86.9"
 },
 {
  "c": "R86.960",
  "l": 5,
  "sl": "Dejavnost tradicionalne, dopolnilne ali alternativne medicine",
  "en": "Traditional, complementary and alternative medicine activities",
  "p": "R86.96"
 },
 {
  "c": "R86.97",
  "l": 4,
  "sl": "Posredništvo pri zdravstvenih in zobozdravstvenih storitvah ter drugih storitvah za zdravje",
  "en": "Intermediation service activities for medical, dental and other human health services",
  "p": "R86.9"
 },
 {
  "c": "R86.970",
  "l": 5,
  "sl": "Posredništvo pri zdravstvenih in zobozdravstvenih storitvah ter drugih storitvah za zdravje",
  "en": "Intermediation service activities for medical, dental and other human health services",
  "p": "R86.97"
 },
 {
  "c": "R86.99",
  "l": 4,
  "sl": "Druge dejavnosti za zdravje, d. n.",
  "en": "Other human health activities n.e.c.",
  "p": "R86.9"
 },
 {
  "c": "R86.990",
  "l": 5,
  "sl": "Druge dejavnosti za zdravje, d. n.",
  "en": "Other human health activities n.e.c.",
  "p": "R86.99"
 },
 {
  "c": "R87",
  "l": 2,
  "sl": "Socialno varstvo z nastanitvijo",
  "en": "Residential care activities",
  "p": "R"
 },
 {
  "c": "R87.1",
  "l": 3,
  "sl": "Dejavnost nastanitvenih ustanov za bolniško nego",
  "en": "Residential nursing care activities",
  "p": "R87"
 },
 {
  "c": "R87.10",
  "l": 4,
  "sl": "Dejavnost nastanitvenih ustanov za bolniško nego",
  "en": "Residential nursing care activities",
  "p": "R87.1"
 },
 {
  "c": "R87.100",
  "l": 5,
  "sl": "Dejavnost nastanitvenih ustanov za bolniško nego",
  "en": "Residential nursing care activities",
  "p": "R87.10"
 },
 {
  "c": "R87.2",
  "l": 3,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo oseb, ki živijo z duševno motnjo ali zasvojenostjo ali jim je bila ta diagnosticirana",
  "en": "Residential care activities for persons living with or having a diagnosis of a mental illness or substance abuse",
  "p": "R87"
 },
 {
  "c": "R87.20",
  "l": 4,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo oseb, ki živijo z duševno motnjo ali zasvojenostjo ali jim je bila ta diagnosticirana",
  "en": "Residential care activities for persons living with or having a diagnosis of a mental illness or substance abuse",
  "p": "R87.2"
 },
 {
  "c": "R87.200",
  "l": 5,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo oseb, ki živijo z duševno motnjo ali zasvojenostjo ali jim je bila ta diagnosticirana",
  "en": "Residential care activities for persons living with or having a diagnosis of a mental illness or substance abuse",
  "p": "R87.20"
 },
 {
  "c": "R87.3",
  "l": 3,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo starejših ali invalidov",
  "en": "Residential care activities for older persons or persons with physical disabilities",
  "p": "R87"
 },
 {
  "c": "R87.30",
  "l": 4,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo starejših ali invalidov",
  "en": "Residential care activities for older persons or persons with physical disabilities",
  "p": "R87.3"
 },
 {
  "c": "R87.300",
  "l": 5,
  "sl": "Dejavnost nastanitvenih ustanov za oskrbo starejših ali invalidov",
  "en": "Residential care activities for older persons or persons with physical disabilities",
  "p": "R87.30"
 },
 {
  "c": "R87.9",
  "l": 3,
  "sl": "Drugo socialno varstvo z nastanitvijo",
  "en": "Other residential care activities",
  "p": "R87"
 },
 {
  "c": "R87.91",
  "l": 4,
  "sl": "Posredniške storitve za socialno varstvo z nastanitvijo",
  "en": "Intermediation service activities for residential care activities",
  "p": "R87.9"
 },
 {
  "c": "R87.910",
  "l": 5,
  "sl": "Posredniške storitve za socialno varstvo z nastanitvijo",
  "en": "Intermediation service activities for residential care activities",
  "p": "R87.91"
 },
 {
  "c": "R87.99",
  "l": 4,
  "sl": "Drugo socialno varstvo z nastanitvijo, d. n.",
  "en": "Other residential care activities n.e.c.",
  "p": "R87.9"
 },
 {
  "c": "R87.990",
  "l": 5,
  "sl": "Drugo socialno varstvo z nastanitvijo, d. n.",
  "en": "Other residential care activities n.e.c.",
  "p": "R87.99"
 },
 {
  "c": "R88",
  "l": 2,
  "sl": "Socialno varstvo brez nastanitve",
  "en": "Social work activities without accommodation",
  "p": "R"
 },
 {
  "c": "R88.1",
  "l": 3,
  "sl": "Socialno varstvo brez nastanitve za starejše ali invalide",
  "en": "Social work activities without accommodation for older persons or persons with disabilities",
  "p": "R88"
 },
 {
  "c": "R88.10",
  "l": 4,
  "sl": "Socialno varstvo brez nastanitve za starejše ali invalide",
  "en": "Social work activities without accommodation for older persons or persons with disabilities",
  "p": "R88.1"
 },
 {
  "c": "R88.101",
  "l": 5,
  "sl": "Dejavnost invalidskih podjetij",
  "en": "Activity of enterprises employing disabled persons",
  "p": "R88.10"
 },
 {
  "c": "R88.109",
  "l": 5,
  "sl": "Drugo socialno varstvo brez nastanitve za starejše ali invalide",
  "en": "Other social work activities without accommodation for older persons or persons with disabilities",
  "p": "R88.10"
 },
 {
  "c": "R88.9",
  "l": 3,
  "sl": "Drugo socialno varstvo brez nastanitve",
  "en": "Other social work activities without accommodation",
  "p": "R88"
 },
 {
  "c": "R88.91",
  "l": 4,
  "sl": "Dnevno varstvo otrok",
  "en": "Child day-care activities",
  "p": "R88.9"
 },
 {
  "c": "R88.910",
  "l": 5,
  "sl": "Dnevno varstvo otrok",
  "en": "Child day-care activities",
  "p": "R88.91"
 },
 {
  "c": "R88.99",
  "l": 4,
  "sl": "Drugo socialno varstvo brez nastanitve, d. n.",
  "en": "Other social work activities without accommodation n.e.c.",
  "p": "R88.9"
 },
 {
  "c": "R88.991",
  "l": 5,
  "sl": "Dejavnost humanitarnih in dobrodelnih organizacij",
  "en": "Activity of humanitarian and charity organisations",
  "p": "R88.99"
 },
 {
  "c": "R88.999",
  "l": 5,
  "sl": "Drugo drugje nerazvrščeno socialno varstvo brez nastanitve",
  "en": "Other social work activities without accommodation n.e.c.",
  "p": "R88.99"
 },
 {
  "c": "S",
  "l": 1,
  "sl": "KULTURNE, ŠPORTNE IN REKREACIJSKE DEJAVNOSTI",
  "en": "ARTS, SPORTS AND RECREATION",
  "p": null
 },
 {
  "c": "S90",
  "l": 2,
  "sl": "Umetniško ustvarjanje in uprizoritvene umetnosti",
  "en": "Arts creation and performing arts activities",
  "p": "S"
 },
 {
  "c": "S90.1",
  "l": 3,
  "sl": "Umetniško ustvarjanje",
  "en": "Arts creation activities",
  "p": "S90"
 },
 {
  "c": "S90.11",
  "l": 4,
  "sl": "Literarno ustvarjanje in komponiranje glasbe",
  "en": "Literary creation and musical composition activities",
  "p": "S90.1"
 },
 {
  "c": "S90.111",
  "l": 5,
  "sl": "Literarno ustvarjanje",
  "en": "Literary creation",
  "p": "S90.11"
 },
 {
  "c": "S90.112",
  "l": 5,
  "sl": "Komponiranje glasbe",
  "en": "Musical composition activities",
  "p": "S90.11"
 },
 {
  "c": "S90.12",
  "l": 4,
  "sl": "Vizualna umetnost",
  "en": "Visual arts creation activities",
  "p": "S90.1"
 },
 {
  "c": "S90.120",
  "l": 5,
  "sl": "Vizualna umetnost",
  "en": "Visual arts creation activities",
  "p": "S90.12"
 },
 {
  "c": "S90.13",
  "l": 4,
  "sl": "Drugo umetniško ustvarjanje",
  "en": "Other arts creation activities",
  "p": "S90.1"
 },
 {
  "c": "S90.130",
  "l": 5,
  "sl": "Drugo umetniško ustvarjanje",
  "en": "Other arts creation activities",
  "p": "S90.13"
 },
 {
  "c": "S90.2",
  "l": 3,
  "sl": "Uprizoritvene umetnosti",
  "en": "Activities of performing arts",
  "p": "S90"
 },
 {
  "c": "S90.20",
  "l": 4,
  "sl": "Uprizoritvene umetnosti",
  "en": "Activities of performing arts",
  "p": "S90.2"
 },
 {
  "c": "S90.200",
  "l": 5,
  "sl": "Uprizoritvene umetnosti",
  "en": "Activities of performing arts",
  "p": "S90.20"
 },
 {
  "c": "S90.3",
  "l": 3,
  "sl": "Pomožne dejavnosti za umetniško ustvarjanje in uprizoritvene umetnosti",
  "en": "Support activities to arts creation and performing arts",
  "p": "S90"
 },
 {
  "c": "S90.31",
  "l": 4,
  "sl": "Obratovanje objektov za kulturne prireditve",
  "en": "Operation of arts facilities and sites",
  "p": "S90.3"
 },
 {
  "c": "S90.310",
  "l": 5,
  "sl": "Obratovanje objektov za kulturne prireditve",
  "en": "Operation of arts facilities and sites",
  "p": "S90.31"
 },
 {
  "c": "S90.39",
  "l": 4,
  "sl": "Druge pomožne dejavnosti za umetniško ustvarjanje in uprizoritvene umetnosti",
  "en": "Other support activities to arts and performing arts",
  "p": "S90.3"
 },
 {
  "c": "S90.390",
  "l": 5,
  "sl": "Druge pomožne dejavnosti za umetniško ustvarjanje in uprizoritvene umetnosti",
  "en": "Other support activities to arts and performing arts",
  "p": "S90.39"
 },
 {
  "c": "S91",
  "l": 2,
  "sl": "Dejavnost knjižnic, arhivov, muzejev in druge kulturne dejavnosti",
  "en": "Libraries, archives, museums and other cultural activities",
  "p": "S"
 },
 {
  "c": "S91.1",
  "l": 3,
  "sl": "Dejavnost knjižnic in arhivov",
  "en": "Library and archive activities",
  "p": "S91"
 },
 {
  "c": "S91.11",
  "l": 4,
  "sl": "Dejavnost knjižnic",
  "en": "Library activities",
  "p": "S91.1"
 },
 {
  "c": "S91.110",
  "l": 5,
  "sl": "Dejavnost knjižnic",
  "en": "Library activities",
  "p": "S91.11"
 },
 {
  "c": "S91.12",
  "l": 4,
  "sl": "Dejavnost arhivov",
  "en": "Archive activities",
  "p": "S91.1"
 },
 {
  "c": "S91.120",
  "l": 5,
  "sl": "Dejavnost arhivov",
  "en": "Archive activities",
  "p": "S91.12"
 },
 {
  "c": "S91.2",
  "l": 3,
  "sl": "Dejavnost muzejev ter dejavnosti v zvezi z zbirkami, zgodovinskimi znamenitostmi in spomeniki",
  "en": "Museum, collection, historical site and monument activities",
  "p": "S91"
 },
 {
  "c": "S91.21",
  "l": 4,
  "sl": "Dejavnost muzejev in dejavnosti v zvezi z zbirkami",
  "en": "Museum and collection activities",
  "p": "S91.2"
 },
 {
  "c": "S91.210",
  "l": 5,
  "sl": "Dejavnost muzejev in dejavnosti v zvezi z zbirkami",
  "en": "Museum and collection activities",
  "p": "S91.21"
 },
 {
  "c": "S91.22",
  "l": 4,
  "sl": "Dejavnosti v zvezi z zgodovinskimi znamenitostmi in spomeniki",
  "en": "Historical site and monument activities",
  "p": "S91.2"
 },
 {
  "c": "S91.220",
  "l": 5,
  "sl": "Dejavnosti v zvezi z zgodovinskimi znamenitostmi in spomeniki",
  "en": "Historical site and monument activities",
  "p": "S91.22"
 },
 {
  "c": "S91.3",
  "l": 3,
  "sl": "Konservatorstvo, restavriranje in druge pomožne dejavnosti za ohranjanje kulturne dediščine",
  "en": "Conservation, restoration and other support activities for cultural heritage",
  "p": "S91"
 },
 {
  "c": "S91.30",
  "l": 4,
  "sl": "Konservatorstvo, restavriranje in druge pomožne dejavnosti za ohranjanje kulturne dediščine",
  "en": "Conservation, restoration and other support activities for cultural heritage",
  "p": "S91.3"
 },
 {
  "c": "S91.300",
  "l": 5,
  "sl": "Konservatorstvo, restavriranje in druge pomožne dejavnosti za ohranjanje kulturne dediščine",
  "en": "Conservation, restoration and other support activities for cultural heritage",
  "p": "S91.30"
 },
 {
  "c": "S91.4",
  "l": 3,
  "sl": "Dejavnost botaničnih in živalskih vrtov, varstvo naravnih vrednot",
  "en": "Botanical and zoological garden and nature reserve activities",
  "p": "S91"
 },
 {
  "c": "S91.41",
  "l": 4,
  "sl": "Dejavnost botaničnih in živalskih vrtov",
  "en": "Botanical and zoological garden activities",
  "p": "S91.4"
 },
 {
  "c": "S91.410",
  "l": 5,
  "sl": "Dejavnost botaničnih in živalskih vrtov",
  "en": "Botanical and zoological garden activities",
  "p": "S91.41"
 },
 {
  "c": "S91.42",
  "l": 4,
  "sl": "Varstvo naravnih vrednot",
  "en": "Nature reserve activities",
  "p": "S91.4"
 },
 {
  "c": "S91.420",
  "l": 5,
  "sl": "Varstvo naravnih vrednot",
  "en": "Nature reserve activities",
  "p": "S91.42"
 },
 {
  "c": "S92",
  "l": 2,
  "sl": "Prirejanje iger na srečo",
  "en": "Gambling and betting activities",
  "p": "S"
 },
 {
  "c": "S92.0",
  "l": 3,
  "sl": "Prirejanje iger na srečo",
  "en": "Gambling and betting activities",
  "p": "S92"
 },
 {
  "c": "S92.00",
  "l": 4,
  "sl": "Prirejanje iger na srečo",
  "en": "Gambling and betting activities",
  "p": "S92.0"
 },
 {
  "c": "S92.001",
  "l": 5,
  "sl": "Dejavnost igralnic",
  "en": "Activities of casinos",
  "p": "S92.00"
 },
 {
  "c": "S92.002",
  "l": 5,
  "sl": "Prirejanje iger na srečo, razen v igralnicah",
  "en": "Other gambling and betting activities",
  "p": "S92.00"
 },
 {
  "c": "S93",
  "l": 2,
  "sl": "Športne in druge dejavnosti za prosti čas",
  "en": "Sports activities and amusement and recreation activities",
  "p": "S"
 },
 {
  "c": "S93.1",
  "l": 3,
  "sl": "Športne dejavnosti",
  "en": "Sports activities",
  "p": "S93"
 },
 {
  "c": "S93.11",
  "l": 4,
  "sl": "Obratovanje športnih objektov",
  "en": "Operation of sports facilities",
  "p": "S93.1"
 },
 {
  "c": "S93.110",
  "l": 5,
  "sl": "Obratovanje športnih objektov",
  "en": "Operation of sports facilities",
  "p": "S93.11"
 },
 {
  "c": "S93.12",
  "l": 4,
  "sl": "Dejavnost športnih klubov",
  "en": "Activities of sports clubs",
  "p": "S93.1"
 },
 {
  "c": "S93.120",
  "l": 5,
  "sl": "Dejavnost športnih klubov",
  "en": "Activities of sports clubs",
  "p": "S93.12"
 },
 {
  "c": "S93.13",
  "l": 4,
  "sl": "Dejavnost fitnes centrov",
  "en": "Activities of fitness centres",
  "p": "S93.1"
 },
 {
  "c": "S93.130",
  "l": 5,
  "sl": "Dejavnost fitnes centrov",
  "en": "Activities of fitness centres",
  "p": "S93.13"
 },
 {
  "c": "S93.19",
  "l": 4,
  "sl": "Športne dejavnosti, d. n.",
  "en": "Sports activities n.e.c.",
  "p": "S93.1"
 },
 {
  "c": "S93.190",
  "l": 5,
  "sl": "Športne dejavnosti, d. n.",
  "en": "Sports activities n.e.c.",
  "p": "S93.19"
 },
 {
  "c": "S93.2",
  "l": 3,
  "sl": "Druge dejavnosti za prosti čas",
  "en": "Amusement and recreation activities",
  "p": "S93"
 },
 {
  "c": "S93.21",
  "l": 4,
  "sl": "Dejavnosti zabaviščnih parkov",
  "en": "Activities of amusement parks and theme parks",
  "p": "S93.2"
 },
 {
  "c": "S93.210",
  "l": 5,
  "sl": "Dejavnosti zabaviščnih parkov",
  "en": "Activities of amusement parks and theme parks",
  "p": "S93.21"
 },
 {
  "c": "S93.29",
  "l": 4,
  "sl": "Dejavnosti za prosti čas, d. n.",
  "en": "Amusement and recreation activities n.e.c.",
  "p": "S93.2"
 },
 {
  "c": "S93.291",
  "l": 5,
  "sl": "Dejavnost marin",
  "en": "Operation of marinas",
  "p": "S93.29"
 },
 {
  "c": "S93.299",
  "l": 5,
  "sl": "Drugje nerazvrščene dejavnosti za prosti čas",
  "en": "Other amusement and recreation activities n.e.c.",
  "p": "S93.29"
 },
 {
  "c": "T",
  "l": 1,
  "sl": "DRUGE DEJAVNOSTI",
  "en": "OTHER SERVICE ACTIVITIES",
  "p": null
 },
 {
  "c": "T94",
  "l": 2,
  "sl": "Dejavnost članskih organizacij",
  "en": "Activities of membership organisations",
  "p": "T"
 },
 {
  "c": "T94.1",
  "l": 3,
  "sl": "Dejavnost poslovnih, delodajalskih in strokovnih združenj",
  "en": "Activities of business, employers and professional membership organisations",
  "p": "T94"
 },
 {
  "c": "T94.11",
  "l": 4,
  "sl": "Dejavnost poslovnih in delodajalskih združenj",
  "en": "Activities of business and employers membership organisations",
  "p": "T94.1"
 },
 {
  "c": "T94.110",
  "l": 5,
  "sl": "Dejavnost poslovnih in delodajalskih združenj",
  "en": "Activities of business and employers membership organisations",
  "p": "T94.11"
 },
 {
  "c": "T94.12",
  "l": 4,
  "sl": "Dejavnost strokovnih združenj",
  "en": "Activities of professional membership organisations",
  "p": "T94.1"
 },
 {
  "c": "T94.120",
  "l": 5,
  "sl": "Dejavnost strokovnih združenj",
  "en": "Activities of professional membership organisations",
  "p": "T94.12"
 },
 {
  "c": "T94.2",
  "l": 3,
  "sl": "Dejavnost sindikatov",
  "en": "Activities of trade unions",
  "p": "T94"
 },
 {
  "c": "T94.20",
  "l": 4,
  "sl": "Dejavnost sindikatov",
  "en": "Activities of trade unions",
  "p": "T94.2"
 },
 {
  "c": "T94.200",
  "l": 5,
  "sl": "Dejavnost sindikatov",
  "en": "Activities of trade unions",
  "p": "T94.20"
 },
 {
  "c": "T94.9",
  "l": 3,
  "sl": "Dejavnost drugih članskih organizacij",
  "en": "Activities of other membership organisations",
  "p": "T94"
 },
 {
  "c": "T94.91",
  "l": 4,
  "sl": "Dejavnost verskih organizacij",
  "en": "Activities of religious organisations",
  "p": "T94.9"
 },
 {
  "c": "T94.910",
  "l": 5,
  "sl": "Dejavnost verskih organizacij",
  "en": "Activities of religious organisations",
  "p": "T94.91"
 },
 {
  "c": "T94.92",
  "l": 4,
  "sl": "Dejavnost političnih organizacij",
  "en": "Activities of political organisations",
  "p": "T94.9"
 },
 {
  "c": "T94.920",
  "l": 5,
  "sl": "Dejavnost političnih organizacij",
  "en": "Activities of political organisations",
  "p": "T94.92"
 },
 {
  "c": "T94.99",
  "l": 4,
  "sl": "Dejavnost drugih članskih organizacij, d. n.",
  "en": "Activities of other membership organisations n.e.c.",
  "p": "T94.9"
 },
 {
  "c": "T94.991",
  "l": 5,
  "sl": "Dejavnost invalidskih organizacij",
  "en": "Activity of membership organisations for disabled persons",
  "p": "T94.99"
 },
 {
  "c": "T94.999",
  "l": 5,
  "sl": "Dejavnost drugje nerazvrščenih članskih organizacij",
  "en": "Activities of other membership organisations n.e.c.",
  "p": "T94.99"
 },
 {
  "c": "T95",
  "l": 2,
  "sl": "Popravila in vzdrževanje računalnikov, izdelkov za široko rabo, motornih vozil in motornih koles",
  "en": "Repair and maintenance of computers, personal and household goods, and motor vehicles and motorcycles",
  "p": "T"
 },
 {
  "c": "T95.1",
  "l": 3,
  "sl": "Popravila in vzdrževanje računalnikov in komunikacijskih naprav",
  "en": "Repair and maintenance of computers and communication equipment",
  "p": "T95"
 },
 {
  "c": "T95.10",
  "l": 4,
  "sl": "Popravila in vzdrževanje računalnikov in komunikacijskih naprav",
  "en": "Repair and maintenance of computers and communication equipment",
  "p": "T95.1"
 },
 {
  "c": "T95.100",
  "l": 5,
  "sl": "Popravila in vzdrževanje računalnikov in komunikacijskih naprav",
  "en": "Repair and maintenance of computers and communication equipment",
  "p": "T95.10"
 },
 {
  "c": "T95.2",
  "l": 3,
  "sl": "Popravila in vzdrževanje izdelkov za široko rabo",
  "en": "Repair and maintenance of personal and household goods",
  "p": "T95"
 },
 {
  "c": "T95.21",
  "l": 4,
  "sl": "Popravila in vzdrževanje elektronskih naprav za široko rabo",
  "en": "Repair and maintenance of consumer electronics",
  "p": "T95.2"
 },
 {
  "c": "T95.210",
  "l": 5,
  "sl": "Popravila in vzdrževanje elektronskih naprav za široko rabo",
  "en": "Repair and maintenance of consumer electronics",
  "p": "T95.21"
 },
 {
  "c": "T95.22",
  "l": 4,
  "sl": "Popravila in vzdrževanje gospodinjskih naprav ter opreme za dom in vrt",
  "en": "Repair and maintenance of household appliances and home and garden equipment",
  "p": "T95.2"
 },
 {
  "c": "T95.220",
  "l": 5,
  "sl": "Popravila in vzdrževanje gospodinjskih naprav ter opreme za dom in vrt",
  "en": "Repair and maintenance of household appliances and home and garden equipment",
  "p": "T95.22"
 },
 {
  "c": "T95.23",
  "l": 4,
  "sl": "Popravila in vzdrževanje obutve in usnjene galanterije",
  "en": "Repair and maintenance of footwear and leather goods",
  "p": "T95.2"
 },
 {
  "c": "T95.230",
  "l": 5,
  "sl": "Popravila in vzdrževanje obutve in usnjene galanterije",
  "en": "Repair and maintenance of footwear and leather goods",
  "p": "T95.23"
 },
 {
  "c": "T95.24",
  "l": 4,
  "sl": "Popravila in vzdrževanje pohištva",
  "en": "Repair and maintenance of furniture and home furnishings",
  "p": "T95.2"
 },
 {
  "c": "T95.240",
  "l": 5,
  "sl": "Popravila in vzdrževanje pohištva",
  "en": "Repair and maintenance of furniture and home furnishings",
  "p": "T95.24"
 },
 {
  "c": "T95.25",
  "l": 4,
  "sl": "Popravila in vzdrževanje ur in nakita",
  "en": "Repair and maintenance of watches, clocks and jewellery",
  "p": "T95.2"
 },
 {
  "c": "T95.250",
  "l": 5,
  "sl": "Popravila in vzdrževanje ur in nakita",
  "en": "Repair and maintenance of watches, clocks and jewellery",
  "p": "T95.25"
 },
 {
  "c": "T95.29",
  "l": 4,
  "sl": "Popravila in vzdrževanje izdelkov za široko rabo, d. n.",
  "en": "Repair and maintenance of personal and household goods n.e.c.",
  "p": "T95.2"
 },
 {
  "c": "T95.290",
  "l": 5,
  "sl": "Popravila in vzdrževanje izdelkov za široko rabo, d. n.",
  "en": "Repair and maintenance of personal and household goods n.e.c.",
  "p": "T95.29"
 },
 {
  "c": "T95.3",
  "l": 3,
  "sl": "Popravila in vzdrževanje motornih vozil in motornih koles",
  "en": "Repair and maintenance of motor vehicles and motorcycles",
  "p": "T95"
 },
 {
  "c": "T95.31",
  "l": 4,
  "sl": "Popravila in vzdrževanje motornih vozil",
  "en": "Repair and maintenance of motor vehicles",
  "p": "T95.3"
 },
 {
  "c": "T95.310",
  "l": 5,
  "sl": "Popravila in vzdrževanje motornih vozil",
  "en": "Repair and maintenance of motor vehicles",
  "p": "T95.31"
 },
 {
  "c": "T95.32",
  "l": 4,
  "sl": "Popravila in vzdrževanje motornih koles",
  "en": "Repair and maintenance of motorcycles",
  "p": "T95.3"
 },
 {
  "c": "T95.320",
  "l": 5,
  "sl": "Popravila in vzdrževanje motornih koles",
  "en": "Repair and maintenance of motorcycles",
  "p": "T95.32"
 },
 {
  "c": "T95.4",
  "l": 3,
  "sl": "Posredništvo pri popravilu in vzdrževanju računalnikov, izdelkov za široko rabo, motornih vozil in motornih koles",
  "en": "Intermediation service activities for repair and maintenance of computers, personal and household goods, and motor vehicles and motorcycles",
  "p": "T95"
 },
 {
  "c": "T95.40",
  "l": 4,
  "sl": "Posredništvo pri popravilu in vzdrževanju računalnikov, izdelkov za široko rabo, motornih vozil in motornih koles",
  "en": "Intermediation service activities for repair and maintenance of computers, personal and household goods, and motor vehicles and motorcycles",
  "p": "T95.4"
 },
 {
  "c": "T95.400",
  "l": 5,
  "sl": "Posredništvo pri popravilu in vzdrževanju računalnikov, izdelkov za široko rabo, motornih vozil in motornih koles",
  "en": "Intermediation service activities for repair and maintenance of computers, personal and household goods, and motor vehicles and motorcycles",
  "p": "T95.40"
 },
 {
  "c": "T96",
  "l": 2,
  "sl": "Osebne storitve",
  "en": "Personal service activities",
  "p": "T"
 },
 {
  "c": "T96.1",
  "l": 3,
  "sl": "Dejavnost pralnic in kemičnih čistilnic",
  "en": "Washing and cleaning of textile and fur products",
  "p": "T96"
 },
 {
  "c": "T96.10",
  "l": 4,
  "sl": "Dejavnost pralnic in kemičnih čistilnic",
  "en": "Washing and cleaning of textile and fur products",
  "p": "T96.1"
 },
 {
  "c": "T96.100",
  "l": 5,
  "sl": "Dejavnost pralnic in kemičnih čistilnic",
  "en": "Washing and cleaning of textile and fur products",
  "p": "T96.10"
 },
 {
  "c": "T96.2",
  "l": 3,
  "sl": "Frizerska, kozmetična, pedikerska in zdraviliška dejavnost ter podobne dejavnosti",
  "en": "Hairdressing, beauty treatment, day spa and similar activities",
  "p": "T96"
 },
 {
  "c": "T96.21",
  "l": 4,
  "sl": "Frizerska in brivska dejavnost",
  "en": "Hairdressing and barber activities",
  "p": "T96.2"
 },
 {
  "c": "T96.210",
  "l": 5,
  "sl": "Frizerska in brivska dejavnost",
  "en": "Hairdressing and barber activities",
  "p": "T96.21"
 },
 {
  "c": "T96.22",
  "l": 4,
  "sl": "Kozmetična in pedikerska dejavnost",
  "en": "Beauty care and other beauty treatment activities",
  "p": "T96.2"
 },
 {
  "c": "T96.220",
  "l": 5,
  "sl": "Kozmetična in pedikerska dejavnost",
  "en": "Beauty care and other beauty treatment activities",
  "p": "T96.22"
 },
 {
  "c": "T96.23",
  "l": 4,
  "sl": "Zdraviliška dejavnost, savne in parne kopeli",
  "en": "Day spa, sauna and steam bath activities",
  "p": "T96.2"
 },
 {
  "c": "T96.230",
  "l": 5,
  "sl": "Zdraviliška dejavnost, savne in parne kopeli",
  "en": "Day spa, sauna and steam bath activities",
  "p": "T96.23"
 },
 {
  "c": "T96.3",
  "l": 3,
  "sl": "Pogrebna dejavnost",
  "en": "Funeral and related activities",
  "p": "T96"
 },
 {
  "c": "T96.30",
  "l": 4,
  "sl": "Pogrebna dejavnost",
  "en": "Funeral and related activities",
  "p": "T96.3"
 },
 {
  "c": "T96.300",
  "l": 5,
  "sl": "Pogrebna dejavnost",
  "en": "Funeral and related activities",
  "p": "T96.30"
 },
 {
  "c": "T96.4",
  "l": 3,
  "sl": "Posredniške dejavnosti za osebne storitve",
  "en": "Intermediation service activities for personal services",
  "p": "T96"
 },
 {
  "c": "T96.40",
  "l": 4,
  "sl": "Posredniške dejavnosti za osebne storitve",
  "en": "Intermediation service activities for personal services",
  "p": "T96.4"
 },
 {
  "c": "T96.400",
  "l": 5,
  "sl": "Posredniške dejavnosti za osebne storitve",
  "en": "Intermediation service activities for personal services",
  "p": "T96.40"
 },
 {
  "c": "T96.9",
  "l": 3,
  "sl": "Druge osebne storitve",
  "en": "Other personal service activities",
  "p": "T96"
 },
 {
  "c": "T96.91",
  "l": 4,
  "sl": "Osebne storitve na domu",
  "en": "Provision of domestic personal service activities",
  "p": "T96.9"
 },
 {
  "c": "T96.910",
  "l": 5,
  "sl": "Osebne storitve na domu",
  "en": "Provision of domestic personal service activities",
  "p": "T96.91"
 },
 {
  "c": "T96.99",
  "l": 4,
  "sl": "Druge osebne storitve, d. n.",
  "en": "Other personal service activities n.e.c.",
  "p": "T96.9"
 },
 {
  "c": "T96.991",
  "l": 5,
  "sl": "Tetoviranje in pirsing",
  "en": "Tattooing and piercing",
  "p": "T96.99"
 },
 {
  "c": "T96.999",
  "l": 5,
  "sl": "Druge drugje nerazvrščene osebne storitve",
  "en": "Other personal service activities n.e.c",
  "p": "T96.99"
 },
 {
  "c": "U",
  "l": 1,
  "sl": "DEJAVNOST GOSPODINJSTEV Z ZAPOSLENIM HIŠNIM OSEBJEM TER PROIZVODNJA ZA LASTNO RABO",
  "en": "ACTIVITIES OF HOUSEHOLDS AS EMPLOYERS AND UNDIFFERENTIATED GOODS- AND SERVICE-PRODUCING ACTIVITIES OF HOUSEHOLDS FOR OWN USE",
  "p": null
 },
 {
  "c": "U97",
  "l": 2,
  "sl": "Dejavnost gospodinjstev z zaposlenim hišnim osebjem",
  "en": "Activities of households as employers of domestic personnel",
  "p": "U"
 },
 {
  "c": "U97.0",
  "l": 3,
  "sl": "Dejavnost gospodinjstev z zaposlenim hišnim osebjem",
  "en": "Activities of households as employers of domestic personnel",
  "p": "U97"
 },
 {
  "c": "U97.00",
  "l": 4,
  "sl": "Dejavnost gospodinjstev z zaposlenim hišnim osebjem",
  "en": "Activities of households as employers of domestic personnel",
  "p": "U97.0"
 },
 {
  "c": "U97.000",
  "l": 5,
  "sl": "Dejavnost gospodinjstev z zaposlenim hišnim osebjem",
  "en": "Activities of households as employers of domestic personnel",
  "p": "U97.00"
 },
 {
  "c": "U98",
  "l": 2,
  "sl": "Raznovrstna proizvodnja gospodinjstev za lastno rabo",
  "en": "Undifferentiated goods- and service-producing activities of private households for own use",
  "p": "U"
 },
 {
  "c": "U98.1",
  "l": 3,
  "sl": "Raznovrstna proizvodnja dobrin v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated goods-producing activities of private households for own use",
  "p": "U98"
 },
 {
  "c": "U98.10",
  "l": 4,
  "sl": "Raznovrstna proizvodnja dobrin v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated goods-producing activities of private households for own use",
  "p": "U98.1"
 },
 {
  "c": "U98.100",
  "l": 5,
  "sl": "Raznovrstna proizvodnja dobrin v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated goods-producing activities of private households for own use",
  "p": "U98.10"
 },
 {
  "c": "U98.2",
  "l": 3,
  "sl": "Raznovrstna proizvodnja storitev v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated service-producing activities of private households for own use",
  "p": "U98"
 },
 {
  "c": "U98.20",
  "l": 4,
  "sl": "Raznovrstna proizvodnja storitev v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated service-producing activities of private households for own use",
  "p": "U98.2"
 },
 {
  "c": "U98.200",
  "l": 5,
  "sl": "Raznovrstna proizvodnja storitev v gospodinjstvih za lastno rabo",
  "en": "Undifferentiated service-producing activities of private households for own use",
  "p": "U98.20"
 },
 {
  "c": "V",
  "l": 1,
  "sl": "DEJAVNOST EKSTERITORIALNIH ORGANIZACIJ IN TELES",
  "en": "ACTIVITIES OF EXTRATERRITORIAL ORGANISATIONS AND BODIES",
  "p": null
 },
 {
  "c": "V99",
  "l": 2,
  "sl": "Dejavnost eksteritorialnih organizacij in teles",
  "en": "Activities of extraterritorial organisations and bodies",
  "p": "V"
 },
 {
  "c": "V99.0",
  "l": 3,
  "sl": "Dejavnost eksteritorialnih organizacij in teles",
  "en": "Activities of extraterritorial organisations and bodies",
  "p": "V99"
 },
 {
  "c": "V99.00",
  "l": 4,
  "sl": "Dejavnost eksteritorialnih organizacij in teles",
  "en": "Activities of extraterritorial organisations and bodies",
  "p": "V99.0"
 },
 {
  "c": "V99.000",
  "l": 5,
  "sl": "Dejavnost eksteritorialnih organizacij in teles",
  "en": "Activities of extraterritorial organisations and bodies",
  "p": "V99.00"
 }
]

const byCode = new Map<string, SkdRecord>(SKD_RECORDS.map((r) => [r.c, r]))
export const skdByCode = (code: string): SkdRecord | undefined => byCode.get(code)
export const SKD_TRUSTED = true

/** Fast level lists (each is a stable array of records). */
export const SKD_BY_LEVEL: Record<1|2|3|4|5, SkdRecord[]> = {
  1: SKD_RECORDS.filter((r) => r.l === 1),
  2: SKD_RECORDS.filter((r) => r.l === 2),
  3: SKD_RECORDS.filter((r) => r.l === 3),
  4: SKD_RECORDS.filter((r) => r.l === 4),
  5: SKD_RECORDS.filter((r) => r.l === 5),
}
