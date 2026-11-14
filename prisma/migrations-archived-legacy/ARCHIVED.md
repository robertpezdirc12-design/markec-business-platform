# Archived legacy migration history — MARKEC

These **42** migrations form the ORIGINAL MARKEC migration chain (2025-10 → 2026-12).
They are archived **outside the active map** (`prisma/migrations/`) on purpose:

- a fresh install must **not** run them — the original chain was a `db push` backfill
  (`20251030000000` ALTERs `Appointment`/`User` before `init`, and `Organization`
  has no `CREATE TABLE` until `20261129_p100_f1`), so it cannot build a schema from scratch;
- Prisma's `migrate deploy` reads **only** `prisma/migrations/`, which now holds the
  single `00000000000000_baseline` (the fully-resolvable current schema).

Everything here is preserved **byte-identical** and is **not** modified, renumbered
or deleted. It serves purely as the historical/audit reference.

**Total: 42 migrations = 30 from git HEAD + 12 later F5.x migrations.**

---

## A. 30 migrations from git HEAD (tracked at `prisma/migrations/` in HEAD)

| # | Directory | Purpose |
|---|-----------|---------|
| 1 | `20251030000000_add_user_reset_token_and_prefs` | User `resetToken`/expiry + `NotificationPreferences` |
| 2 | `20251031000000_e3_3_backfill_existing_tenants_to_scale` | Backfill existing tenants → SCALE plan |
| 3 | `20251116063324_init` | Original full schema (Account/Session/User/Service/Staff/Appointment/Product/Order/…) |
| 4 | `20251123050550_update_order_status_remove_shipping` | Order status change (+ shipping cleanup) |
| 5 | `20251124000000_e3_4_platform_subscription` | Platform subscriptions (billing) |
| 6 | `20251126000000_e3_5_platform_audit_log` | Platform audit log |
| 7 | `20251127000000_e3_6_custom_domains` | Custom domains (EPIC #3 E3-6) |
| 8 | `20251128000000_e2_2_stock_movements` | Stock movement ledger |
| 9 | `20251129000000_e2_3_projects_tasks` | Projects & tasks |
| 10 | `20251130000000_e2_4_secondary_vertical` | Organization `secondaryVertical` |
| 11 | `20251201000000_e2_5_config_change_log` | Config change log |
| 12 | `20251201090000_e2_7_appointment_resources` | Appointment resources |
| 13 | `20251202000000_e4_2b_salon_config_analytics_measurement_id` | SalonConfig analytics measurement id |
| 14 | `20251203000000_e4_3_platform_webhook_failures` | Platform webhook failures |
| 15 | `20261102000000_g8_custom_roles` | Custom roles (permission sets) |
| 16 | `20261103000000_guided_entry_vertical_chosen_at` | Organization `verticalChosenAt` |
| 17 | `20261104000000_setup_checklist` | Organization setup checklist |
| 18 | `20261105000000_onboarding_answers` | Organization onboarding answers |
| 19 | `20261126000000_p59_preset_seed_provenance` | Preset seed provenance |
| 20 | `20261127000000_p69_p65_asset_provenance_offline_orders` | Asset provenance + offline orders |
| 21 | `20261128000000_p77_product_sku_per_tenant` | Product SKU per tenant |
| 22 | `20261128010000_p76_job_run` | Job run |
| 23 | `20261128020000_p75_reviews_organization` | Reviews org-scoping |
| 24 | `20261129000000_p78_product_retail_layer` | Product retail layer |
| 25 | `20261129010000_p79_deposit_rules_tips_commissions` | Deposit rules, tips, commissions |
| 26 | `20261129020000_p80_prepaid_value` | Prepaid value (gift cards/packages/memberships) |
| 27 | `20261129030000_p100_8a_8c_org_members_module_states` | Org members + module states |
| 28 | `20261129040000_p100_f1_sync_enum_types` | Enum type sync |
| 29 | `20261129050000_p100_f1_full_schema_sync` | Full schema sync (de-facto earlier baseline) |
| 30 | `20261130000000_p100_demo_front_neutralize` | Demo front neutralization |

## B. 12 later F5.x migrations (NOT in git HEAD at `prisma/migrations/`; added by the F5 module phases)

| # | Directory | Purpose / phase |
|---|-----------|-----------------|
| 31 | `20261109000000_f231_staff_multi_org` | F2.3.1 — Staff multi-org (`@@unique([userId, organizationId])`) |
| 32 | `20261130010000_f22_organization_invitations` | F2.2 — `OrganizationInvitation` table |
| 33 | `20261201000000_f5_1_promotions` | F5.1 — `Promotion` + `PromotionRedemption` + Order/Appointment discount snapshots |
| 34 | `20261202000000_f5_1_2_promotion_reservation` | F5.1.2 — RESERVED/REDEEMED redemption state + heldUntil/checkoutSessionId |
| 35 | `20261203000000_f5_2_categories` | F5.2 — Category hierarchy (`parentId`/`description`/`image`/`sortOrder`/`isActive`/`categoryType`) |
| 36 | `20261204000000_f551_variant_order_item` | F5.5.1 — OrderItem variant reference + snapshots |
| 37 | `20261205000000_f5512_inventory_reservation` | F5.5.1.2 — Product/Variant `reservedQuantity` |
| 38 | `20261206000000_f552_galleries_faq` | F5.5.2 — `Gallery`, `GalleryItem`, `FaqItem` |
| 39 | `20261207000000_f553_customers` | F5.5.3 — Customer `isArchived`/`archivedAt` + WalkInEntry.customerId |
| 40 | `20261208000000_f554_document_immutability` | F5.5.4.1 — Document snapshots/vat/sequences ± uniqueness |
| 41 | `20261209000000_f5542_payments_creditnotes` | F5.5.4.2 — DocumentPayment (partial unique index), CreditNote, DocumentEvent |
| 42 | `20261210000000_f5543_pdf_email_archive` | F5.5.4.3 — DocumentArchive, DocumentSendLog |

> **Note on the earlier "41/42" discrepancy:** the archived directory set contains **exactly 42**
> migrations. An earlier prose table listed only 41 rows because it collapsed one of the 12 HEAD
> `p*` migrations into a shared row. The authoritative inventory is the directory list + this file;
> `manifest-migrations.mjs` reports **42 total = 30 HEAD + 12 F5.x**.

---

## C. SHA-256 manifest (each `migration.sql`)

```
20251030000000_add_user_reset_token_and_prefs  9661abd83a8efd7f603cab4b2127deb202912293c6c794848e33bff2ceea73bd
20251031000000_e3_3_backfill_existing_tenants_to_scale  66790013df41a2eca645b2aa3254263743a4307790987c19b03e3c048b75ef16
20251116063324_init  b62546fbb3da68cf81434573e604cb067b119ec9be4611b7cf060b3444c54918
20251123050550_update_order_status_remove_shipping  bab35c22aa7bc2603f66f760b14a8e43888593fe17c48382bb5943930370c050
20251124000000_e3_4_platform_subscription  7891340c9ec76ddfd1dbd228073537d8a7828c17e4be79a74965b5c513eb0047
20251126000000_e3_5_platform_audit_log  67e26c5324c63e5789220ff8832e523226c8635e813e45eed299fb90144e55fe
20251127000000_e3_6_custom_domains  86eb33be65298ed9b588a5a698ce20b81a20f0302aba052e35c183f47f0d2f7e
20251128000000_e2_2_stock_movements  e7b5705949328548f064d1d0af160efdfa50a49d4dce95fd374348d5e1c2dc78
20251129000000_e2_3_projects_tasks  c0d5763330d092d6c2c35fb6d65662f1ad17eabe02e646bba670cb4fc7a7b227
20251130000000_e2_4_secondary_vertical  2b337c410746abe13146fb82779c689d7b445e5ab84b562b424879dd60b23611
20251201000000_e2_5_config_change_log  eca519a4ff4b9e18df7918151772147925de4e958abc0dabd73deeb7c6941df7
20251201090000_e2_7_appointment_resources  d5dfd95a1ee1cf8e4426a1dc74d687f9b061c6fd14d05f85fcf612dfa6f83569
20251202000000_e4_2b_salon_config_analytics_measurement_id  3c3e28f0051c452d6cbf060894e21bca2f972fb2fefc48e59d35fefe57ca0b22
20251203000000_e4_3_platform_webhook_failures  24ac35ba33281afb156ea5108fdd3a434c063bcef8decec65e971d57ea5546d9
20261102000000_g8_custom_roles  ad2bf1fa224418e1aa9f94986b058876e62804cd29c1a1a1030eaa5808cd3808
20261103000000_guided_entry_vertical_chosen_at  83af85df4c6ca60566b18472a2a40e3af27fd82c3a5f6dac449c3181e8e29f09
20261104000000_setup_checklist  bf7e7ada8693ff3053de7e6241e5f204a9076e2e09dc4e40db2fa985a528f246
20261105000000_onboarding_answers  c56a0c180ded767443e19b10eca06720b78ad61d25dcff99c8bc4ebcbc17401e
20261109000000_f231_staff_multi_org  bf7043d3dbc3657d6111935d466061fb6e94ce9def281f81738ecaed9ce4f946
20261126000000_p59_preset_seed_provenance  94920b24e737fa9ba26dcc8651f83bf8ad68aa60ce9b3786a61c059e50d6db72
20261127000000_p69_p65_asset_provenance_offline_orders  28043e866fbd6bbf99ecbcb2fcf22c2c39d0cdd5d62287cc84fbf4fd34255ba3
20261128000000_p77_product_sku_per_tenant  9827ffd4e05d5bcf01ca99ce80244c12709acb78fe7d0640494512a09f436d62
20261128010000_p76_job_run  a9c0b28e505fe1912e1fa6f5f5e7be16339a8a7b0c25a54c693fdcf7321d4ce0
20261128020000_p75_reviews_organization  ed4271af6bfa4aae04701b721c4f74f9f9d03b1ab5dbf0822e8ef6ad7245ec72
20261129000000_p78_product_retail_layer  37c64fada44d9be6dc1be4377ffcdc79767f66acf45c8c1bfb6eeddd50a6831e
20261129010000_p79_deposit_rules_tips_commissions  3140f385a6476c90cf0adcb4f3bd681533dbf26a68aa6cfed9e92a2b9e58d02e
20261129020000_p80_prepaid_value  74808a013654e7aed78f66d26c30be5f8707eab2258841c63f6e3d66281f0e23
20261129030000_p100_8a_8c_org_members_module_states  50f60d437ad6d235c3284185f074cead44f356225b9052653a55242f58a31457
20261129040000_p100_f1_sync_enum_types  e8568558f10bea0a852ebb25552b3250ce8258020a72143ffd1649a707726f33
20261129050000_p100_f1_full_schema_sync  7e59eddef30c6c5bcf66e38eaa04a05ebfbb9d3ee507249142c2f413629e4787
20261130000000_p100_demo_front_neutralize  38950178cf97f4917db1232998de70e26f72699277e5c5021997186df4e66611
20261130010000_f22_organization_invitations  ad2c071fbe70ab2706e16d32abb703568bc09489fa050fdc2eb47180cef4b1a1
20261201000000_f5_1_promotions  996670ff30e6f3bc6b8f982675e99677ac29161cdb763dddaaea6836cb82ecd0
20261202000000_f5_1_2_promotion_reservation  3baf794f14c9dba2e2011006d9d5774492aded53293b066ae583e58c7918c279
20261203000000_f5_2_categories  76bfa377c4c9af9ff8e22ea1c379ddaf831ca8d10e2d3c21d17a0234a5e0e9b2
20261204000000_f551_variant_order_item  bf81d2e3b5b8515b1817d2c1a024aabdd0db58d3cab0de41e271ad7b6176b791
20261205000000_f5512_inventory_reservation  0512013fa0f1bccd55505913ebf4171185d29a2c5f8fe6f05aa2929a3e95cf46
20261206000000_f552_galleries_faq  9c939167041ff8fc7e148decee07f5f23c8c28be2e1a876cff361951b5b84cb2
20261207000000_f553_customers  0805047744a45a83767d4961283b82e9120e9c4510df14108cd73fbbf4286d25
20261208000000_f554_document_immutability  dc62fb25c0b690c39338948f82d77c7203cfa7a81c3c5698a42d77b5257ecdfc
20261209000000_f5542_payments_creditnotes  32888ad9a53bbab5c89930425d6a23ac0f3805c680ecee043f1742cf6ba9d071
20261210000000_f5543_pdf_email_archive  85375e1cc36ca8c36826e03f909f9a6066acd57ccb51f6e210d7a176b9c87a55
```

## D. Coverage by the new baseline

The active baseline `prisma/migrations/00000000000000_baseline/migration.sql` is generated from the
**current full `schema.prisma`** (via `prisma migrate diff --from-empty --to-schema-datamodel`) plus an
explicit SQL for the partial unique index `DocumentPayment_org_doc_ref_key`
(`... WHERE "reference" IS NOT NULL`), which Prisma 6.19 cannot model. As a result:

- **All 30 HEAD migrations' net schema effects** are expressed in the baseline.
- **All 12 F5.x migrations' net schema effects** are ALSO expressed in the baseline
  (their schema changes are already present in `schema.prisma`, hence in the baseline).
- Therefore the 42 archived migrations are **not** needed by a fresh install and are never
  run; they remain purely as the historical/audit chain.

## E. Future migrations

New migrations belong in **`prisma/migrations/` AFTER `00000000000000_baseline`** — created with
`prisma migrate dev --name "<opis>"` (which edits `schema.prisma` and the migration together), and
applied with `prisma migrate deploy`. **Never** modify `00000000000000_baseline` or anything in this
archive (doing so triggers a Prisma checksum drift).