import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Health-data paths must never reach for the service-role client: it
    // bypasses RLS and would restore a platform-wide read across clinics'
    // health records. Clinic-scoped access only, through context.supabase.
    files: [
      "src/lib/screening.functions.ts",
      "src/lib/sessions.functions.ts",
      "src/lib/booking-safety.functions.ts",
      "src/lib/booking-safety.server.ts",
      "src/lib/pseudonym.server.ts",
      "src/lib/platform-metrics.functions.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/integrations/supabase/client.server",
                "**/integrations/supabase/client.server",
              ],
              message:
                "Health-data paths must not use the service-role client — it bypasses RLS and re-opens cross-clinic health access. Use context.supabase (clinic-scoped).",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "supabaseAdmin",
          message: "Health-data paths must not use the service-role client.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
