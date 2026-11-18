import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // P1 (audit 2026-11): `eslint-config-next` 16.4 prinaša react-hooks v6,
    // ki "setState sinhrono v efektu" in "immutability" prvič označi kot
    // NAPAKO. 16 obstoječih komponent (sidebar, command palette, i18n
    // provider, site-editor …) uporablja ta vzorec za sinhronizacijo z
    // localStorage/props — to je znan dolg, ne regresija te spremembe.
    // Pravilo ostaja vidno kot opozorilo; popraviti ga je treba po
    // komponentah (React 19: `useSyncExternalStore`/`useEffectEvent`), ne
    // v istem koraku kot varnostni popravki.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      // Placeholder parametra (_orgId v javnih akcijah faq/galleries) obstajajo
      // zaradi signaturne združljivosti — klicevi argument prenašajo po poziciji,
      // brisanje parametra bi jih zlomilo. Konvencija: _ predpona = namerno neuporabljeno.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local dev daemon (sandbox helper; intentionally untracked via
    // .git/info/exclude — never part of the repo).
    "scripts/start-dev-daemon.cjs",
  ]),
]);

export default eslintConfig;
