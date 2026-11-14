-- ============================================================
-- F2.3.1 — BACKFILL PRE-CHECK (run on the database BEFORE applying
-- the migration). Cilj: poročilo o nerešenih Staff zapisih.
--
-- Zahtevana politika določanja org (F2.3.1 §2):
--   1. obstoječi veljavni Staff.organizationId ima prednost;
--   2. drugi viri samo, če NEDVOMNO potrjujejo org
--      (OrganizationMember role=STAFF za isto org, ali skladni
--      zapisi Appointment/StaffService/WorkingHours z org);
--   3. User.organizationId SAM ni dovolj (zadnji uporabljeni workspace);
--   4. pri dvoumnih podatkih se migracija USTAVI in poroča.
-- Nič se ne pripisuje org na podlagi ugibanja.
--
-- Izvedba: psql -f scripts/f23-backfill-check.sql <db>
-- ============================================================

\echo '=== 1) Staff brez organizationId (nerešeno — MORA biti 0 ali izrecno ločeno) ==='
SELECT id, email, "userId", "organizationId"
  FROM "Staff" WHERE "organizationId" IS NULL;

\echo '=== 2) Podvojene kombinacije (userId, organizationId) — MORA biti 0 ==='
SELECT "userId", "organizationId", count(*) AS n
  FROM "Staff" GROUP BY 1,2 HAVING count(*) > 1;

\echo '=== 3) Termini, katerih Staff nima org (neskladje) — MORA biti 0 ==='
SELECT a.id AS appointment_id, a."staffId", s."organizationId"
  FROM "Appointment" a
  LEFT JOIN "Staff" s ON s.id = a."staffId"
  WHERE s."organizationId" IS NULL;

\echo '=== 4) StaffService, katerih Staff nima org — MORA biti 0 ==='
SELECT ss.id, ss."staffId", s."organizationId"
  FROM "StaffService" ss
  JOIN "Staff" s ON s.id = ss."staffId"
  WHERE s."organizationId" IS NULL;

\echo '=== 5) WorkingHours, katerih Staff nima org — MORA biti 0 ==='
SELECT wh.id, wh."staffId", s."organizationId"
  FROM "WorkingHours" wh
  JOIN "Staff" s ON s.id = wh."staffId"
  WHERE s."organizationId" IS NULL;

\echo '=== 6) Odstopanja Staff.organizationId od Appointment.organizationId (isti staffId) ==='
SELECT DISTINCT a."staffId", s."organizationId" AS staff_org, a."organizationId" AS appt_org
  FROM "Appointment" a
  JOIN "Staff" s ON s.id = a."staffId"
  WHERE s."organizationId" IS DISTINCT FROM a."organizationId";

\echo '=== 7) User.organizationId VS Staff.organizationId (informativno; ni sam vir resnice) ==='
SELECT u.id AS user_id, u.email, u."organizationId" AS user_org, s.id AS staff_id, s."organizationId" AS staff_org
  FROM "User" u
  JOIN "Staff" s ON s."userId" = u.id
  WHERE u."organizationId" IS DISTINCT FROM s."organizationId";

\echo '=== KONEC backfill pre-checka (neskladja 1–6 morajo biti prazna) ==='