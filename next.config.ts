import type { NextConfig } from "next";

// P1 #32 (re-audit 2026-11): baseline hardening — prej je produkcija
// pošiljala SAMO HSTS. Dodani so X-Frame-Options (clickjacking),
// nosniff (MIME confusion), Referrer-Policy, Permissions-Policy,
// COOP in CSP v Report-Only načinu (spremljamo kršitve, še ne
// blokiramo — inline skripti Next.js/temnega načina zahtevajo
// nonce/hash pristop, ki ga uvedemo po analizi poročil).
// X-Powered-By se izklopi z poweredByHeader: false.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Najemniške strani niso namenjene vgradnji v iframe (odločba #32:
  // /preview ne izjemljimo, ker je samostojna stran, ne vgrajen element).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      // 'unsafe-eval' potrebuje Next.js dev (Turbopack HMR); produkcija
      // ga ne izkorišča. 'unsafe-inline' za skripte odstranimo šele, ko
      // preidemo na nonce (report-only faza zbira podatke).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-src 'self' https://js.stripe.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Turbopack: določi koren projekta eksplicitno (v Windows okolju z več
  // lockfiles je Next sprva izbral napačen koren → ni razrešil tailwindcss).
  turbopack: {
    root: __dirname,
  },
  // E3-8 robustness fix: reactCompiler breaks form submit event wiring
  // in PRODUCTION builds (submit handlers never fire; the same form
  // works in dev). Correctness over memoization — re-enable only after
  // upstream fix + E2E green (e2e/ suite guards this regression).
  reactCompiler: false,
  // P1 #32 (re-audit 2026-11): ne razkrivaj tehnološkega skladka.
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    // F5.3.1: vizualni urejevalnik vgnezdi DRAFT PREDOGLED /s/[slug]/preview
    // v iframe (same-origin, integracija urejevalnika). Splošni P1#32 headerji
    // (X-Frame-Options: DENY + frame-ancestors 'none') bi ta iframe blokirali,
    // zato MORA ruta predogleda dovoliti SAMO same-origin vgnezditev
    // (frame-ancestors 'self' / SAMEORIGIN). Skladno z odobreno arhitekturo
    // F5.3.0 in preverjanjem origin+tip v site-editor-bridge. Vse ostale rute
    // ostanejo DENY (zmanjšano območje vgnezdenja ni razširjeno).
    {
      source: "/s/:slug/preview",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        {
          // Istovetno preostalo CSP kot P1#32, le frame-ancestors 'self' —
          // omogoči same-origin vgnezdenje predogleda v urejevalnik.
          key: "Content-Security-Policy-Report-Only",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "media-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
            "frame-src 'self' https://js.stripe.com",
            "worker-src 'self' blob:",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
            "upgrade-insecure-requests",
          ].join("; "),
        },
      ],
    },
  ],
  images: {
    unoptimized: true, // Disable automatic image optimization
    qualities: [75, 90], // Configure allowed image qualities
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
