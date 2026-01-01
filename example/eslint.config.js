import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // const を優先
      "prefer-const": "error",
      // var 禁止
      "no-var": "error",
      // 未使用変数
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // any は警告
      "@typescript-eslint/no-explicit-any": "warn",
      // console.log は許可
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/", "workspace/", "*.js"],
  }
);
