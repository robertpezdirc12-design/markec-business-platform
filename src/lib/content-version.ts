import "server-only"

// ============================================================
// F5.5.2 — contentVersion bump + ConfigChangeLog za galerije/FAQ.
//
// Galerije, njihovi elementi in FAQ so ločeni od JSON `SiteContent`,
// a morajo biti del istega osnutka/objave (E3-2). Vsaka sprememba
// teh entitet najpogosteje pomeni neobjavljeno spremembo, zato
// povečamo `Organization.contentVersion` (drift detekcija +
// publish/revert) in zapišemo ConfigChangeLog vrstico, da se obdrži
// sledljivost in zgodovina.
// ============================================================

import { prisma } from "@/lib/prisma"
import { recordConfigChange } from "@/lib/config-history/record"
import type { ConfigChangeAction, ConfigSnapshot } from "@/lib/config-history/logic"

export interface VersionBumpOptions {
  entityKey: string
  action: ConfigChangeAction
  summary: string
  previous?: unknown
  next?: unknown
}

/**
 * Poveča `Organization.contentVersion` in zapiše ConfigChangeLog.
 * `contentVersion` povečano pomeni: `hasUnpublishedChanges` se obrne na
 * true, `publishSite` jo posname, `revertSiteContentToPublished` jo vrne
 * nazaj. Izhod je vedno 0/1 napake-safe (log napaka ne sme pokvariti CRUD).
 */
export async function bumpContentVersion(
  organizationId: string,
  actorEmail: string | null | undefined,
  opts: VersionBumpOptions
): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { contentVersion: { increment: 1 } },
  })
  const toSnapshot = (v: unknown): ConfigSnapshot =>
    v == null ? null : (v as Record<string, unknown>)
  await recordConfigChange({
    organizationId,
    actorEmail: actorEmail ?? "unknown",
    entityKey: opts.entityKey,
    action: opts.action,
    summary: opts.summary,
    previous: toSnapshot(opts.previous),
    next: toSnapshot(opts.next),
  }).catch(() => undefined)
}