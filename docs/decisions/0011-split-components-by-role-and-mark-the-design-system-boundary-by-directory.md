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

適用軸の前提は「design system 自身の内部だけを外す」ことで、著作側と消費側が同じディレクトリに混在すると、この前提をパスで表せない。`"shadcn/no-restyle": ["error", { allow: ["layout"] }]` を一時的に足して測ったところ (2026-09-19)、`src/components/` (`ui/` を除く) には 18 件の違反があった。`src/components/**` を一括で `excludeFiles` に入れる案では、このうち `screens/` に残る `route-error.tsx` の 6 件が隠れる。内訳は `CardTitle` への `text-lg` / `font-semibold` / `text-destructive` の 3 件、`AccordionTrigger` への `text-muted-foreground` (コントラストを下げる実在の欠陥) の 1 件、`ScrollArea` への `rounded` / `bg-muted` の 2 件である。このうち `ScrollArea` の `rounded` は下の Decision の contract で許す。残る 5 件は、規則が一括除外なしでは検出できていた欠陥である。

## Decision

**`src/components/` を役割で 5 区分し、`no-restyle` の適用外を部品ディレクトリ (`ui/`) だけにする。**

| 配置先                    | 内容                                                                                                | `no-restyle` |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------ |
| `src/components/ui/`      | shadcn 生成コンポーネントと、registry に相当が無い ui 部品 (ADR-0020)                               | 適用外       |
| `src/components/action/`  | `ui/` を包み `action` prop で Transition 化した部品 (ADR-0016)                                      | 適用する     |
| `src/components/parts/`   | ui 部品を組み合わせる自作部品。見た目の差は `ui/` の variant で持ち、ui 部品へ className で当てない | 適用する     |
| `src/components/screens/` | 部品を並べて画面を組む共有コンポーネント                                                            | 適用する     |
| `src/components/` (直下)  | 上のどれでもないもの。実例は `live-regions.tsx`                                                     | 適用する     |

適用外の範囲を `ui/` だけにするのは上流の既定の範囲である。書き方は上流と違い、規則を `"off"` にせず `excludeFiles` で外す (下の比較表)。shadcn-ui/lint の `docs/adoption.md` の設定例は `components/ui/**` だけで規則を外し、`docs/rules/no-restyle.md` は "Turn this rule off inside your component directory so components can style their own internals." と書く。

認識の軸 (`componentImports`) は `ui/` と `parts/` を持ち、`action/` を持たない。

- `parts/` を持つのは、`routes/` などから `parts/` の部品へ渡す `className` を検査するためである
- `action/` は見た目を持たない層なので持たない。Button を包む `ActionButton` と `ActionFormSubmit` は包みとして追跡され、Button の contract で検査される。素の `<form>` を包む `ActionForm` は素の要素と同じ扱いになる (2026-09-25 実測、`@shadcn/lint` 0.1.0)

`src/components/` の外では `.storybook/` も適用する側に置く。decorator は design system component を包んで `className` を渡す置き場になるため、`src/components/screens/` と同じ扱いにする。`vite.config.ts` の override は `files` に `src/**` と `.storybook/**` の 2 つを持つ。

`parts/` と `screens/` と直下は、どれもファイルの中が `no-restyle` に検査される。違うのは、`componentImports` が持つのは `parts/` だけで、消費側が渡す `className` が部品として検査されるのは `parts/` の部品に限ることである。`screens/` の部品が受けた `className` を `<Button>` へそのまま転送すると、消費側が渡した `bg-muted` と `rounded-full` は包みとして追跡され、Button の `no-restyle` で落ちた (2026-09-25 実測、`@shadcn/lint` 0.1.0)。`screens/` や直下の部品が転送せず素の要素に当てる `className` は、`no-restyle.md` の Limits のとおり対象外になる (`parts/` の部品が受けた `className` は、転送するかどうかによらず検査される)。部品として配るなら `parts/`、既存の部品を並べて画面を組むなら `screens/` に置く。直下を残すのは、役割を決めきれないものの置き場所を無くさないためである。

`action/` を `parts/` の下へ移さないのは、分ける軸が違うためである。`parts/` は ui 部品を組み合わせる層で、`action/` は振る舞い (Transition と pending) を与える層である。どちらも規則を適用するが、組み合わせの変更と振る舞いの変更は別の理由で起きる。

ui 部品の見た目の差をどこで持つか (既定と公式のノブ、`ui/` の variant、素の要素での包み、contract) は `docs/guides/styling-and-tokens.md`「部品の見た目を変える」にある。

