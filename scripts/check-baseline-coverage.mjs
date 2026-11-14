// Verify the 12 F5.x migrations' core objects are present in the baseline SQL.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const base = fs.readFileSync(path.join(root, "prisma", "migrations", "00000000000000_baseline", "migration.sql"), "utf8")
const has = (needle) => base.includes(needle)

const checks = {
  "OrganizationInvitation table": 'CREATE TABLE "OrganizationInvitation"',
  "Staff (user,org) unique": '"Staff_userId_organizationId_key"',
  "Promotion table": 'CREATE TABLE "Promotion"',
  "PromotionRedemption table": 'CREATE TABLE "PromotionRedemption"',
  "PromotionRedemptionStatus enum": 'CREATE TYPE "PromotionRedemptionStatus"',
  "PromotionScope enum": 'CREATE TYPE "PromotionScope"',
  "PromotionStatus enum": 'CREATE TYPE "PromotionStatus"',
  "CategoryType enum": 'CREATE TYPE "CategoryType"',
  "PromotionRedemption status col": 'CREATE TABLE "PromotionRedemption"' ,
  "Order.promotionDiscount": '"promotionDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0' ,
  "Appointment.promotionSnapshot": '"promotionSnapshot" JSONB',
  "Category parentId": '"parentId" TEXT',
  "Category categoryType": '"categoryType" "CategoryType" NOT NULL DEFAULT \'BOTH\'' ,
  "OrderItem variantId": '"variantId" TEXT',
  "Product reservedQuantity": '"reservedQuantity" INTEGER NOT NULL DEFAULT 0' ,
  "ProductVariant reservedQuantity": '"reservedQuantity" INTEGER NOT NULL DEFAULT 0' ,
  "Gallery table": 'CREATE TABLE "Gallery"',
  "GalleryItem table": 'CREATE TABLE "GalleryItem"',
  "FaqItem table": 'CREATE TABLE "FaqItem"',
  "Customer isArchived": '"isArchived" BOOLEAN NOT NULL DEFAULT false' ,
  "WalkInEntry customerId": '"customerId" TEXT',
  "Document orderId": '"orderId" TEXT',
  "Document issuerSnapshot": '"issuerSnapshot" JSONB',
  "DocumentPayment table": 'CREATE TABLE "DocumentPayment"',
  "CreditNote table": 'CREATE TABLE "CreditNote"',
  "DocumentArchive table": 'CREATE TABLE "DocumentArchive"',
  "DocumentSendLog table": 'CREATE TABLE "DocumentSendLog"',
  "DocumentSequence table": 'CREATE TABLE "DocumentSequence"',
}
for (const [label, needle] of Object.entries(checks)) {
  console.log((has(needle) ? "IN_BASELINE  " : "MISSING       ") + label)
}