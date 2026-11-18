# Cloudinary / R2 Upload & Public-ID Security Audit

Scope audited (current working-tree state):
- `src/app/api/upload/route.ts`
- `src/app/api/upload/r2/route.ts`
- `src/lib/uploads/image-type.ts`
- `src/lib/utils/cloudinary.ts`
- `src/lib/r2-storage.ts`
- `src/lib/r2-upload-client.ts`
- `src/lib/upload-client.ts`
- `src/app/api/media/[id]/route.ts`

No source files were changed by this audit; this report is read-only.

## Executive summary

1. The old `/api/upload` SVG XSS vector is **mitigated** in the current code: MIME whitelist + magic-byte validation + `nosniff`/CSP/sandbox on `/api/media/[id]`.
2. R2 path (`/api/upload/r2`) performs server-side validation and uses a verified `sessionOrg` for the R2 key prefix; it does not allow arbitrary folder/path injection.
3. Cross-tenant R2 access is not currently exposed through a deletion/retrieval API in this codebase (`deleteImage` is library-only and unused; `getPresignedUploadUrl` is unused by any route). The main residual risk is **direct R2 object access**: uploaded objects are served by a public R2 URL and keys are partially guessable, with no app-level read gate.
4. Cloudinary public IDs are **not organization-scoped**. This is primarily an architectural/observability issue, not a demonstrated cross-tenant data-access vulnerability, because Cloudinary object retrieval is already public by design and there is no app-level delete/replace API.
5. Dead client code (`uploadDirectToR2`) references a non-existent `PUT /api/upload/r2` handler and is not wired into the active POST flow; it is not exploitable today but can cause confusion.

## Findings

### F1 — SVG / executable upload stored XSS (DB media path)
- Status: **CONFIRMED (mitigated in current code; regression risk remains for legacy rows)**
- Location:
  - `src/lib/uploads/image-type.ts:25-40` (`ALLOWED_IMAGE_MIME_TYPES`)
  - `src/lib/uploads/image-type.ts:87-110` (`validateImageUpload`)
  - `src/app/api/upload/route.ts:83-101`
  - `src/app/api/media/[id]/route.ts:84-103`
