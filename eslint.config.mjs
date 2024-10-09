import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ["build/*"]
    }
];
