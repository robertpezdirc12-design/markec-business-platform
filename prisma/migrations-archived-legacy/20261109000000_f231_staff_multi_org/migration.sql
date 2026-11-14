-- ============================================================
-- F2.3.1 — Staff multi-organization
-- A user may be an employee in MULTIPLE organizations. Each org
-- gets its OWN Staff row; uniqueness is per (userId, organizationId)
-- instead of the previous global one-to-one on userId.
--
-- IMPORTANT: backfill MUST assign organizationId to every Staff
-- row BEFORE this runs on data that has NULL orgs (see
-- scripts/f23-backfill-check.sql). Postgres treats NULLs as
-- distinct in unique indexes, so NULL-org rows would silently
-- break the "one staff per (user, org)" guarantee.
-- ============================================================

-- 1) Drop the global one-to-one unique on Staff.userId.
DROP INDEX IF EXISTS "Staff_userId_key";

-- 2) Replace the (redundant) plain userId index? Keep it for the
--    legacy userId lookup, but the authoritative fetch becomes the
--    composite. (Prisma @@index([userId]) recreates it as Staff_userId_idx.)
CREATE INDEX IF NOT EXISTS "Staff_userId_idx" ON "Staff"("userId");

-- 3) Enforce one Staff row per (user, organization).
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_organizationId_key"
  ON "Staff"("userId", "organizationId");

-- 4) The User.staff one-to-one relation becomes a list (User.staffs).
--    No DDL is required for a Prisma back-relation; the constraints
--    above fully express the schema change at the DB level.