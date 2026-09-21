/**
 * トークンの SSOT のパス。
 *
 * 実行口 (`scripts/contrast/report.ts`) と単体テスト (`contrast.test.ts` の「実際の
 * src/styles.css を読める」) が同じファイルを読む。式を 2 箇所へ書くと、`src/` の外へ
 * 動かしたときに直す場所が 2 つになり、片方を忘れると実行口とテストが別のファイルを見ている
 * ことに気づけない。
 *
 * 色の計算 (`contrast.ts`) と引数の解釈 (`contrast-cli.ts`) はどちらもファイルを知らない
 * 純粋関数なので、そこへは置かない
 */

import { join } from "node:path";

import { REPO_ROOT } from "../../lib/repo-root.ts";

export const STYLES_CSS = join(REPO_ROOT, "src", "styles.css");
