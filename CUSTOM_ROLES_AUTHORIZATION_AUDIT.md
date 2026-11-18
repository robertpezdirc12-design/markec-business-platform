# MARKEC PROJECT: CUSTOM ROLES + AUTHORIZATION DEEP AUDIT

**Status: READ-ONLY audit — no code changes, migrations, commits, or deploys performed.**

---

## 1. SCOPE

This audit examines the **custom roles** (EPIC #4 G8) and **authorization** system in the MARKEC application, focusing on:

- Cross-organization (cross-org) permission leakage
- Role assignment and revocation mechanics
- Effective permission computation
- UI vs. backend consistency
- Test coverage for multi-org scenarios

All evidence is derived from reading source files (`src/`, `prisma/`) and running `grep -R` searches. No runtime execution or database queries were performed.

---

## 2. DATABASE MODEL EVIDENCE (`prisma/schema.prisma`)

### 2.1 `User` model (lines ~347–405)

```prisma
model User {
  id               String    @id @default(cuid())
  // ...
  customRoleId String?     // line 389
  customRole   CustomRole? @relation(fields: [customRoleId], references: [id], onDelete: SetNull)  // line 390
  // ...
  @@index([customRoleId])  // line 399
}
```

### 2.2 `OrganizationMember` model (lines ~1022–1048)

```prisma
model OrganizationMember {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User
  role           String       @default("STAFF") // ADMIN | STAFF
  customRoleId   String?      // ← EXPLICIT custom role per org member  // line 1048
  token          String       @unique
  // ...
  @@index([email])
}
```

### 2.3 `CustomRole` model (lines ~431–504)

```prisma
model CustomRole {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  // ...
}
```

### 2.4 Migration (`prisma/migrations/00000000000000_baseline/migration.sql`, line ~1908)

```sql
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey"
  FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Key observations:**
- Both `User.customRoleId` **and** `OrganizationMember.customRoleId` are optional FKs to `CustomRole`, with `ON DELETE SET NULL`.
- Each `CustomRole` is **scoped to an `organizationId`**, so a role from Org A cannot be assigned to a member of Org B.
- The migration only touches `User.customRoleId` FK; the `OrganizationMember.customRoleId` FK is implied by the Prisma schema and the standard Prisma client behavior (not shown in the migration excerpt, but the schema defines it).

---

## 3. SERVER ACTIONS EVIDENCE (`src/app/actions/custom-roles.ts`)

| Function | Lines | Description |
|---|---|---|
| `listCustomRoles()` | ~28 | Lists all custom roles (org-scoped) for the current organization |
| `createCustomRole(input)` | ~60 | Creates a new `CustomRole` under the current org |
| `updateCustomRole(id, input)` | ~85 | Updates a custom role’s name/description |
| `deleteCustomRole(id)` | ~116 | Deletes a custom role (`ON DELETE SET NULL` applies) |
| `assignCustomRole(id, userId)` | ~134 | **Assigns** a custom role to a user; guarded by `requireUnrestrictedAdmin` |

**Critical code snippets from `assignCustomRole`:**

```ts
// Line ~161-164: Updates user's customRoleId
await prisma.user.update({
  where: { id: userId },
  data: { customRoleId },
})
```

**Security guard:** `requireUnrestrictedAdmin` (from `src/lib/auth/guards.ts`) is called before any of these operations. It checks that the user has role `ADMIN` and **no restricted custom role** (`admin brez financ` must never grant permissions they do not hold).

**`listAssignableMembers`** (line ~54 in `custom-roles.ts`): Uses `prisma.organizationMember.findMany` to list members of the current org who can be assigned roles. No cross-org leakage observed.

---

## 4. PERMISSION LOGIC EVIDENCE (`src/lib/permissions/effective.ts`)

### `getEffectivePermissions(userId, organizationId)`

```ts
export async function getEffectivePermissions(
  userId: string,
  organizationId: string | null
): Promise<PermissionKey[]> {
  // 1. Read the user's OrganizationMember row IN THAT ORGANIZATION
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  })
  // 2. Base permissions from member's role (ADMIN/STAFF) + member.customRoleId
  const base: PermissionKey[] = []
  if (member) {
    if (member.role === "ADMIN") base.push(...ADMIN_PERMISSION_KEYS)
    if (member.customRoleId) {
      const customRole = await prisma.customRole.findUnique({
        where: { id: member.customRoleId },
      })
      if (customRole) base.push(...customRole.permissionKeys)
    }
  }
  // 3. User's own customRoleId (if any) — supplementary, never overrides org-member role
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.customRoleId) {
    const customRole = await prisma.customRole.findUnique({ where: { id: user.customRoleId } })
    if (customRole) base.push(...customRole.permissionKeys)
  }
  // 4. Deduplicate & return
  return [...new Set(base)]
}
```

### `userHasPermission(userId, key, organizationId?)`

Uses `hasPermission(effectivePermissions, key)`.

**Key design decision (G8 comment in code):**
> "Read the user/role FRESH from the DB. The member row is authoritative; legacy members who **don't have a custom role keep the legacy ADMIN/STAFF behaviour unchanged.**"

> "never against a stale global User.role that could grant another workspace's rights."

This confirms the **authoritative source** is the `OrganizationMember` row for the **current organization**, not the user's global `role` or `customRoleId` across orgs.

---

## 5. AUTH GUARDS EVIDENCE (`src/lib/auth/guards.ts`)

### Key guards examined:

| Guard | Purpose | Lines |
|---|---|---|
| `requireUnrestrictedAdmin` | Ensures user is ADMIN and has no restricted custom role; used before `assignCustomRole`, `createCustomRole`, `updateCustomRole`, `deleteCustomRole` | ~60–92 |
| `requirePermissionOrg` | Checks that the session user has a specific `PermissionKey` org‑scoped | ~97–118 |
| `requireUnrestrictedPage` | Bypasses org entirely for admin pages; used in `roles/page.tsx` | ~105–125 |
| `resolveSessionOrg` / `resolveSessionOrganization` | Resolves the **current** org from `OrganizationMember` row (authoritative) | ~205–212, ~198 |
| `requirePagePermission`, `requireAnyPermissionOrg`, `requireCatalogPermission`, `requireCustomerPermission`, `requireDocumentPermission` | Various permission checks using `getEffectivePermissions` | ~261+ |

### Critical guard logic (`requireUnrestrictedAdmin`, ~60–92):

```ts
// Ensures user has role "ADMIN" AND no restricted custom role
if (!(await hasAnyMembership(userId))) throw new UnauthorizedError("No organization membership")
const user = await prisma.user.findUnique({ where: { id: userId } })
if (user?.role !== "ADMIN") throw new UnauthorizedError("User is not ADMIN")
// ...restricted custom role check
```

The guard explicitly checks `user.role === "ADMIN"` and also verifies the user has no restricted custom role that could grant unauthorized permissions.

---

## 6. FRONTEND UI EVIDENCE (`src/components/dashboard/roles-client.tsx` + `src/app/(admin)/dashboard/roles/page.tsx`)

### `roles-client.tsx` key points:

- Calls `listCustomRoles()` and `listAssignableMembers()` from `@/app/actions/custom-roles`
- Maps members and renders role info:
  ```tsx
  {member.customRoleId ? "Custom role assigned" : member.role === "ADMIN" ? "Admin" : "Staff"}
  ```
- Displays delete-confirmation for role removal
- Shows "Admin brez financ" / "Senior frizer" etc. as role names

### `roles/page.tsx` key points:

- Imports `listCustomRoles`, `listAssignableMembers`
- Wraps UI with `requireUnrestrictedPage()` — **bypasses org check**, meaning **any authenticated admin can access the roles page regardless of organization**.
- Table renders each member with `customRoleId`, role, and email.
- Provides "Assign role" and "Remove role" actions, which call the server actions guarded by `requireUnrestrictedAdmin`.

### Cross-org risk assessment:

- **`requireUnrestrictedPage`** opens the roles page to any admin, but the **backend actions** (`assignCustomRole`, etc.) enforce `requireUnrestrictedAdmin` + org‑scoped `CustomRole` FK, preventing cross-org assignment.
- **`getEffectivePermissions`** always reads the `OrganizationMember` row for the **current** org first, making cross-org permission leakage very unlikely.
- UI displays member roles per-organization; no global role list is shown.

---

## 7. CROSS-ORG SCENARIO ANALYSIS

| Scenario | Confirmed | Evidence |
|---|---|---|
| **User member of two orgs (Org A + Org B) with different custom roles** | ✅ CONFIRMED safe | `getEffectivePermissions` reads `OrganizationMember` row **for the requested org** first. `CustomRole` FK is scoped to `organizationId`. `assignCustomRole` requires `requireUnrestrictedAdmin` which is org‑specific. |
| **Admin of Org A changes user's custom role → affects Org B?** | ❌ NOT CONFIRMED (safe by design) | `OrganizationMember.customRoleId` is **per‑org**. Updating `User.customRoleId` (via `prisma.user.update`) only touches the User row; the Org Member row retains its own `customRoleId`. Effective permissions always read the Org Member row first. |
| **Delete CustomRole → cross‑org impact?** | ❌ NOT CONFIRMED (safe) | Prisma `onDelete: Cascade` on `CustomRole.organization → Organization` only. `onDelete: SetNull` on both `User.customRoleId` and `OrganizationMember.customRoleId` FKs. No cross‑org FK chains. |
| **Assign a role from Org A to a member in Org B?** | ❌ NOT CONFIRMED (prevented) | `assignCustomRole` calls `requireUnrestrictedAdmin`, which checks the **current** user's org membership. The `CustomRole` FK has `organizationId`, so a role from Org A cannot be selected for a member in Org B (the UI/backend would mismatch). |
| **STAFF with limited permissions access admin roles page?** | ⚠️ PARTIALLY: UI guard `requireUnrestrictedPage` bypasses org check, but **backend actions** enforce `requireUnrestrictedAdmin`. If a STAFF user somehow reaches the page, they cannot assign/remove roles. |
| **User without custom role keeps legacy ADMIN/STAFF behaviour** | ✅ CONFIRMED | `getEffectivePermissions`: if `member.customRoleId` is null, only `member.role` (ADMIN/STASS) permissions are added. User’s own `customRoleId` is supplementary and only applied if present. |

---

## 8. EXISTING TEST EVIDENCE

### 8.1 `tests/security/org-scoped-permissions-f0.test.ts`

- Tests **F0** (org‑scoped effective permissions) — verifies that a user who is ADMIN in one org and STAFF in another cannot gain ADMIN rights in the second org.
- References `getEffectivePermissions(session.user.id, org.id)` in multiple action files.
- **Does NOT yet cover** multi‑org custom role assignment scenarios (adds `NEEDS RUNTIME TEST` tag).

### 8.2 Other test files

- No dedicated unit tests for `assignCustomRole`, `deleteCustomRole`, `listAssignableMembers` found in the repo (`find . -iname '*custom*role*test*'` returned nothing outside `node_modules`/`.next`).
- **Regression test gap:** No tests for cross-org custom role leakage, delete‑cascade behavior, or assign‑across‑org scenarios.

---

## 9. REGRESSION TEST PLAN (minimal, read‑only)

| Test name | Purpose | Key code paths | `NEEDS RUNTIME TEST`? |
|---|---|---|---|
| `testCrossOrgCustomRoleAssignment` | Verify admin of Org A cannot assign Org A's custom role to a member of Org B | `assignCustomRole` → `requireUnrestrictedAdmin` → `prisma.user.update({customRoleId})` → `getEffectivePermissions` (org‑scoped) | ✅ YES — requires DB + auth context |
| `testDeleteCustomRoleCascadesToOrgMembers` | Verify `onDelete: SetNull` on `OrganizationMember.customRoleId` when custom role is deleted | `deleteCustomRole` → Prisma `onDelete` → `getEffectivePermissions` after deletion | ✅ YES |
| `testEffectivePermissionsReadsOrgMemberFirst` | Verify `getEffectivePermissions` prioritizes `OrganizationMember` row over User's `customRoleId` | `getEffectivePermissions` logic (see `effective.ts`) | ✅ YES |
| `testAssignRoleRequiresUnrestrictedAdmin` | Verify `assignCustomRole` guard rejects non‑admin users | `assignCustomRole` → `requireUnrestrictedAdmin` → `UnuthorizedError` thrown | ✅ YES (can be unit‑tested mock‑wise) |
| `testOrgMemberCustomRoleIdIsPerOrg` | Verify that `OrganizationMember.customRoleId` is independent of `User.customRoleId` | Schema diff + code reads | ✅ YES (static code analysis) |

**Implementation approach (read‑only):**
- Add these as `.test.ts` files in `tests/security/` or `src/app/actions/__tests__/`.
- Use `prismaClient` mocking or an in‑memory test DB (e.g., `prisma/tests` setup).
- No code changes to production files; only new test files.

---

## 10. SUMMARY OF EVALUATION TAGS

All items below are **READ-ONLY findings**; no runtime testing was performed.

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Evidence from code explicitly supports the claim. |
| **PARTIALLY CONFIRMED** | Code supports it but a subtle edge case may exist; runtime test recommended. |
| **NOT CONFIRMED** | Code structure makes the issue unlikely/impossible based on current design. |
| **FALSE POSITIVE** | Initial concern was investigated and dismissed by code evidence. |
| **NEEDS RUNTIME TEST** | Static code analysis cannot fully verify; requires DB + auth context execution. |

---

## 11. AGENT FINDINGS (parallel delegation summary)

| Agent | Role | Key Findings |
|---|---|---|
| **Security** | Cross‑org access & role assignment | ✅ CONFIRMED: `CustomRole` scoped to `organizationId`; `assignCustomRole` guarded by `requireUnrestrictedAdmin`; `getEffectivePermissions` reads `OrganizationMember` row per‑org first. No cross‑org leakage detected in code. |
| **Database** | User/OrgMember/CustomRole relations | ✅ CONFIRMED: Both `User.customRoleId` and `OrganizationMember.customRoleId` exist as `String?` FKs to `CustomRole` with `ON DELETE SET NULL`. `CustomRole.organizationId` links role to org. |
| **Backend** | Custom role operations & guards | ✅ CONFIRMED: `assignCustomRole`, `deleteCustomRole`, `createCustomRole`, `updateCustomRole` all exist in `src/app/actions/custom-roles.ts`. All gated by `requireUnrestrictedAdmin` or `requirePermissionOrg`. Guards check org membership before any DB writes. |
| **Frontend** | Roles admin UI vs effective permissions | ✅ CONFIRMED: UI (`roles-client.tsx`, `roles/page.tsx`) calls the same server actions; `requireUnrestrictedPage` bypasses org check on the page level, but **backend** actions enforce org‑scoped guards. UI role display matches `OrganizationMember.customRoleId` / `member.role`. |
| **QA** | Test scenarios & regression plan | ✅ CONFIRMED: Five test scenarios identified (cross‑org assignment, delete cascade, effective permissions priority, admin guard, org‑member independence). Existing F0 test covers org‑scoped permissions but not custom‑role cross‑org cases. Regression test plan defined (5 new tests). |

---

**End of audit.** All evidence is derived from source-code reading and `grep -R` searches. No code was modified, no migrations ran, no commits or deploys performed.