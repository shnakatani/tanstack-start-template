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

- 書き足す class は `cn(buttonVariants({ variant }), "mt-4")` のように `cn()` の引数に書く。`buttonVariants({ variant, className: "mt-4" })` のキーには書かない。キーの値は検査されず、色と未知 class の検査から外れても診断は出ない。理由は「`cn()` の引数に書く理由」にある
- 戻り値を design system component (`ui/` `action/` `parts/` の部品) の `className` か、部品の `render` に渡して部品として判定される要素 (`<Button render={<Link />}>` の `Link` など) の `className` へ渡すと、import した関数の呼び出しは読めないので `require-static-classes` が落とす ([shadcn-ui/lint docs「require-static-classes」][] の Variant functions、[shadcn-ui/lint#178][])。class を足さない部品 (`PopoverTrigger` など) の `render` に渡した素の要素は判定されない ([@shadcn/lint の CHANGELOG][] の 0.2.5)
- 落ちたときは、アプリの route へのリンクなら `ButtonLink` (`src/components/parts/button-link.tsx`) を使う。受けた `ref` と props を描く `<a>` へ渡すので、部品の `render` にも渡せる。外部へのリンクなら素の `<a>` に `buttonVariants` を当てる ([shadcn docs「Button」][] の As Link の "Use `buttonVariants` with a plain `<a>` tag instead.")
- `settings.shadcn.variantFunctions` と `mergeFunctions` へ variant 関数を登録しない (ADR-0023)

### `@shadcn/lint` の時間と警告を読む

- JS plugin は lint の時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して、2 回目同士を比べる。1 回目には解決のコストが乗る
- theme と component の探索に失敗すると、`vp lint` の出力に `[@shadcn/lint]` の警告が出る (2026-09-19 に実測)。`components.json` の `tailwind.css` が無いパスなら代わりの stylesheet を使う旨、Tailwind を import する stylesheet が無ければ `no-raw-colors` が宣言済みの token を確かめられない旨、`ui` alias がディレクトリに解決しなければ design system component を認識しない旨を報告する。3 ルールは警告を出したまま発火し続け、診断の token の提案が減る

## explanation

### `require-static-classes` を層の境界に限る理由

design system 自身の内部では、消費側の上書きを見る規則も、消費側の `className` を読める形に保つ規則も意味を持たない。落ちた `className` は `no-raw-colors` と `no-unknown-classes` も中身を読めないので、層の外では規則が他の shadcn ルールの門番になる。読める渡し方は [shadcn-ui/lint docs「require-static-classes」][] の Examples と Limits、読めない範囲は [shadcn-ui/lint docs「How it works」][] の What it cannot see にある。規則を採用しない案の比較は ADR-0022 にある。

### `cn()` の引数に書く理由

- linter が class を読む呼び出しは、`cn` などの組み込みの関数と `settings.shadcn` に登録した関数に限られる ([shadcn-ui/lint docs「How it works」][] の Where it looks)。variant 関数は登録しないので (ADR-0023)、その引数の object に書いた class は読まれない
- shadcn/ui の例は両方の形を使う。[shadcn の `calendar-hijri.tsx`][] は `cn()` の引数に書き、[shadcn の `collapsible-example.tsx`][] は `className` キーに書く。キーの形を写すときは `cn()` の引数へ移す

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[shadcn-ui/lint docs「require-static-classes」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/docs/rules/require-static-classes.md
[shadcn-ui/lint docs「Settings」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/README.md#settings
[shadcn-ui/lint docs「How it works」]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/docs/how-it-works.md
[shadcn-ui/lint#178]: https://github.com/shadcn-ui/lint/issues/178
[@shadcn/lint の CHANGELOG]: https://github.com/shadcn-ui/lint/blob/%40shadcn/lint%400.2.5/packages/lint/CHANGELOG.md
[shadcn docs「Button」]: https://ui.shadcn.com/docs/components/base/button
[shadcn の `calendar-hijri.tsx`]: https://github.com/shadcn-ui/ui/blob/shadcn@4.21.0/apps/v4/examples/base/calendar-hijri.tsx
[shadcn の `collapsible-example.tsx`]: https://github.com/shadcn-ui/ui/blob/shadcn@4.21.0/apps/v4/registry/bases/aria/examples/collapsible-example.tsx
