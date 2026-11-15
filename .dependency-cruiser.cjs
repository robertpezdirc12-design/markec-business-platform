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