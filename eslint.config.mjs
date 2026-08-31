import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".venv/**",
    ".pytest_cache/**",
    "node_modules/**",
    "out/**",
    "coverage/**",
    "data/**",
    "next-env.d.ts",
  ]),
]);
