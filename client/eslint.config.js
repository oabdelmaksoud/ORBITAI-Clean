import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
    { ignores: ["dist", "node_modules", "*.config.js", "*.config.ts"] },
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2022,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            // === STRICT RULES ===
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],

            // React Hooks Rules (CRITICAL - prevents Rule of Hooks errors)
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",

            // React Refresh
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

            // TypeScript rules
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-non-null-assertion": "warn",

            // General quality
            "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
            "prefer-const": "warn",
            "no-var": "error",

            // Disable overly strict rules for existing codebase
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-empty-object-type": "off",
        },
    }
);