`ScrollArea` には contract `{ pattern: "^ScrollArea$", allow: ["layout", "rounded"] }` を置き、呼び出し側に class グループ `rounded` だけを許す。Viewport は `rounded-[inherit]` で Root の角丸を受け継ぎ、その角丸で中身と focus ring を切り抜く。切り抜く角丸は置かれた器に合わせて決まるので、`ui/` で 1 つに固定できない。地の色と枠線は器が、余白は中身の要素が持つ。余白を許さないのは、Root が既定で持つ `data-has-overflow-y:pr-2.5` が属性つきセレクタで呼び出し側の `p-*` に詳細度で勝ち、Root に余白を当てると溢れたときだけ右の余白が変わるためである。contract は `className` と `viewportClassName` を区別しないので、許す範囲は両方に効く。2026-09-25 に `@shadcn/lint` 0.1.0 で測ると、`rounded` と `rounded-md` は通り、`rounded-t-md`・`outline-none`・`ring-2`・`gap-2`・`p-4`・`border`・`bg-muted` は指摘された。

### 検討した選択肢

| 案                                                                                      | 評価                                                                                                                                                                                                                                                                    | 採否     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 現状維持 (フラットな `src/components/`)                                                 | 部品と画面の組み立てが同じ階層に混在し、`no-restyle` の適用範囲をパスで表せない                                                                                                                                                                                         | 却下     |
| `src/components/**` を丸ごと `excludeFiles`                                             | 画面側の違反も一括で隠れる (2026-09-19 の実測で 18 件中 6 件、`screens/` の `route-error.tsx` に残る。`AccordionTrigger` の実在のコントラスト欠陥を含む)                                                                                                                | 却下     |
| ecosystem の慣例に合わせて関心語で 1 段掘る (`errors/` / `layout/` 等)                  | BearStudio/start-ui-web、Kiranism/tanstack-start-dashboard、mugnavo/tanstarter の 3 件を `gh api` で確認 (2026-09-19)。いずれも著作/消費の役割分割を持たない。前例が無いことは分けない根拠にはならない                                                                  | 不採用   |
| 上流 README の形 (トップレベル `rules` + 著作側の override で `"off"`)                  | 規則を off にする形は、適用範囲の宣言と違反の緩和を設定の字面で区別できない。ADR-0020 が分ける違反の抑制 (行単位) と適用範囲 (`excludeFiles`) の区別に外れる                                                                                                            | 却下     |
| `ui/` `action/` `parts/` `screens/` + 直下の 5 区分 (区分のみ。適用外の範囲は下の 2 行) | 認識 (`componentImports`) と適用 (`excludeFiles`) の両軸をディレクトリ境界で表現できる                                                                                                                                                                                  | **採用** |
| 適用外を `ui/` だけにする                                                               | 上流 `docs/adoption.md` の設定例の範囲で、Hephaestus、nocturne、Jovie、t3code も部品ディレクトリだけを外す (2026-09-25 確認)。範囲だけを採り、書き方は上の決定 (`excludeFiles`) に従う。`parts/` の中の見た目の上書きも診断され、見た目の差が `ui/` の variant に集まる | **採用** |
| 適用外を `ui/` `action/` `parts/` にする                                                | `parts/` の中で ui 部品への見た目の上書きが無診断で通り、見た目が `ui/` の variant に集まらない。合成部品も部品ディレクトリへ同居させて丸ごと外す stella がこの形に近い (2026-09-25 確認)                                                                               | 却下     |
| `ScrollArea` の contract で `rounded` だけ許す                                          | 切り抜く角丸を器に合わせられる。グループ `rounded` は片側の角丸 (`rounded-t-*`) と outline / ring を含まない (shadcn-ui/lint `categories.ts`)。地の色・枠線・余白は許さず、置き場所が器と中身に決まる                                                                   | **採用** |
| `ui/scroll-area.tsx` に variant を足す                                                  | 見た目の選択肢が 1 つの使い手のためのものになり、shadcn の例が呼び出し側で当てる角丸 (`rounded-md border`) を `ui/` に固定する                                                                                                                                          | 却下     |
| contract でカテゴリ `layout` / `spacing` / `shape` を許す (Hephaestus の形)             | `spacing` が gap と space を、`shape` が outline と ring の太さを含むので、それらまで許す。Root に当てた余白は既定の `data-has-overflow-y:pr-2.5` とぶつかる                                                                                                            | 却下     |
| contract で `color` も許す                                                              | 地の色は器が持つ。Hephaestus の contract も color を許さず、t3code と nocturne は ScrollArea に layout 以外を渡さない                                                                                                                                                   | 却下     |
| 角丸を外側の器だけに持たせる                                                            | Viewport は Root の角丸を受け継ぐ作りで、Root に角丸が無いと中身の四角い地と focus ring を切り抜けず、四隅に出る                                                                                                                                                        | 却下     |

