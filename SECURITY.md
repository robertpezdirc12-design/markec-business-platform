# Varnostna politika / Security Policy

## Podprte različice

Aktivno vzdrževana je trenutna produkcijska različica veje `main` ter namestitve, ki jih upravlja lastnik projekta. Za starejše veje/forke varnostnih popravkov ne zagotavljamo.

## Prijava ranljivosti

**Ne prijavljaj varnostnih ranljivosti prek javnih GitHub issue-jev ali pull requestov.**

Če odkriješ potencialno ranljivost:

1. Zberi čim več koristnih informacij (opis, prizadeti del, koraki za reprodukcijo, vpliv, morebitna omilitev).
2. Po možnosti priloži dokaz koncepta, ki ne ogroža produkcijskih podatkov ali drugih uporabnikov.
3. Prijavo posreduj neposredno vzdrževalcem/lastniku repozitorija prek zasebnega kanala (npr. GitHub stik z lastnikom računa ali drug dogovorjen privaten kontakt).

Če zaseben kanal ni na voljo, odpri minimalen issue brez tehničnih podrobnosti zlorabe in zaprosi za varen kontaktni kanal.

## Kaj vključiti v prijavo

- Povzetek težave in ocenjen vpliv
- Prizadeti URL/modul/funkcionalnost
- Predpogoji in koraki za reprodukcijo
- Uporabljene različice/okolje (če je relevantno)
- Predlog omilitve (neobvezno)

## Pričakovanja

- Prizadevamo si za hiter pregled in razumen odziv glede na resnost.
- Prosimo za odgovorno razkritje in razumen čas za odpravo težave pred javno objavo.
- Ne izvajaj testov, ki bi lahko poškodovali podatke, motili storitev ali kršili zasebnost uporabnikov.

## Opombe

- V repozitorij ne dodajaj skrivnosti, žetonov ali produkcijskih poverilnic.
- Za konfiguracijo skrivnosti in okolij glej [`.env.example`](.env.example) ter operativno dokumentacijo v [`docs/`](docs/).