- Code evidence:
  - Allowed MIME list excludes `image/svg+xml`.
  - `validateImageUpload` checks declared MIME and magic bytes.
  - `/api/media/[id]` returns `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, and `Content-Disposition: inline`.
- Exploitation scenario:
  - Pre-fix: client sends `file.type=image/svg+xml` with SVG containing `<script>`, server stores it, browser executes script on app origin.
  - Post-fix: server rejects before storage; legacy DB rows still receive defense-in-depth headers.
- Impact / severity: High if bypassed; current severity Low/Medium (residual legacy data).
- Minimal fix already present; keep headers and validation.
- Required regression tests:
  - `validateImageUpload("image/svg+xml", pngBytes)` returns false.
  - `/api/media/[id]` returns CSP and `X-Content-Type-Options: nosniff`.
  - Legacy row with `mimeType=image/svg+xml` still receives sandbox headers.

### F2 — Declared MIME trusted only as a claim, magic bytes enforced
- Status: **CONFIRMED (good)**
- Location: `src/lib/uploads/image-type.ts:112-130` (`detectImageMime`)
- Evidence: JPEG/PNG/GIF/WEBP/AVIF signatures are checked; declared MIME must equal detected MIME.
- Impact: Prevents content-type confusion and extension spoofing at validation boundary.
- Required tests: mismatched declared/detected MIME returns `content_mismatch`.

### F3 — R2 upload authorization and org scoping
- Status: **PARTIALLY CONFIRMED**
- Location:
  - `src/app/api/upload/r2/route.ts:15-24` (auth)
  - `src/app/api/upload/r2/route.ts:26-38` (formData, type)
  - `src/app/api/upload/r2/route.ts:40-48` (permission check)
  - `src/app/api/upload/r2/route.ts:50-55` (`getSessionOrg`)
  - `src/app/api/upload/r2/route.ts:70-126` (entity ownership checks)
- Evidence:
  - Requires session.
  - For non-avatar: requires `settings.manage` permission.
  - For `product`: verifies product belongs to `sessionOrg.id`.
  - Uses `sessionOrg.id` for business/product/avatar/service/staff keys.
- Good: client cannot choose organization or entity.
- Gap: `type` is not whitelisted; unknown values fall to `default`/`business` branch, which is safe but should be explicit.
- Exploitation scenario for cross-tenant product: client sends another org's product ID; server returns 404 because `findFirst` is scoped to `sessionOrg.id`.
- Impact: Low.
- Recommended fix: validate `type` against an allow-list; return 400 for unknown type.
- Required tests: unknown type rejected or explicitly mapped; cross-org product upload returns 404.

### F4 — R2 key construction and extension safety
- Status: **CONFIRMED (good)**
- Location:
  - `src/lib/r2-storage.ts:68-118` (`uploadImage`, `uploadBusinessImage`, etc.)
  - `src/lib/r2-storage.ts:24-35` (`safeImageExtension`)
- Evidence:
  - Extension derived from verified MIME, not filename.
  - Keys use server-controlled prefixes (`businesses/<id>/`, `products/<id>/`, `avatars/<userId>/`).
- No path traversal via filename because `file.name` is not used in key.
- Required tests: filename `../../evil.jpg` does not alter key; MIME spoofing does not change extension.

### F5 — R2 direct object access / confidentiality
- Status: **NEEDS RUNTIME TEST / ARCHITECTURAL RISK**
- Location:
  - `src/lib/r2-storage.ts:134-141` (`getImageUrl`)
  - `src/lib/r2-upload-client.ts:165-180` (dead direct upload helper)
- Evidence:
  - R2 objects are addressed by public URL (`R2_PUBLIC_URL/<key>` or account URL).
  - No app route gates read access to R2 objects.
  - Keys include timestamps and type prefixes but not high-entropy secrets.
- Exploitation scenario:
  - If bucket is public, an attacker who guesses or learns a key can fetch the image directly, bypassing app-level media access decisions.
  - This matters for non-public tenant assets (draft/suspended org media), because `/api/media` has access decisions but R2 does not.
- Impact: Medium for confidential/draft assets; Low for public marketing assets.
- Recommended fix (choose one):
  1. Make R2 bucket private and serve through app route with access decision, or
  2. Use unguessable keys (UUID + at least 128 bits) and document that R2 assets are public by design.
- Required tests: direct fetch of a private-tenant R2 object returns 403/404 when bucket is private; key entropy test.

### F6 — Missing organization prefix in Cloudinary public IDs
- Status: **NOT CONFIRMED as cross-tenant vulnerability; PARTIALLY CONFIRMED as architectural issue**
- Location:
  - `src/app/api/upload/route.ts:124-150` (Cloudinary upload folder)
  - `src/lib/utils/cloudinary.ts:40-90` (`getCloudinaryUrl`)
- Evidence:
  - Cloudinary upload uses `folder: ${type}s` (e.g. `avatars`, `services`) and `public_id: ${type}_${userId}_${timestamp}`.
  - `getCloudinaryUrl` treats non-URL values as public IDs and builds `https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<publicId>`.
  - There is no app-level delete/replace endpoint for Cloudinary assets in this codebase; `deleteImage` exists only for R2 and is unused.
- Why this is not a demonstrated cross-tenant access bug:
  - Cloudinary delivery URLs are public by design.
  - There is no API in this app that lets tenant A delete/modify tenant B's Cloudinary asset by public ID.
  - Public IDs are not authorization tokens; lack of org prefix does not grant write access.
- Real residual concerns:
  - Enumeration/predictability of public IDs.
  - No tenant ownership metadata for Cloudinary assets in DB.
  - Harder auditing/cleanup when tenants are deleted.
- Recommended fix:
  - Include organization ID (and entity ID where applicable) in Cloudinary `folder`/`public_id`, e.g. `markec/<orgId>/<type>/<entityId>_<timestamp>`.
  - Store returned `public_id`/`secure_url` with org ownership in DB if deletion/lifecycle is needed.
- Required tests:
  - Upload as org A and org B produces distinct, org-scoped public IDs.
  - Cloudinary URL builder still passes through local/absolute URLs.

### F7 — Cloudinary URL builder pass-through and placeholder behavior
- Status: **CONFIRMED (good after P1 #18/#31)**
- Location: `src/lib/utils/cloudinary.ts:38-90`
- Evidence:
  - Absolute URLs (`http://`, `https://`, `/`) are returned unchanged.
  - Bare public IDs render local placeholder when `CLOUD_NAME` is empty.
