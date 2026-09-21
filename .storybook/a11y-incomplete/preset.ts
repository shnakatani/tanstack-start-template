import { fileURLToPath } from "node:url";

/**
 * `addon-a11y` が積んだ結果を読み直す annotation を、**`@storybook/addon-a11y` より前**に登録する
 * ための local preset (ADR-0026 の節 1)。
 *
 * 順序が要る。`afterEach` は `[project, component, story]` を `reverse()` して走らせるので
 * (`storybook/dist/preview/runtime.js` の `applyAfterEach`)、annotation の並びで先にいるものほど
 * 後に走る。`.storybook/preview.tsx` は常に最後尾なので、そこからは addon の結果を読めない。
 * `main.ts` の `previewAnnotations` も届かない。annotation の並びは「addons の順 →
 * previewAnnotations の順 → preview」で (`storybook/dist/chunk-DdLFxT9J.d.ts` の `beforeAll` の
 * docstring)、addon より後ろに入る。
 *
 * 並びが変わって addon の結果を読めなくなったら、`checkA11yIncomplete` が「レポートが無い」で
 * 落とす。無音で検査が止まらないようにしてある。
 */
export const previewAnnotations = [fileURLToPath(new URL("./preview.ts", import.meta.url))];
