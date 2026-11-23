# Tailwind と shadcn の lint

`@shadcn/lint` のルールを層の境界に当てるとき、`ui/` の variant 関数を `ui/` の外で呼ぶとき、時間と警告を読むときの手順と、その理由を持つ。

| 決定                                                                                      | ADR      |
| ----------------------------------------------------------------------------------------- | -------- |
| `src/components/` を役割で分け、design system の著作と消費の境界をディレクトリで表す      | ADR-0011 |
| design system の層から外へ class 文字列を配らず、共有する外見は部品・prop・variant で配る | ADR-0022 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める                     | ADR-0023 |

## how-to

### `require-static-classes` を層の境界で有効にする

`shadcn/require-static-classes` は `tooling/lint/config.ts` の `overrides` で、`no-restyle` と同じ `files` / `excludeFiles` の組に相乗りさせる (ADR-0022)。境界そのものは ADR-0011 が決める。理由は「`require-static-classes` を層の境界に限る理由」にある。

- 規則を `overrides` から消しても `off` にしても `vp lint` と `vp check` は通る。この override のルールは解決後設定に出るため、`scripts/checks/integrity/lint-config.test.ts` が規則名と severity を固定する

### `ui/` の variant 関数を外で呼ぶ

`ui/` が export した variant 関数 (`buttonVariants` など) を `ui/` の外で呼ぶときは、次に従う。規則がどの書き方を読むかは [shadcn-ui/lint docs「require-static-classes」][] の Variant functions と Limits、`settings.shadcn` の各設定の意味は [shadcn-ui/lint docs「Settings」][] が持つ。

- 書き足す class は `cn(buttonVariants({ variant }), "mt-4")` のように `cn()` の引数に書く。`buttonVariants({ variant, className: "mt-4" })` のキーには書かない。linter が class を読む呼び出しは `cn` などの組み込みと登録した関数に限られ ([shadcn-ui/lint docs「How it works」][] の Where it looks)、キーの値は読まれない。色と未知 class の検査から外れても診断は出ない
- 戻り値を design system component (`ui/` `action/` `parts/` の部品と、その `render` に渡す要素) の `className` へ渡すと、import した関数の呼び出しは読めないので `require-static-classes` が落とす ([shadcn-ui/lint docs「require-static-classes」][] の Variant functions、[shadcn-ui/lint#178][])
- `settings.shadcn.variantFunctions` と `mergeFunctions` へ variant 関数を登録しない (ADR-0023)。案の比較は「`variantFunctions` へ宣言しない理由」にある

### `@shadcn/lint` の時間と警告を読む

- JS plugin は lint の時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して、2 回目同士を比べる。1 回目には解決のコストが乗る
- theme と component の探索に失敗すると、`vp lint` の出力に `[@shadcn/lint]` の警告が出る (2026-09-19 に実測)。`components.json` の `tailwind.css` が無いパスなら代わりの stylesheet を使う旨、Tailwind を import する stylesheet が無ければ `no-raw-colors` が宣言済みの token を確かめられない旨、`ui` alias がディレクトリに解決しなければ design system component を認識しない旨を報告する。3 ルールは警告を出したまま発火し続け、診断の token の提案が減る

## explanation

### `require-static-classes` を層の境界に限る理由

design system 自身の内部では、消費側の上書きを見る規則も、消費側の `className` を読める形に保つ規則も意味を持たない。落ちた `className` は `no-raw-colors` と `no-unknown-classes` も中身を読めないので、層の外では規則が他の shadcn ルールの門番になる。読める渡し方は [shadcn-ui/lint docs「require-static-classes」][] の Examples と Limits、読めない範囲は [shadcn-ui/lint docs「How it works」][] の What it cannot see にある。

### `variantFunctions` へ宣言しない理由

| 案                                                              | 評価                                                                                                                                                                                                                                                                                | 採否     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 書き足す class を `cn()` の引数に書き、variant 関数は登録しない | `cn` は組み込みの class 関数で、引数の class が検査される ([shadcn-ui/lint docs「How it works」][] の Where it looks)。shadcn/ui の例にも同じ形がある ([shadcn の `calendar-hijri.tsx`][])                                                                                          | **採用** |
| `buttonVariants` などを `variantFunctions` へ宣言する           | 上流はこの設定を "Adds functions whose object values contain classes." と書き、組み込みの variant 関数に `cva` と `tv` を挙げる ([shadcn-ui/lint docs「Settings」][])。定義の object に class を書く `cva` のような関数を足す設定で、`cva` が返した関数を宣言する用法は docs に無い | 却下     |
| variant 関数を `mergeFunctions` へ登録する                      | 上流は "Only register helpers whose arguments accurately describe their output." と求める ([shadcn-ui/lint docs「require-static-classes」][] の Custom class helpers)。variant 関数の引数の object は variant の名前を持ち、出力の class を表さない                                 | 却下     |

- shadcn/ui の例には、書き足す class を `className` キーに書くものもある ([shadcn の `collapsible-example.tsx`][])。このテンプレートではキーの値が検査されないので、写すときは `cn()` の引数へ移す
- 規則を採用しない案の比較は ADR-0022 にある

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[shadcn-ui/lint docs「require-static-classes」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/docs/rules/require-static-classes.md
[shadcn-ui/lint docs「Settings」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/README.md#settings
[shadcn-ui/lint docs「How it works」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/docs/how-it-works.md
[shadcn-ui/lint#178]: https://github.com/shadcn-ui/lint/issues/178
[shadcn の `calendar-hijri.tsx`]: https://github.com/shadcn-ui/ui/blob/shadcn@4.21.0/apps/v4/examples/base/calendar-hijri.tsx
[shadcn の `collapsible-example.tsx`]: https://github.com/shadcn-ui/ui/blob/shadcn@4.21.0/apps/v4/registry/bases/aria/examples/collapsible-example.tsx
