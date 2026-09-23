# ADR-0015: `src/components/` を役割で分け、design system の著作と消費の境界をディレクトリで表す

- Status: Accepted
- Date: 2026-09-19
- 関連: ADR-0031 (`@shadcn/lint` のルールの選定)、ADR-0026 (registry コードの改変は許容リストで統制)、ADR-0014 (features / routes の配置の原則)、ADR-0021 (Action 層)、ADR-0023 (DataTable 部品の配置)

## Context

`src/components/` を「ドメインを跨いで共有する自作コンポーネント」と 1 つに定義すると、役割が異なる 2 種類が同じ階層に混在する。`page-header` / `data-table` / `dialog-scroll-body` / `form-fields` 等は registry を包んで外見を定義する部品 (著作側)、`route-error` / `not-found` は部品を並べて画面を組む側 (消費側) である。

`@shadcn/lint` の `no-restyle` は、対象を 2 軸で設定する (https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md)。

| 軸   | 設定                               | 意味                                                |
| ---- | ---------------------------------- | --------------------------------------------------- |
| 認識 | `settings.shadcn.componentImports` | どの import を design system component として見るか |
| 適用 | `overrides` の `excludeFiles`      | どこで規則を off にするか。design system 自身の内部 |

適用軸の前提は「design system 自身の内部だけを外す」ことで、著作側と消費側が同じディレクトリに混在すると、この前提をパスで表せない。`"shadcn/no-restyle": ["error", { allow: ["layout"] }]` を一時的に足して測ったところ (2026-09-19)、`src/components/` (`ui/` を除く) には 18 件の違反があった。`src/components/**` を一括で `excludeFiles` に入れる案では、このうち `screens/` に残る `route-error.tsx` の 6 件が隠れる。内訳は `CardTitle` への `text-lg` / `font-semibold` / `text-destructive` の 3 件、`AccordionTrigger` への `text-muted-foreground` (コントラストを下げる実在の欠陥) の 1 件、`ScrollArea` への `rounded` / `bg-muted` の 2 件で、規則が一括除外なしでは検出できていた欠陥である。

## Decision

**`src/components/` を役割で 5 区分し、`no-restyle` の適用範囲をディレクトリ境界で表す。**

| 配置先                    | 内容                                                           | `no-restyle` |
| ------------------------- | -------------------------------------------------------------- | ------------ |
| `src/components/ui/`      | shadcn 生成コンポーネント                                      | 適用外       |
| `src/components/action/`  | `ui/` を包み `action` prop で Transition 化した部品 (ADR-0021) | 適用外       |
| `src/components/parts/`   | registry を包んで外見を定義する自作部品                        | 適用外       |
| `src/components/screens/` | 部品を並べて画面を組む共有コンポーネント                       | 適用する     |
| `src/components/` (直下)  | 上のどれでもないもの。実例は `live-regions.tsx`                | 適用する     |

`src/components/` の外では `.storybook/` も適用する側に置く。decorator は design system component を包んで `className` を渡す置き場になるため、`src/components/screens/` と同じ扱いにする。`vite.config.ts` の override は `files` に `src/**` と `.storybook/**` の 2 つを持つ。

直下を既定として残すのは、役割を決めきれないものの置き場所を無くさないためである。既定を「規則を適用する」側に置くので、著作として扱わせたいときだけ `parts/` を選ぶことになり、判断を省略した新規ファイルは規則が効く安全側に倒れる。

`action/` を `parts/` の下へ移さないのは、分ける軸が違うためである。`parts/` は外見を定義する層で、`action/` は振る舞い (Transition と pending) を与える層である。どちらも design system の著作側なので `no-restyle` の扱いは同じだが、外見の変更と振る舞いの変更は別の理由で起きる。

### 検討した選択肢

| 案                                                                     | 評価                                                                                                                                                                                                   | 採否     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 現状維持 (フラットな `src/components/`)                                | 部品 (著作) と画面の組み立て (消費) が同じ階層に混在し、`no-restyle` の適用範囲をパスで表せない                                                                                                        | 却下     |
| `src/components/**` を丸ごと `excludeFiles`                            | 画面側の違反も一括で隠れる (2026-09-19 の実測で 18 件中 6 件、`screens/` の `route-error.tsx` に残る。`AccordionTrigger` の実在のコントラスト欠陥を含む)                                               | 却下     |
| ecosystem の慣例に合わせて関心語で 1 段掘る (`errors/` / `layout/` 等) | BearStudio/start-ui-web、Kiranism/tanstack-start-dashboard、mugnavo/tanstarter の 3 件を `gh api` で確認 (2026-09-19)。いずれも著作/消費の役割分割を持たない。前例が無いことは分けない根拠にはならない | 不採用   |
| 上流 README の形 (トップレベル `rules` + 著作側の override で `"off"`) | 規則を off にする形は、適用範囲の宣言と違反の緩和を設定の字面で区別できない。ADR-0026 が分ける違反の抑制 (行単位) と適用範囲 (`excludeFiles`) の区別に外れる                                           | 却下     |
| `ui/` `action/` `parts/` `screens/` + 直下の 5 区分                    | 認識 (`componentImports`) と適用 (`excludeFiles`) の両軸をディレクトリ境界で表現できる。直下を既定にすることで判断の省略が安全側に倒れる                                                               | **採用** |

## Consequences

- 恒久的な例外はゼロになる。`excludeFiles` に書くのは `ui/` `action/` `parts/` の 3 行で、層の宣言であって違反の抑制ではない。違反が増えても行は増えない
- 規則の有効化は `vite.config.ts` が持ち、適用範囲の決定はこの ADR が持つ。層の増減は両方を動かす
- **機械で止まらない誤りが 1 つ残る。** 画面の組み立てを `parts/` へ置くと規則が効かなくなる。レビューで見る
- registry を包んでドメイン固有の外見を定義する部品の置き場所は未定義。現時点で該当は無く、出てきた時点で `parts/` に置くか `src/features/<domain>/` 側の扱いとするかを決める (ADR-0014)

## 出典

- shadcn-ui/lint「no-restyle」: https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md
- shadcn-ui/lint「Rules」(`componentImports` の設定): https://github.com/shadcn-ui/lint/blob/main/docs/rules.md
- BearStudio/start-ui-web: https://github.com/BearStudio/start-ui-web
- Kiranism/tanstack-start-dashboard: https://github.com/Kiranism/tanstack-start-dashboard
- mugnavo/tanstarter: https://github.com/mugnavo/tanstarter
