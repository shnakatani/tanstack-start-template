# ADR-0011: `src/components/` を役割で分け、design system の著作と消費の境界をディレクトリで表す

- Status: Accepted
- Date: 2026-09-25
- 関連: ADR-0023 (`@shadcn/lint` のルールの選定)、ADR-0020 (registry コードの改変は許容リストで統制)、ADR-0010 (features / routes の配置の原則)、ADR-0016 (Action 層)、ADR-0018 (DataTable 部品の配置)

## Context

`src/components/` を「ドメインを跨いで共有する自作コンポーネント」と 1 つに定義すると、役割が異なる 2 種類が同じ階層に混在する。`page-header` / `data-table` / `dialog-scroll-form` / `form-fields` 等は ui 部品を組み合わせて配る部品、`route-error` / `not-found` は部品を並べて画面を組む側である。

`@shadcn/lint` の `no-restyle` は、対象を 2 軸で設定する (https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md)。

| 軸   | 設定                               | 意味                                                |
| ---- | ---------------------------------- | --------------------------------------------------- |
| 認識 | `settings.shadcn.componentImports` | どの import を design system component として見るか |
| 適用 | `overrides` の `excludeFiles`      | どこで規則を off にするか。design system 自身の内部 |

適用軸の前提は「design system 自身の内部だけを外す」ことで、著作側と消費側が同じディレクトリに混在すると、この前提をパスで表せない。`"shadcn/no-restyle": ["error", { allow: ["layout"] }]` を一時的に足して測ったところ (2026-09-19)、`src/components/` (`ui/` を除く) には 18 件の違反があった。`src/components/**` を一括で `excludeFiles` に入れる案では、このうち `screens/` に残る `route-error.tsx` の 6 件が隠れる。内訳は `CardTitle` への `text-lg` / `font-semibold` / `text-destructive` の 3 件、`AccordionTrigger` への `text-muted-foreground` (コントラストを下げる実在の欠陥) の 1 件、`ScrollArea` への `rounded` / `bg-muted` の 2 件で、規則が一括除外なしでは検出できていた欠陥である。

## Decision

**`src/components/` を役割で 5 区分し、`no-restyle` の適用外を部品ディレクトリ (`ui/`) だけにする。**

| 配置先                    | 内容                                                                                                | `no-restyle` |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------ |
| `src/components/ui/`      | shadcn 生成コンポーネントと、registry に相当が無い ui 部品 (ADR-0020)                               | 適用外       |
| `src/components/action/`  | `ui/` を包み `action` prop で Transition 化した部品 (ADR-0016)                                      | 適用する     |
| `src/components/parts/`   | ui 部品を組み合わせる自作部品。見た目の差は `ui/` の variant で持ち、ui 部品へ className で当てない | 適用する     |
| `src/components/screens/` | 部品を並べて画面を組む共有コンポーネント                                                            | 適用する     |
| `src/components/` (直下)  | 上のどれでもないもの。実例は `live-regions.tsx`                                                     | 適用する     |

適用外を `ui/` だけにするのは上流の既定の形である。shadcn-ui/lint の `docs/adoption.md` の設定例は `components/ui/**` だけで規則を外し、`docs/rules/no-restyle.md` は "Turn this rule off inside your component directory so components can style their own internals." と書く。

認識の軸 (`componentImports`) は `ui/` と `parts/` を持ち、`action/` を持たない。

- `parts/` を持つのは、`routes/` などから `parts/` の部品へ渡す `className` を検査するためである
- `action/` は見た目を持たない層なので持たない。Button を包む `ActionButton` と `ActionFormSubmit` は包みとして追跡され、Button の contract で検査される。素の `<form>` を包む `ActionForm` は素の要素と同じ扱いになる (2026-09-25 実測、`@shadcn/lint` 0.1.0)

`src/components/` の外では `.storybook/` も適用する側に置く。decorator は design system component を包んで `className` を渡す置き場になるため、`src/components/screens/` と同じ扱いにする。`vite.config.ts` の override は `files` に `src/**` と `.storybook/**` の 2 つを持つ。

`parts/` と `screens/` と直下はどれも規則が効くので、3 つの違いは lint ではなく役割だけである。部品として配るなら `parts/`、既存の部品を並べて画面を組むなら `screens/` に置く。直下を残すのは、役割を決めきれないものの置き場所を無くさないためである。

`action/` を `parts/` の下へ移さないのは、分ける軸が違うためである。`parts/` は ui 部品を組み合わせる層で、`action/` は振る舞い (Transition と pending) を与える層である。どちらも規則を適用するが、組み合わせの変更と振る舞いの変更は別の理由で起きる。

