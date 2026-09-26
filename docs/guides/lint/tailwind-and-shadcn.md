# Tailwind と shadcn の lint

`@shadcn/lint` のルールを層の境界に当てるとき、variant 関数を宣言するとき、時間と警告を読むときの手順と、その理由を持つ。

| 決定                                                                                      | ADR      |
| ----------------------------------------------------------------------------------------- | -------- |
| `src/components/` を役割で分け、design system の著作と消費の境界をディレクトリで表す      | ADR-0011 |
| design system の層から外へ class 文字列を配らず、共有する外見は部品・prop・variant で配る | ADR-0022 |

## how-to

### `require-static-classes` を層の境界で有効にする

`shadcn/require-static-classes` は `vite.config.ts` の `overrides` で、`no-restyle` と同じ `files` / `excludeFiles` の組に相乗りさせる (ADR-0022)。境界そのものは ADR-0011 が決める。理由は「`require-static-classes` を層の境界に限る理由」にある。

- 規則を `overrides` から消しても `off` にしても `vp lint` と `vp check` は通る。この override のルールは解決後設定に出るため、`scripts/checks/integrity/lint-config.test.ts` が規則名と severity を固定する

### variant 関数を宣言する

`cva` で作った variant 関数を消費側から呼ぶ形を採ったら、`vite.config.ts` の `settings.shadcn.variantFunctions` へ宣言する。宣言しないと、shadcn/ui の Button docs が「As Link」で推奨する `className={buttonVariants(...)}` の形が `require-static-classes` で落ちる。テンプレートの利用者が公式どおり書いて lint が止まるのは不備になる。

- 宣言は違反を黙らせる例外ではなく、variant 関数が何かを linter へ伝える設定である。`componentImports` と同じ恒久設定として扱う
- 宣言するのは `ui/` が定義し、消費側から呼ぶ variant 関数に限る。`ui/` の内側でしか呼ばない関数は規則に当たらない
- `mergeFunctions` へは登録しない。`ui/` の外の `cva` も宣言しない。登録先による違いは次のとおり

| 登録先                                     | variant 関数の呼び出しの扱い                                                                                                                                                                                 | 採否     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `variantFunctions` (`ui/` の variant 関数) | 解決され、pass-through の `className` が `no-raw-colors` / `no-unknown-classes` に読まれる (2026-09-19 実測)                                                                                                 | **採用** |
| `mergeFunctions`                           | 解決されるが、渡したオブジェクトのキー名 (`variant` / `className`) を class と誤読し、`no-restyle` と `no-unknown-classes` が誤報する (2026-09-19 実測)                                                      | 却下     |
| `variantFunctions` (`ui/` の外の `cva`)    | 呼び出しは `require-static-classes` を通るが、定義の中の class は `no-restyle` に検査されない。宣言前は `require-static-classes` が落とし、宣言後は指摘 0 件になった (2026-09-25 実測、`@shadcn/lint` 0.1.0) | 却下     |

- `variantFunctions` を消すと variant 関数の呼び出しが落ちる。`vp lint --print-config` に `settings.shadcn` が出ないため (2026-09-19 実測)、宣言が消えたことを機械で見張るものは無い (`docs/guides/lint/custom-rules.md`「JS plugin の落とし穴」)

### `@shadcn/lint` の時間と警告を読む

- JS plugin は lint の時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して、2 回目同士を比べる。1 回目には解決のコストが乗る
- theme と component の探索に失敗すると、`vp lint` の出力に `[@shadcn/lint]` の警告が出る (2026-09-19 に実測)。`components.json` の `tailwind.css` が無いパスなら代わりの stylesheet を使う旨、Tailwind を import する stylesheet が無ければ `no-raw-colors` が宣言済みの token を確かめられない旨、`ui` alias がディレクトリに解決しなければ design system component を認識しない旨を報告する。3 ルールは警告を出したまま発火し続け、診断の token の提案が減る

## explanation

### `require-static-classes` を層の境界に限る理由

design system 自身の内部では、消費側の上書きを見る規則も、消費側の `className` を読める形に保つ規則も意味を持たない。落ちた `className` は `no-raw-colors` と `no-unknown-classes` も中身を読めないので、層の外では規則が他の shadcn ルールの門番になる。読める渡し方は「`require-static-classes` が読む className」にある。

### `require-static-classes` が読む className

規則を有効にした状態で `src/routes/` へ probe を置き、`vp lint <probe>` で測った (2026-09-19、`@shadcn/lint` 0.1.0)。

| 消費側の書き方                              | `require-static-classes` | 中身が他の規則に読まれるか                                                                                         |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 静的な文字列                                | 通る                     | 読まれる                                                                                                           |
| 同一ファイル内の `const` (再代入なし)       | 通る                     | 読まれる                                                                                                           |
| `cn()` の引数                               | 通る                     | 読まれる                                                                                                           |
| 他ファイルから import した `const`          | 落ちる                   | 読まれない                                                                                                         |
| 関数呼び出しの戻り値                        | 落ちる                   | 読まれない                                                                                                         |
| `variantFunctions` へ宣言した関数の呼び出し | 通る                     | 呼び出しに渡した `className` は読まれる。`cva` の定義の中の class は `no-restyle` に検査されない (2026-09-25 実測) |

- 同じ文字列 (`flex min-h-0 flex-col gap-6`) を 2 通りで渡すと差が出る。同一ファイルの `const` として渡すと含まれる `gap-6` に `no-restyle` が出るが、import した `const` として渡すと `require-static-classes` だけが出て中身の診断は消える
- ファイルを跨いだ定数が解決されないのは実装上の制約である。`node_modules/@shadcn/lint/dist/index.js` の `resolveIdentifier` は、変数の定義が `Variable` 型でなければ解決を打ち切る (`def.type !== "Variable"`)。import 束縛はこの型を持たない
- 規則を採用しない案の比較は ADR-0022 にある。`variantFunctions` を宣言しない案は、shadcn/ui が推奨する形が書けず、テンプレートの利用者が公式どおり書くと lint が止まるので却下した (shadcn/ui「Button」: https://ui.shadcn.com/docs/components/button)
