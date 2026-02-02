const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettier = require("eslint-plugin-prettier");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**", ".serverless/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier,
    },
    rules: {
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "no-var": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "prettier/prettier": "error",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-async-promise-executor": "warn",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
