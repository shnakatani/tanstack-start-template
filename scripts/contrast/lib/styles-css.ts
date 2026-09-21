/**
 * トークンの SSOT のパス。
 *
 * 実行口 (`scripts/contrast/report.ts`) と単体テストが同じファイルを読む。式を 2 箇所へ
 * 書くと、`src/` の外へ動かしたときに片方だけが古い場所を指し、テストは fixture を
 * 読んで緑のまま実行口だけが落ちる。色の計算 (`contrast.ts`) と引数の解釈
 * (`contrast-cli.ts`) はどちらもファイルを知らない純粋関数なので、そこへは置かない
 */

import { join } from "node:path";

import { REPO_ROOT } from "../../lib/repo-root.ts";

export const STYLES_CSS = join(REPO_ROOT, "src", "styles.css");
