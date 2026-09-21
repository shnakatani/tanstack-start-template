import { fileURLToPath } from "node:url";

/**
 * `addon-a11y` が積んだ結果を読み直す annotation を、**`@storybook/addon-a11y` より前**に登録する
 * ための local preset (ADR-0026 の節 1)。
 *
 * 順序が要る。`afterEach` は `[project, component, story]` を `reverse()` して走らせるので
 * (`storybook` の `applyAfterEach`)、annotation の並びで先にいるものほど
 * 後に走る。`.storybook/preview.tsx` は常に最後尾なので、そこからは addon の結果を読めない。
 * `main.ts` の `previewAnnotations` も届かない。annotation の並びは「addons の順 →
 * previewAnnotations の順 → preview」で (`storybook` の型が `beforeAll` の docstring に書く
 * 初期化順)、addon より後ろに入る。
 *
 * 並びが変わって addon の結果を読めなくなったら、`checkA11yIncomplete` が「レポートが無い」で
 * 落とす。**守れるのは並びだけである。** `main.ts` の `addons` からこの行を消せば何も起きず、
 * 名前が解決できなくなった場合は Storybook が `Could not resolve addon ..., skipping` を出して
 * 読み飛ばす。どちらも検査は無音で消える。
 */
export const previewAnnotations = [fileURLToPath(new URL("./preview.ts", import.meta.url))];