- Required tests already present in `tests/utils/cloudinary-passthrough.test.ts`.

### F8 — Dead / unused presigned direct-upload client helper
- Status: **CONFIRMED (latent bug, not exploitable today)**
- Location:
  - `src/lib/r2-upload-client.ts:146-180` (`getPresignedUploadUrl`, `uploadDirectToR2`)
  - `src/lib/r2-storage.ts:143-158` (`getPresignedUploadUrl`)
- Evidence:
  - Client calls `PUT /api/upload/r2`, but route only exports `POST`.
  - No server route issues presigned URLs.
- Impact: `uploadDirectToR2` always fails with 405; no security impact, but confusing and could mask future mistakes.
- Recommended fix: either implement a validated presigned-URL endpoint with auth/org/type checks or remove dead helper.
- Required tests: if implemented, presigned URL requires auth and returns org-scoped key.

### F9 — DB media ownership/access decision
- Status: **CONFIRMED (good)**
- Location:
  - `src/app/api/media/[id]/route.ts:24-78`
  - `src/lib/media-access.ts` (decision matrix)
- Evidence:
  - Access decision uses org status/publish state and requester membership/role.
  - Removed staff (demoted to CLIENTE) cannot read draft/suspended tenant media.
- Required tests: matrix already implied; keep regression tests for removed employee.

### F10 — Storage quota gate only on DB path
- Status: **PARTIALLY CONFIRMED**
- Location:
  - `src/app/api/upload/route.ts:152-173`
  - R2 route has no equivalent storage accounting.
- Evidence: `/api/upload` checks `checkStorageLimit` for DB storage; R2 route does not account for R2 bytes.
- Impact: Plan enforcement gap for R2 uploads (business/abuse/cost), not direct security.
- Recommended fix: add R2 storage metering or per-org object count/size limits.
- Required tests: R2 upload rejected when org exceeds plan quota.

## Distinguish missing org prefix vs actual cross-tenant access

- Missing org prefix in Cloudinary public IDs is **not by itself** a cross-tenant access vulnerability:
  - It does not grant write/delete access.
  - Cloudinary delivery is public by design.
  - No app endpoint accepts a public ID for privileged mutation.
- It becomes a real issue only if future code adds:
  - deletion/replacement by public ID without ownership verification, or
  - signed/private asset delivery relying on obscurity.
- R2 has a stronger concern because keys are used directly in public URLs and there is no app-level read gate; key entropy and bucket privacy determine confidentiality.

## Minimal recommended priority fixes

1. Add `type` allow-list to `/api/upload/r2`.
2. Decide R2 confidentiality model and either private bucket + app gate or high-entropy keys.
3. Scope Cloudinary folders/public IDs by org ID for auditability.
4. Remove or properly implement dead presigned-upload helper.
5. Add R2 quota/accounting if plans should cover R2.
6. Keep SVG XSS defenses and add regression tests for legacy rows.

## Suggested regression test matrix

- Upload validation:
  - SVG rejected by `/api/upload` and `/api/upload/r2`.
  - MIME mismatch rejected.
  - Filename path traversal does not affect R2 key.
- Authorization:
  - Unauthenticated upload returns 401.
  - Non-admin uploading non-avatar returns 403.
  - Cross-org product upload returns 404.
- Cloudinary:
  - Empty cloud name renders placeholder.
  - Absolute/local URLs pass through.
  - Org-scoped public IDs when cloud configured.
- Media access:
  - Removed staff cannot read draft/suspended org media.
  - Legacy SVG row returns sandbox headers.
- R2:
  - Unknown type rejected.
  - Direct private object access blocked or documented.
  - Quota enforcement for R2 if implemented.
