import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig(
  { ignores: ["node_modules/", "build/", "lib/"] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      // Every if, else, for and while gets braces, even for one statement.
      // scripts/lint-qml.mjs holds the QML files to the same rule.
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
)
