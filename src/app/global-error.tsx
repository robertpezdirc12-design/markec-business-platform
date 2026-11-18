"use client"

// ============================================================
// GLOBALNA MEJA NAPAK (App Router)
//
// `error.tsx` ujame napake segmentov POD korenskim layoutom, ne pa
// napake samega korenskega layouta (npr. pokvarjen tenant kontekst,
// sesut provider). Takrat Next prikaže prazno stran. Ta meja je
// zadnja mreža: nadomesti CEL dokument (<html>/<body>) in uporabi
// inline sloge, ker ob sesutju korena globalni CSS ni zagotovljen.
// ============================================================

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Digest poveže odjemalski prikaz s strežniškim zapisom; brez PII.
    console.error("[global-error]", error.digest ?? "", error.message)
  }, [error])

  return (
    <html lang="sl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0b0b0f",
          color: "#f5f5f7",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "12px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#a1a1aa",
            }}
          >
            Poslovna platforma
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "28px", lineHeight: 1.2 }}>
            Nekaj je šlo narobe
          </h1>
          <p style={{ margin: "0 0 24px", color: "#c4c4cc", lineHeight: 1.6 }}>
            Stran se ni mogla naložiti. Poskusite znova — če se napaka ponovi,
            osvežite stran ali se vrnite na začetno stran.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "10px",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: 600,
                background: "#f5f5f7",
                color: "#0b0b0f",
              }}
            >
              Poskusi znova
            </button>
            {/* Namerno <a>, ne <Link>: po sesutju korena želimo
                poln reload dokumenta, ne mehkega prehoda routerja. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "10px",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: 600,
                border: "1px solid #3f3f46",
                color: "#f5f5f7",
                textDecoration: "none",
              }}
            >
              Na začetno stran
            </a>
          </div>
          {error.digest ? (
            <p style={{ margin: "24px 0 0", fontSize: "12px", color: "#71717a" }}>
              Koda napake: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
