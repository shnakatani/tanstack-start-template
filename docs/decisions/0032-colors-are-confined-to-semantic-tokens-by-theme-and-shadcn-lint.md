# ADR-0032: 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0009 (lint ルールの選定基準)、ADR-0026 (行単位の抑制の許容リスト)、ADR-0013 (`no-restyle` の適用範囲)、ADR-0031 (`require-static-classes` と variant 関数の宣言)、ADR-0010 (`eslint` を必須 peer に持つもう 1 つの経路)

## Context

色は semantic token だけに保ちたい。Tailwind は既定 palette の class を CSS として生成するので、palette 色や任意値の色を書けば画面にそのまま出る。

## Decision

色を semantic token だけに保つ統制は 2 層で行い、lint はその 2 層目である。

| 層  | 場所                                                | 担うもの                                                         |
| --- | --------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `src/styles.css` の `@theme` (`--color-*: initial`) | 既定 palette を生成から外す。CSS が出ないので画面にも出ない      |
| 2   | `@shadcn/lint` の 3 ルール                          | 未知 class、palette・raw color、arbitrary color を記述時に落とす |

1 層目だけだと違反は「無言で効かない class」になり、2 層目だけだと既定 palette の CSS 生成を止められない。

oxlint は Tailwind と shadcn/ui 領域のルールをネイティブに持たないため、`jsPlugins` で `@shadcn/lint` を読み込む。
`components.json` の UI alias と theme CSS を自動探索できるため、同じ値を `settings.shadcn` へ複製しない。
`settings.shadcn.componentImports` はこの探索結果の書き直しではなく、`ui` alias の外側にある自作部品 (`parts/` 等) まで design system component として認識させる追加である (ADR-0013)。

| 有効にしたルール                | 見るもの                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `shadcn/no-unknown-classes`     | theme から生成されない class と未知 variant                                                       |
| `shadcn/no-raw-colors`          | palette class、未定義 semantic color token、SVG の raw color                                      |
| `shadcn/no-arbitrary-values`    | `deny: ["color"]` で arbitrary color だけを禁止し、非色の arbitrary value は許可する              |
| `shadcn/no-restyle`             | design system component への `className` 上書き。`allow: ["layout"]` で layout だけ通す           |
| `shadcn/require-static-classes` | design system component へ渡す className が静的に読めるか。読めないと他ルールが中身を検査できない |

`no-raw-colors` は `bg-[#333]` のような arbitrary color を検査しないため、`no-arbitrary-values` と対で使う。
`no-raw-colors` は class だけでなく `fill` / `stroke` など SVG 属性の raw color も見る。移行前の 2 ルールに無かった検査で、統制の範囲はここだけ広がる。
`no-arbitrary-values` は `color-mix()` の材料が semantic token だけでも color category と判定する。raw color を持たず dark mode に追従する既存表現は、行単位で抑制し ADR-0026 の許容リストへ記録する。
`no-restyle` は 2026-09-19 に ADR-0013 の層の決定と対で、`require-static-classes` は同日に ADR-0031 の配り方の決定と対で採用した。
`require-static-classes` は `no-restyle` と同じ `overrides` に相乗りし、`settings.shadcn.variantFunctions` で `cva` 由来の variant 関数を宣言する。
宣言が要る理由と `mergeFunctions` を使わない理由は ADR-0031 が持つ。
`no-inline-styles` は対になる設計判断がまだ無いため有効化しない。

`@shadcn/lint` は上流の `recommended` を持たない。ルールは設計判断と対にして 1 つずつ名指しし、まとめて有効にしない。

`jsPlugins` のエントリは `{ name, specifier }` の形で書き、`@shadcn/lint` には `{ name: "shadcn", specifier: "@shadcn/lint" }` を使う。
plugin 本体の `meta.name`、診断コード、rule key、抑制 directive が `shadcn` を共有する。
`rules` のキーに別名 (`@shadcn/lint/no-raw-colors`) を書くと設定のパースが `Plugin '@shadcn/lint' not found` で落ちる。
一方、抑制 directive は未登録の名前を書いてもエラーにならず、ただ効かない (2026-09-19 に Oxlint 1.82.0 で実測)。名前を揃えないと、rule は有効なまま抑制だけが無言で外れる。
JS plugin は lint 時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して 2 回目同士を比べる (1 回目には解決のコストが乗る)。

3 ルールの発火は `--print-config` に出ないため、次を一時ファイルへ置いて `vp lint <path>` を走らせ、3 行とも診断が出たら消す。

```tsx
export function Probe() {
  return (
    <div>
      <span className="bg-blue-500" /> {/* no-raw-colors */}
      <span className="bg-[#333]" /> {/* no-arbitrary-values */}
      <span className="not-a-real-class" /> {/* no-unknown-classes */}
    </div>
  );
}
```