## Consequences

- 恒久的な例外はゼロになる。`excludeFiles` に書くのは `ui/` の 1 行で、層の宣言であって違反の抑制ではない。違反が増えても行は増えない
- 規則の有効化は `vite.config.ts` が持ち、適用範囲の決定はこの ADR が持つ。層の増減は両方を動かす
- `parts/` で ui 部品の見た目を変えたくなったら、`ui/` の variant を足す。registry からの乖離になるので、台帳 `docs/registry-deviations.md` に行が増える (ADR-0020)
- **機械で止まらない誤りが 2 つ残る。** どちらもレビューで見る
  - ui 部品にあるものを素の要素で作り直すと、規則は効かない。`no-restyle` は認識した design system component だけを見る (`no-restyle.md` の Limits)
  - 配る部品を `screens/` や直下へ置くと `componentImports` に入らない。ui 部品へ転送する `className` は包みとして検査されるが (2026-09-25 実測、`@shadcn/lint` 0.1.0)、素の要素に当てる見た目の上書きは検査されない
- ドメイン固有の見た目を持つ共有部品の置き場所は未定義。現時点で該当は無く、出てきた時点で `parts/` に置くか `src/features/<domain>/` 側の扱いとするかを決める (ADR-0010)

## 出典

- shadcn-ui/lint「no-restyle」(部品ディレクトリで規則を off にする案内と、Limits): https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md
- shadcn-ui/lint「Adoption」(`components/ui/**` だけを外す設定例): https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md
- shadcn-ui/lint「Rules」(`componentImports` の設定、「Contracts」「Categories」): https://github.com/shadcn-ui/lint/blob/main/docs/rules.md
- shadcn-ui/lint の class グループとカテゴリの対応 (`rounded` と片側の角丸、outline / ring の太さ): https://github.com/shadcn-ui/lint/blob/main/packages/lint/src/grammar/categories.ts#L170-L184 、https://github.com/shadcn-ui/lint/blob/main/packages/lint/src/grammar/categories.ts#L214-L223
- shadcn の ScrollArea の例 (呼び出し側で `rounded-md border` / `p-4` を当てる): https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/examples/scroll-area-example.tsx#L42 、https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/examples/scroll-area-example.tsx#L60
- Base UI の ScrollArea のデモ (地は Root、余白は `ScrollArea.Content`): https://github.com/mui/base-ui/blob/master/docs/src/app/(docs)/react/components/scroll-area/demos/hero/tailwind/index.tsx#L5-L7
- 採用例の設定 (2026-09-25 時点の commit)
  - Hephaestus (`webapp/.oxlintrc.json`): https://github.com/hephaestus-build/Hephaestus/blob/bf8dd2c9b456dd75d76666b7f762e1824efe0fa5/webapp/.oxlintrc.json (ScrollArea の contract は L131-L132: https://github.com/hephaestus-build/Hephaestus/blob/bf8dd2c9b456dd75d76666b7f762e1824efe0fa5/webapp/.oxlintrc.json#L131-L132)
  - nocturne (`src/Web/packages/app/eslint.config.js`): https://github.com/nightscout/nocturne/blob/3bd69247114ca49009de5bdcfc39d628af0ac55e/src/Web/packages/app/eslint.config.js
  - Jovie (`apps/web/eslint.config.js`): https://github.com/JovieInc/Jovie/blob/f1fba6f034be825b4008ac81a4aa60082d52bb9a/apps/web/eslint.config.js
  - t3code (`vite.config.ts`): https://github.com/pingdotgg/t3code/blob/7b84431161a64c9f9e9b57637dec23474a1b4236/vite.config.ts
  - t3code (`apps/web/src/components/ui/scroll-area.tsx`、`radius?: "inherit" | "none"`): https://github.com/pingdotgg/t3code/blob/7b84431161a64c9f9e9b57637dec23474a1b4236/apps/web/src/components/ui/scroll-area.tsx
  - stella (`oxlint.config.ts`): https://github.com/stella/stella/blob/23eb2814b4fe5ade08c30b77d8006098d3746931/oxlint.config.ts
- BearStudio/start-ui-web: https://github.com/BearStudio/start-ui-web
- Kiranism/tanstack-start-dashboard: https://github.com/Kiranism/tanstack-start-dashboard
- mugnavo/tanstarter: https://github.com/mugnavo/tanstarter
