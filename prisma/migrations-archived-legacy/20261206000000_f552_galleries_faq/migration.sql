-- F5.5.2 — Galerije & FAQ (org-scoped, nad obstoječo medijsko plastjo).
-- Fotografije so referencirane (mediaId), ne shranjene znova.

CREATE TABLE "Gallery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "coverImageId" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "linkedServiceId" TEXT,
  "linkedProductId" TEXT,
  "linkedProjectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryItem" (
  "id" TEXT NOT NULL,
  "galleryId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "caption" TEXT,
  "alt" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaqItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "serviceId" TEXT,
  CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Gallery_organizationId_idx" ON "Gallery"("organizationId");
CREATE INDEX "Gallery_organizationId_isPublished_idx" ON "Gallery"("organizationId", "isPublished");
CREATE INDEX "Gallery_linkedServiceId_idx" ON "Gallery"("linkedServiceId");
CREATE INDEX "Gallery_linkedProductId_idx" ON "Gallery"("linkedProductId");
CREATE INDEX "Gallery_linkedProjectId_idx" ON "Gallery"("linkedProjectId");
CREATE INDEX "GalleryItem_galleryId_idx" ON "GalleryItem"("galleryId");
CREATE INDEX "GalleryItem_galleryId_position_idx" ON "GalleryItem"("galleryId", "position");
CREATE INDEX "FaqItem_organizationId_idx" ON "FaqItem"("organizationId");
CREATE INDEX "FaqItem_organizationId_isPublished_idx" ON "FaqItem"("organizationId", "isPublished");
CREATE INDEX "FaqItem_serviceId_idx" ON "FaqItem"("serviceId");

ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;