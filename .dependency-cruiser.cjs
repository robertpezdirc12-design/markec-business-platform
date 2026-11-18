/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    /* RULES YOU WANT TO ENFORCE */

    /* from → to: circular dependency between modules */
    {
      name: "no-circular",
      severity: "error",
      comment:
        "This dependency is part of a circular relationship. You might want to refactor these (or the shared logic) into a separate module to break the cycle.",
      from: {},
      to: {
        circular: true,
      },
    },

    /* forbid dependencies outside the src tree reaching into build/config areas */
    {
      name: "no-production-import-of-config",
      severity: "warn",
      comment:
        "Production code should not reach into config, test or script-only areas from src.",
      from: {
        path: "^src/(app|components|lib|store|hooks)/",
      },
      to: {
        path: "^(scripts|tests|prisma)/",
      },
    },

    /* FAZA 1.1 — getPublicOrg (javni, BREZ seje) ni statično omejen na
       module. getPublicOrg, getSessionOrg, requireAdminOrg in getResolvedOrg
       živijo v ISTEM modulu (src/lib/tenant.ts), zato dependency-cruiser ne
       more ločiti "admin akcija pokliče javni fallback" od "admin akcija
       uporabi sejni rezolutor" — pravilo na ravni celotnega modula da 39
       lažnih opozoril (javne akcije cart/checkout/faq/galleries … pravilno
       rabijo getPublicOrg in so prav tako v app/actions/).

       Cross-tenant fallback (V-1 iz ARCHITECTURE.md) je zato zajet v KODI in
       TESTU, ne v statični pravili:
         - requireAdminOrg → requireSessionOrg (star "prva ACTIVE org"
           fallback je ODSTRANJEN — F2.1)
         - getResolvedOrg: prijavljen ADMIN/STAFF nikoli ne pade na anonimni
           privzeti najemnik (F2.0)
         - tests/integration/f2-1/org-isolation.itest.ts preverja obnašanje
       Pravila zato tukaj ne dodajamo — bi bilo več hrupa kot koristi. */
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm"],
    },
    exclude: {
      path: "(node_modules|\\.next|build|dist|coverage|playwright-report|test-results)",
    },
    includeOnly: {
      path: "^(src|prisma|scripts)/",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
      text: {
        highlightFocused: false,
      },
    },
  },
};