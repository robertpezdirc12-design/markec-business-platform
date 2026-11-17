/**
 * P1 #107 — ČLOVEŠKA ŠTEVILKA NAROČILA.
 *
 * ID naročila je CUID (`cmwkwohy8000ewg0gdedi7ddk`) — za stranko in za
 * telefonski pogovor neuporaben. Potrditev naročila je že od začetka
 * prikazovala `id.slice(-8).toUpperCase()` ("DEDI7DDK"), seznami
 * (Moja naročila, Spletna naročila) pa surov CUID oz. `id.slice(0, 8)`.
 * Ta pomožnik je EDINI vir — vsi zasloni kažejo isto številko.
 *
 * Ni novo polje v bazi: številka je deterministična iz ID-ja, zato je
 * stabilna, unikatna v praksi in brez migracije.
 */
export function shortOrderNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}
