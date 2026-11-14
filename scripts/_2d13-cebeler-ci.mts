// READ-ONLY beekeeper health-check against markec_e2e_test (no writes).
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const slug = "svezi-cebeler-2d1l";
const org = await p.organization.findUnique({ where: { slug }, include: { moduleStates: true } });
if (!org) { console.log("CEBELAR: organizacija NE obstaja (" + slug + ")"); await p.$disconnect(); process.exit(0); }
console.log("org:", org.id.slice(0,8), "| name:", org.name, "| profileId:", (org as any).profileId ?? "(?)");
console.log("moduleStates:", org.moduleStates?.map(m => m.moduleId + "=" + m.state).join(", ") ?? "(ni)");
const cats = await p.category.findMany({ where: { organizationId: org.id } });
console.log("categories:", cats.length);
const products = await p.product.findMany({ where: { organizationId: org.id }, select: { id: true, name: true, sku: true, price: true, isActive: true, forSale: true, stockQuantity: true, isFeatured: true } });
console.log("products:", products.length);
products.forEach(pr => console.log("  -", pr.name, "| sku:", pr.sku ?? "(?)", "| price:", pr.price, "| active:", pr.isActive, "| forSale:", pr.forSale, "| stock:", pr.stockQuantity, "| featured:", pr.isFeatured));
const services = await p.service.count({ where: { organizationId: org.id } });
console.log("services:", services, "(cebelar naj ima 0)");
const staff = await p.staff.count({ where: { organizationId: org.id } });
console.log("staff:", staff, "(cebelar naj ima 0)");
const scRow = await p.salonConfig.findUnique({ where: { organizationId: org.id }, select: { siteContent: true, publishedSiteContent: true, updatedAt: true } });
if (!scRow) { console.log("salonConfig: (ni) — NI shranjene vsebine!"); }
else {
  console.log("siteContent draft version fields:", JSON.stringify(scRow.siteContent).length, "znakov");
  console.log("publishedSiteContent fields:", JSON.stringify(scRow.publishedSiteContent).length, "znakov (0 = NI objave)");
  try { const h = scRow.siteContent as any; console.log("draft hero.title:", h?.hero?.title ?? JSON.parse(JSON.stringify(scRow.siteContent))?.hero?.title); } catch { console.log("draft ni JSON"); }
  try { const hp = scRow.publishedSiteContent as any; console.log("published hero.title:", hp?.hero?.title ?? JSON.parse(JSON.stringify(scRow.publishedSiteContent))?.hero?.title); } catch { console.log("published ni JSON"); }
}
const members = await p.organizationMember.findMany({ where: { organizationId: org.id }, include: { user: { select: { email: true, name: true, role: true } } } });
console.log("members (org):", members.length);
members.forEach(m => console.log("  -", m.user?.email, "| role:", m.user?.role));
await p.$disconnect();