theme と component の探索に失敗したときは、`vp lint` の出力へ `[@shadcn/lint]` の警告が出る。
`components.json` の `tailwind.css` が存在しないパスなら代替の stylesheet を使う旨、Tailwind を import する stylesheet が 1 つも無ければ `no-raw-colors` が宣言済み token を確認できない旨、`ui` alias がディレクトリに解決しなければ design-system component を認識しない旨をそれぞれ報告する (2026-09-19 に実測)。
3 ルールは警告を出したうえで発火し続け、診断から token の提案が減る。silent failure ではないので、この解決を見張る検査は置かない。

### 検討した選択肢

| 案                                 | 評価                                                                                                                        | 採否     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| `@shadcn/lint`                     | Tailwind CSS v4、`components.json`、theme CSS、shadcn component を理解し、色の統制を 3 つの専用 rule へ分けられる           | **採用** |
| `eslint-plugin-better-tailwindcss` | 未知 class と正規表現による arbitrary color 検査はできるが、shadcn component と semantic token を専用モデルで扱わない       | 却下     |
| `eslint-plugin-tailwindcss`        | Tailwind v4 には対応するが peerDependencies は `eslint` だけで、oxlint 経由の利用を上流が想定していない (2026-08-17 に確認) | 却下     |
| 自前の正規表現でソースを走査する   | 字面しか見ないため theme の実体と乖離し、任意値の中身も読めない                                                             | 却下     |

## Consequences

- `jsPlugins` は alpha 扱いで semver の対象外だと oxlint 側が明記している。oxlint の更新で読み込み方が変わりうるため、追随の発火条件は Dependabot PR の処理時とする。確認するのは plugin の読み込みと 3 ルールの発火の両方である
- 3 ルールが発火していることを機械で見張るものは無い。`--print-config` の top-level `rules` に JS plugin 由来のルールが出ないため、`rules` から 3 行を消しても `"off"` にしても整合性テストと `vp check` は通る。確認は Decision の probe を一時ファイルへ置いて `vp lint <path>` を走らせる手動の手順になる
- `overrides` に置いた JS plugin 由来のルールは解決後設定に出るため、`scripts/checks/integrity/lint-config.test.ts` が規則名と severity を固定している。top-level の 3 ルールとは扱いが違う (ADR-0031)
- `no-arbitrary-values` は `color-mix()` の材料を区別しない。token だけを混ぜる表現にも行単位の抑制が要り、抑制は class 文字列の行全体に効く。抑制した行へ後から色の任意値を足すと無言で通る
- `@shadcn/lint` は `@typescript-eslint/parser` を実依存に持つが、oxlint 経由では読まない。この経路の eslint peer は `pnpm-workspace.yaml` の `packageExtensions` で optional にして止める。ただし `eslint` がグラフから消えるわけではない。`eslint-plugin-testing-library` が `@typescript-eslint/utils` 経由で `eslint` を必須 peer に持ち、そちらは止まらない (ADR-0010)
- parser の `typescript` peer (`>=4.8.4 <6.1.0`) が Vite+ の `^5.0.0 || ^6.0.0 || ^7.0.0` の上限を押さえるため、依存グラフの `typescript` は 6 系になる。型検査は tsgolint が担う (ADR-0005) ため `vp check` の結果は変わらない
- 依存グラフへ `typescript` を持ち込むのはこの parser である。`@shadcn/lint` を外した fresh resolve では `typescript` 自体が入らない (2026-09-19 確認)
- eslint peer の optional 化と `typescript` の 6 系固定は撤去条件が同じで、上流が parser を optional peer へ移すこと (shadcn-ui/lint#1)。移れば `packageExtensions` は不要になるが、`eslint` は `eslint-plugin-testing-library` 経由で残る。撤去で解けるのは `typescript` の 6 系固定だけである
- parser と `oxc-parser` のどちらも解決できないと、`@shadcn/lint` は cross-file 解析だけを無警告で失う。呼び出し元が parser のエラーを握りつぶすためで、ルールは動き続ける。診断の提案文言が縮むことでしか気付けない (shadcn-ui/lint#1)
- theme に無いクラスを全て落とすため、`src/styles.css` へ token を足す前に utility を書くと lint で止まる。順序は token の定義が先になる
- `settings.shadcn.componentImports` を消すと自作部品が規則から見えなくなり、routes からの上書きが素通りする。`--print-config` に JS plugin 由来の設定は出ないため無言で効かなくなる
- `no-restyle` の適用範囲はディレクトリで決まる (ADR-0013)。画面の組み立てを `parts/` へ置くと規則が効かない。機械では止まらない

## 出典

- oxlint の JS plugins (alpha 扱いと `{ name, specifier }` の指定形): https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- `@shadcn/lint` の setup と rule 一覧: https://github.com/shadcn-ui/lint/blob/main/SETUP.md
- 使われない `@typescript-eslint/parser` が ESLint と typescript を連れてくる件: https://github.com/shadcn-ui/lint/issues/1
- pnpm の `packageExtensions` (依存の manifest へ `peerDependenciesMeta` を後付けする): https://pnpm.io/settings/dependency-resolution
- Tailwind CSS の既定 palette を差し替える手順 (`--color-*: initial`): https://tailwindcss.com/docs/colors
- eslint-plugin-better-tailwindcss: https://github.com/schoero/eslint-plugin-better-tailwindcss
