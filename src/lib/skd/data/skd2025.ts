// ============================================================
// OFFICIAL SKD 2025 classification — generated file.
// Classification: SKD_2025 V1 (SURS KLASJE, Standardna klasifikacija dejavnosti 2025, V1 (Uradni list RS št. 27/2024)).
// Records: 1725 (22 sections / 87 divisions / 287 groups /
//           651 classes / 678 subclasses).
//
// DO NOT EDIT BY HAND — regenerate with:
//   node scripts/f50-generate-skd-module.mjs
// ============================================================

import skdRecordsJson from "./skd2025.json"

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
export const SKD_RECORDS: SkdRecord[] = skdRecordsJson as unknown as SkdRecord[]

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
