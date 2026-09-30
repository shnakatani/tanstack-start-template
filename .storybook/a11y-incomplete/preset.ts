import { fileURLToPath } from "node:url";

/**
 * `addon-a11y` が積んだ結果を読み直す annotation を、`@storybook/addon-a11y` より前に登録する local preset (ADR-0028)。
 * `main.ts` の `previewAnnotations` は addons より後ろに並ぶ (`storybook` の型の `beforeAll` の docstring) ので使えない。
 * 並びが変わると `checkA11yIncomplete` が「レポートが無い」で落とす。`main.ts` の `addons` からこの行が消えたときと、
 * 名前が解決できず Storybook が `Could not resolve addon ..., skipping` で読み飛ばしたときは、検査が無音で消える。
 */
export const previewAnnotations = [fileURLToPath(new URL("./preview.ts", import.meta.url))];
