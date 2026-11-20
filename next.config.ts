import type { NextConfig } from "next";

// P1 #32 (re-audit 2026-11): baseline hardening — prej je produkcija
// pošiljala SAMO HSTS. Dodani so X-Frame-Options (clickjacking),
// nosniff (MIME confusion), Referrer-Policy, Permissions-Policy,
// COOP/CORP. CSP je Report-Only (ne blokira), ker je projekt poln
// inline script/style in tretjih virov — preklop na enforcing zahteva
// nonce/whitelist iteracijo (ločena naloga).
//
// Re-audit 2026-12: odstranjen zastarel X-XSS-Protection; CSP
// frame-ancestors usklajen z X-Frame-Options po ruti (večina strani
// DENY/none, site-editor SAMEORIGIN/self) da ni protislovnih signalov.

function buildCsp(frameAncestors: "'none'" | "'self'") {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}

const baseSecurityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // X-Frame-Options je ohranjen kot legacy fallback; sodobni brskalniki
  // uporabljajo CSP frame-ancestors (spodaj, usklajeno po ruti).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
]

const nextConfig: NextConfig = {
  /* config options here */
  // Optimiziraj barrel imports iz velikih knjižnic (recharts, framer-motion, lucide...)
  // da se v bundle potegnejo samo dejansko uporabljeni moduli.
  experimental: {
    optimizePackageImports: [
      "recharts",
      "framer-motion",
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
    ],
  },
  // Izključi server-only pakete iz client bundle-a (P0: -50-100MB iz bundle)
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "@react-pdf/renderer",
    "resend",
    "pusher",
  ],
  // Ne izpostavljaj "X-Powered-By: Next.js" — manjša površina fingerprintinga.
  poweredByHeader: false,
  async headers() {
    return [
      // Večina strani: prepovedana vdelava v iframe (clickjacking hardening).
      // CSP frame-ancestors je usklajen z X-Frame-Options (DENY/none).
      {
        source: "/((?!dashboard/salon/site-editor).*)",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy-Report-Only", value: buildCsp("'none'") },
        ],
      },
      // Site editor: same-origin vdelava dovoljena za live preview v adminu.
      // Skladno z odobreno arhitekturo F5.3.0 in preverjanjem origin+tip v
      // site-editor-bridge. Območje vgnezdenja ni razširjeno izven te rute.
      {
        source: "/dashboard/salon/site-editor/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Content-Security-Policy-Report-Only", value: buildCsp("'self'") },
        ],
      },
    ]
  },
  // P0 PERF: "webpack" blok spodaj je potreben SAMO za produkcijski build;
  // ko `next dev --webpack` teče, ta custom chunking hook podvoji čas
  // kompilacije (webpack mora vsakokrat evalvirati ogromno cache skupin) in
  // v praksi povzroči, da se /dashboard stran nikoli ne prevede. Ohranimo ga
  // za `next build`, v dev načinu pa ga izpustimo.
  ...(process.env.NODE_ENV === "production"
    ? {
        webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
          // P0: Reši napačno zaznavanje vendor chunks (Cloudflare/Vercel build)
          if (!dev && !isServer) {
            config.optimization = config.optimization || {}
            config.optimization.splitChunks = {
              chunks: "all",
              cacheGroups: {
                default: false,
                vendors: false,
                // P0: React core v ločen chunk (stabilen, cache-friendly)
                react: {
                  name: "react-vendor",
                  test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                  chunks: "all",
                  priority: 40,
                  enforce: true,
                },
                // P0: Prisma + Supabase → server-only, nikoli v client bundle
                serverOnly: {
                  name: "server-only",
                  test: /[\\/]node_modules[\\/](@prisma|@supabase)[\\/]/,
                  chunks: "async",
                  priority: 30,
                  enforce: true,
                },
                // UI libs v ločen chunk
                ui: {
                  name: "ui-vendor",
                  test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion)[\\/]/,
                  chunks: "all",
                  priority: 20,
                },
                // Charts v ločen chunk
                charts: {
                  name: "charts-vendor",
                  test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
                  chunks: "all",
                  priority: 20,
                },
                // Ostali vendor paketi
                vendor: {
                  name: "vendor",
                  test: /[\\/]node_modules[\\/]/,
                  chunks: "all",
                  priority: 10,
                },
              },
            }
          }
          // Ignoriraj source map warnings
          config.ignoreWarnings = [
            ...(config.ignoreWarnings || []),
            { module: /node_modules\/@prisma/ },
          ]
          return config
        },
      }
    : {}),
  // Izključi test datoteke iz build procesa
  typescript: {
    // Vedno preverjaj tipe med buildom — CI + lokalni build ujamejo napake
    // preden se koda sploh deploya (prej je bil ignoreBuildErrors: true,
    // kar je pustilo npr. napake v scripts/seed-initial-data.ts neopažene).
    ignoreBuildErrors: false,
  },
  turbopack: {
    root: __dirname,
  },
  // Omogoči slike iz Supabase Storage in Vercel Blob
  images: {
    unoptimized: true, // onemogoči /_next/image proxy, da odpravimo napake pri nalaganju slik
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