ui 部品の見た目の差をどこで持つか (既定と公式のノブ、`ui/` の variant、素の要素での包み、contract) は `docs/guides/styling-and-tokens.md`「部品の見た目を変える」にある。

### 検討した選択肢

| 案                                                                     | 評価                                                                                                                                                                                                        | 採否     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 現状維持 (フラットな `src/components/`)                                | 部品と画面の組み立てが同じ階層に混在し、`no-restyle` の適用範囲をパスで表せない                                                                                                                             | 却下     |
| `src/components/**` を丸ごと `excludeFiles`                            | 画面側の違反も一括で隠れる (2026-09-19 の実測で 18 件中 6 件、`screens/` の `route-error.tsx` に残る。`AccordionTrigger` の実在のコントラスト欠陥を含む)                                                    | 却下     |
| ecosystem の慣例に合わせて関心語で 1 段掘る (`errors/` / `layout/` 等) | BearStudio/start-ui-web、Kiranism/tanstack-start-dashboard、mugnavo/tanstarter の 3 件を `gh api` で確認 (2026-09-19)。いずれも著作/消費の役割分割を持たない。前例が無いことは分けない根拠にはならない      | 不採用   |
| 上流 README の形 (トップレベル `rules` + 著作側の override で `"off"`) | 規則を off にする形は、適用範囲の宣言と違反の緩和を設定の字面で区別できない。ADR-0020 が分ける違反の抑制 (行単位) と適用範囲 (`excludeFiles`) の区別に外れる                                                | 却下     |
| `ui/` `action/` `parts/` `screens/` + 直下の 5 区分                    | 認識 (`componentImports`) と適用 (`excludeFiles`) の両軸をディレクトリ境界で表現できる                                                                                                                      | **採用** |
| 適用外を `ui/` だけにする                                              | 上流 `docs/adoption.md` の設定例の形で、Hephaestus、nocturne、Jovie、t3code も部品ディレクトリだけを外す (2026-09-25 確認)。`parts/` の中の見た目の上書きも診断され、見た目の差が `ui/` の variant に集まる | **採用** |
| 適用外を `ui/` `action/` `parts/` にする                               | `parts/` の中で ui 部品への見た目の上書きが無診断で通り、見た目が `ui/` の variant に集まらない。合成部品も部品ディレクトリへ同居させて丸ごと外す stella がこの形に近い (2026-09-25 確認)                   | 却下     |

## Consequences

- 恒久的な例外はゼロになる。`excludeFiles` に書くのは `ui/` の 1 行で、層の宣言であって違反の抑制ではない。違反が増えても行は増えない
- 規則の有効化は `vite.config.ts` が持ち、適用範囲の決定はこの ADR が持つ。層の増減は両方を動かす
- `parts/` で ui 部品の見た目を変えたくなったら、`ui/` の variant を足す。registry からの乖離になるので、台帳 `docs/registry-deviations.md` に行が増える (ADR-0020)
- **機械で止まらない誤りが 1 つ残る。** ui 部品にあるものを素の要素で作り直すと、規則は効かない。`no-restyle` は認識した design system component だけを見る (`no-restyle.md` の Limits)。レビューで見る
- ドメイン固有の見た目を持つ共有部品の置き場所は未定義。現時点で該当は無く、出てきた時点で `parts/` に置くか `src/features/<domain>/` 側の扱いとするかを決める (ADR-0010)

## 出典

- shadcn-ui/lint「no-restyle」(部品ディレクトリで規則を off にする案内と、Limits): https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md
- shadcn-ui/lint「Adoption」(`components/ui/**` だけを外す設定例): https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md
- shadcn-ui/lint「Rules」(`componentImports` の設定): https://github.com/shadcn-ui/lint/blob/main/docs/rules.md
- Hephaestus (`webapp/.oxlintrc.json`): https://github.com/hephaestus-build/Hephaestus/blob/main/webapp/.oxlintrc.json
- nocturne (`src/Web/packages/app/eslint.config.js`): https://github.com/nightscout/nocturne/blob/main/src/Web/packages/app/eslint.config.js
- Jovie (`apps/web/eslint.config.js`): https://github.com/JovieInc/Jovie/blob/main/apps/web/eslint.config.js
- t3code (`vite.config.ts`): https://github.com/pingdotgg/t3code/blob/main/vite.config.ts
- stella (`oxlint.config.ts`): https://github.com/stella/stella/blob/main/oxlint.config.ts
- BearStudio/start-ui-web: https://github.com/BearStudio/start-ui-web
- Kiranism/tanstack-start-dashboard: https://github.com/Kiranism/tanstack-start-dashboard
- mugnavo/tanstarter: https://github.com/mugnavo/tanstarter
