import { NextRequest, NextResponse } from "next/server"
import { downloadDocumentArchive } from "@/app/actions/documents"

// ============================================================
// ZAŠČITEN PRENOS ARHIVIRANEGA PDF-JA.
// • org-scoped + IDOR: akcija preveri pripadnost org zahtevalcu.
// • ni javni/ugobljivi URL: zahteva prijavljenega člana z finances.view
//   nad arhivom; neavtorizirani prejme 404 (ne potrjuje ID-ja).
// • integritetni hash preverjen ob vsakem prenosu.
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await downloadDocumentArchive(id)
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
    }
    const encodedName = encodeURIComponent(result.filename)
    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(result.pdf.length),
        // encodeURIComponent + filename* (RFC 5987): noben narekovaj,
        // nova vrstica ali ne-ASCII znak ne more priti v glavo (tudi za
        // starejše arhive z nekoč nesanitiziranim imenom).
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        // X-Content-Type-Options za preprečitev sniffinga (kriptov .pdf).
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }
}