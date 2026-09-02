# ADR-0006: registry コードへの改変は許容リストと生成時 baseline で統制する

- Status: Accepted
- Date: 2026-08-17
- 関連: ADR-0003 (registry コードも同じ lint を受ける)、ADR-0007 (寸法の焼き込み禁止)

## Context

`src/components/ui/` は shadcn CLI が生成するコードで、`vp dlx shadcn@latest add <name> --overwrite` でいつでも再生成される。
ローカルで手を入れた箇所は再生成で消えるか、逆に上流の改善を取り込めなくなる。

**生成コードを直接編集すること自体は公式の推奨である。** shadcn はカスタマイズの手段を variant → `className` → **ソース編集** → wrapper の順で挙げている。
したがって統制するのは「してはいけない改変」ではなく、**再生成と上流追随を安全に回すために「何を変えたか」を残すこと**である。

ローカルと最新 registry の 2-way 比較 (`shadcn add <name> --diff`) では、こちらの意図的な乖離と、生成後に上流が変わった差分を区別できない。
整形だけの差分は CLI が `Formatting-only changes` へ畳むため混ざらないが (shadcn 4.19.0)、残った差分がどちら由来かは出力に現れない。

2026-09-02 の追随で両者を突き合わせた。baseline を再生成して得た上流 drift は `checkbox` / `radio-group` / `field` の className 3 箇所だったが、
`--diff` は同じコンポーネントに対してそれより多くの hunk を出す。乖離と drift が混ざるためで、どちらの由来かは出力に現れない。
両者の規模は次で測る。`--diff` は依存コンポーネントも巻き込むので、比べるときはファイル集合を揃える。

```bash
# 意図的乖離 (baseline ↔ ローカル)
git diff --no-index docs/registry-baseline/<name>.tsx src/components/ui/<name>.tsx | grep -c '^@@'
# 2-way (ローカル ↔ 最新 upstream)
vp exec shadcn add <name> --diff | grep -c '^│ │ @@'
```

## Decision

**registry コードへ加えた改変の許容リストを本 ADR が持ち、判別は生成時 baseline を交えた 3-way で行う。**

### 検査手順

生成時 baseline を `docs/registry-baseline/<name>.tsx` に保存する。

- **意図的乖離** = baseline とローカルの diff。下の許容リストと 1:1 で対応する
- **上流 drift** = baseline と最新 CLI 出力の diff。追随候補になる

```bash
vp dlx -- shadcn@latest add <name...> --path docs/registry-baseline --overwrite -y
# CLI は registry が宣言する依存を package.json と lockfile へ足す。--path で baseline だけを
# 再生成するときも書き込むが、vendor したコンポーネントの契約なのでそのまま受け入れる (下記)
git diff package.json
# 先頭の "use client" が残っていたら削除する (下記の CLI バグ)
vp fmt docs/registry-baseline --write
```

再生成後の `git diff docs/registry-baseline` が上流 drift になる。取り込み方はコンポーネントごとに分ける。

| 旧 baseline とローカルの diff | 取り込み方                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 差分なし (意図的乖離ゼロ)     | 新 baseline をローカルへコピーする                                                                                |
| 差分あり                      | `git merge-file <ローカル> <旧 baseline> <新 baseline>` で 3-way マージする。上書きすると許容リストの改変が消える |

旧 baseline は `git show HEAD:docs/registry-baseline/<name>.tsx` で取る。
取り込んだら `git diff --no-index` で baseline とローカルを全件突き合わせ、残る差分が下の許容リストと 1:1 であることを確かめる。

`components.json` の `rsc: false` に基づく CLI 出力を基準とし、registry の生 JSON に含まれる `"use client"` は復元しない。
ただし CLI は複数コンポーネントを 1 回で add すると `"use client"` を除去し損ねることがある (shadcn-ui/ui#8991)。2026-09-02 に 36 件を 1 回で add したときは 11 件に残った。
rsc 変換が `g` フラグつきの正規表現を `.test()` で使っており、`lastIndex` が呼び出しをまたいで持ち越されるためである。

```
add popover              → popover: 除去される
add popover radio-group  → popover: 除去 / radio-group: 残存
add radio-group popover  → radio-group: 除去 / popover: 残存
```

baseline はローカルと同じ整形規則に揃える (`vp fmt`)。意図的乖離は `git diff` で見るため、揃えないと整形ノイズで埋まる。整形差分を畳むのは CLI の `--diff` だけで、`git diff` は畳まない。
一方、baseline は lint と型検査の対象から外す (`vite.config.ts` の `lint.ignorePatterns` と `tsconfig.json` の `exclude`)。上流のコードをそのまま保存する記録だからである。

registry が宣言する依存は、コンポーネント本体が import していなくても受け入れる。
`calendar` は `date-fns` を宣言する。`calendar.tsx` 自身は import しないが、`react-day-picker` の `Locale` は `date-fns/locale` の `Locale` を拡張した型で、locale を渡す使い方では消費側が直接 import する。
外すと `add` のたびに CLI が足し直し、再生成のたびに戻す作業が要る。パッケージも `react-day-picker` の通常依存として既に入っているため、宣言しても依存木は増えない。

baseline の取得漏れは `scripts/checks/integrity/registry-baseline.test.ts` が双方向で検出する。
`--overwrite` で再生成したら baseline も更新する。

### 許容リスト (コードの乖離)

| ファイル                      | 乖離                                                                                                                                         | 理由                                                                                                                                           | 撤去条件・ガード                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| dialog.tsx / alert-dialog.tsx | Viewport 導入 + `popupViewportLayout` / `popupOverflowBackstop` の共有定数 + Popup の flex-col / min-h-0 構造                                | 機能構造のみ保全する (視覚値は registry のまま)                                                                                                | —                                                                                                                 |
| dialog.tsx / alert-dialog.tsx | Root・Trigger の generic 化 (`<Payload>`) と `createHandle` の re-export                                                                     | detached trigger の payload 型を透過させる                                                                                                     | —                                                                                                                 |
| scroll-area.tsx               | `viewportClassName` prop (型は string 限定)                                                                                                  | 呼び出し側から Viewport の layout class を渡す。callback 形を許すと `clsx` が silent に捨てる                                                  | —                                                                                                                 |
| scroll-area.tsx               | `ScrollArea.Content` の導入                                                                                                                  | registry は children を Viewport 直下に置き、内容が縮んでも thumb と overflow 判定が再計算されない                                             | 上流が Content を入れたら撤去 (shadcn-ui/ui#10534)                                                                |
| progress.tsx                  | 既定の Track を `children ?? <ProgressTrack>` でフォールバック化                                                                             | registry は children の後に既定の Track を無条件で描画するため、Track を含む children を渡すと二重になる                                       | 上流が既定 Track をフォールバックにしたら撤去                                                                     |
| button.tsx                    | `dashed` variant                                                                                                                             | 「まだ無いものを追加する」スロット用。`outline` + `className` では前景色・hover 色・展開時状態が消費側へ散る                                   | —                                                                                                                 |
| button.tsx                    | `destructive-ghost` variant                                                                                                                  | 破壊操作のアイコンが密に並ぶ場面用。registry の `destructive` は常時背景着色で過剰                                                             | —                                                                                                                 |
| input-group.tsx               | popup 内リング抑制の dead class を削除し、focus-visible の `ring-3` / `border-ring` へ `not-in-data-[slot=combobox-content]:` ガードを付ける | 上流の抑制ペアは `:has()` の詳細度算入で常に負ける (上流バグ)                                                                                  | ガードは `input-group.test.tsx` (`--overwrite` 消失を検出)。上流修正で行ごと削除 (shadcn-ui/ui#11444)             |
| input-group.tsx               | `(e.target as HTMLElement).closest("button")` を `e.target instanceof Element && e.target.closest("button")` へ置換                          | 型アサーション禁止 (ADR-0004)。ランタイム検証が入るぶん上流より狭い                                                                            | 恒久 (型アサーション禁止はこのリポジトリの規約)                                                                   |
| toggle-group.tsx              | `style={{ "--gap": spacing } as React.CSSProperties}` を型注釈つきの変数へ切り出し                                                           | 同上                                                                                                                                           | 恒久                                                                                                              |
| sidebar.tsx                   | `style={{ ... } as React.CSSProperties}` 3 箇所を型注釈つきの変数へ切り出し                                                                  | 同上                                                                                                                                           | 恒久                                                                                                              |
| sidebar.tsx                   | keydown 購読のハンドラを `useEffectEvent` へ切り出し、依存を空にする                                                                         | 上流は `toggleSidebar` を依存に持つため、`isMobile` が変わるたび window の listener を張り直す                                                 | ガードは `sidebar.test.tsx` の Meta+B ケース。上流が `useEffectEvent` を採ったら撤去                              |
| sidebar.tsx                   | `sidebarMenuButtonVariants` の `data-open:hover:` 2 クラスを `aria-expanded:` へ置換                                                         | `data-open` は popup 側の属性で trigger には立たない。`data-popup-open` を採らないのは `tooltip` prop で包まれるとツールチップで誤点灯するため | ガードは `sidebar.test.tsx` の 3 ケース (Menu / Tooltip / Collapsible)。上流修正で行ごと削除 (shadcn-ui/ui#11479) |
| field.tsx                     | `FieldError` の `uniqueErrors?.length` から optional chaining を外す                                                                         | `typescript/no-unnecessary-condition` (ADR-0004)。直前行で配列を作るため null にも undefined にもならない                                      | 上流が同じ形へ直したら撤去                                                                                        |
| toast.tsx                     | Close の `aria-label` を日本語化。ToastIcon を `aria-hidden` の装飾扱いにしている根拠コメント                                                | 支援技術へ届く文言を UI の言語に合わせる。アイコンだけが種別を伝える状態にしない規範を、次に触る人へ残す                                       | —                                                                                                                 |
| src/hooks/use-mobile.ts       | `useSyncExternalStore` で再実装。判定値の出所が `window.innerWidth` から `matchMedia().matches` に変わる                                     | 上流版 (`useEffect` + `setState`) が `react/set-state-in-effect` を通らない                                                                    | 上流が `useEffect` + `setState` をやめたら撤去                                                                    |

`src/hooks/use-mobile.ts` の行だけ `src/components/ui/` の外にある。
sidebar の依存として CLI が `src/hooks/` へ出力するファイルで、統制の対象は生成元が registry かどうかで決める。

### 許容リスト (行単位の lint 抑制)

下表はファイルとルールの組で並べる。同じ組が複数箇所にあるものは「(2 箇所)」と付し、1 つのコメントがカンマ区切りで複数ルールを抑制する行もある。

| ファイル         | ルール                                                                                     | 抑制の理由                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| breadcrumb.tsx   | `jsx-a11y/prefer-tag-over-role`                                                            | 現在ページを表す非遷移項目。`a href` を付けると遷移可能だと誤って伝わる                                                         |
| button-group.tsx | `jsx-a11y/prefer-tag-over-role`                                                            | `fieldset` は native border と legend 前提の既定意匠を持ち込む                                                                  |
| field.tsx        | `jsx-a11y/prefer-tag-over-role`                                                            | 同上。vertical / horizontal 切り替えレイアウトと衝突する                                                                        |
| input-group.tsx  | `jsx-a11y/prefer-tag-over-role` (2 箇所)                                                   | 同上。input の枠線・フォーカスリング表現、addon の inline レイアウトと衝突する                                                  |
| input-group.tsx  | `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-noninteractive-element-interactions` | クリックは子 input へのフォーカス移動のみ。input 自体は Tab で到達可能なまま                                                    |
| item.tsx         | `jsx-a11y/prefer-tag-over-role`                                                            | 子は `li` ではなく任意の Item 要素。`ul` / `ol` に置換すると content model に違反する                                           |
| label.tsx        | `jsx-a11y/label-has-associated-control`                                                    | 汎用ラッパーで、`htmlFor` や wrap する control は呼び出し側が渡す前提                                                           |
| spinner.tsx      | `jsx-a11y/prefer-tag-over-role`                                                            | lucide-react の svg アイコンで、レンダーされるタグを差し替えられない                                                            |
| field.tsx        | `react/no-array-index-key`                                                                 | 中身がテキストだけで state も DOM identity も持たず、取り違えても表示結果が変わらない                                           |
| toggle-group.tsx | `react/jsx-no-constructed-context-values`                                                  | 内部 state を持たず、親起因の再レンダーで children も新しくなるため `useMemo` しても consumer の再レンダーが減らない            |
| toast.tsx        | `react/no-object-type-as-default-prop` (2 箇所)                                            | base-ui は render 要素を毎レンダー `cloneElement` で複製し primitive も memo 化しないため、参照を固定しても再レンダーが減らない |

抑制はディレクトリ単位の `overrides` ではなく **行単位で書く**。
`files: ["src/components/ui/**"]` の glob で一括 off にすると、後から追加されるファイルにも無条件で免除が及び、この表と 1:1 で対応しなくなる。

同じ行に複数のルールが鳴るときはカンマ区切りで 1 行にまとめる。
`oxlint-disable-next-line` を 2 行積むと、2 行目が 1 行目のコメント行を「次の行」と解釈して no-op になり、1 件しか抑制されない。

### 許容リストに載せないもの

`src/styles.css` が持っていた `data-*` の `@custom-variant` 定義は、`@import "shadcn/tailwind.css"` が一字一句同じ定義を提供しているため削除し、import 側へ一本化した。
これはローカル定義と import の重複解消であって registry コードの改変ではないため、この表には載せない。

### 追加と削除の基準

追加は機能上の必要 (silent failure の防止、アーキテクチャ上の理由、アクセシビリティ要件) がある場合に限る。
公式はソース編集を認めているが、既存 variant と `className` で足りる範囲を先に使う (公式の優先順位)。

例外は公式の優先順位 3 (新規 variant の追加) に乗る場合。
同じ意匠の `className` 上書きが複数箇所に現れ、それが既存 variant で表現できないなら、variant へ引き上げる方が消費側に色と typography が散るより健全である。
この経路で追加するときは、どの variant の `className` 上書きを畳んだのかと、既存 variant で表現できない理由を許容リストの行に書く。

上記に当たらない、見た目や意味論の好みでソースを書き換えることはせず、上流に合わせる。
ローカルの実装が上流と同じ結果になったら行を削除する。

### registry の値を複製したファイル

`src/components/ui/` の外にも registry の意匠値を写した箇所があり、`--overwrite` の再生成では更新されない。

| ファイル                                   | 出所                                                                      | 突き合わせの条件                      |
| ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| `src/components/segmented-radio-group.tsx` | `tabs.tsx` の `tabsListVariants` (トラック) と `TabsTrigger` (セグメント) | `tabs.tsx` の baseline が変わったとき |

そのまま採っていない差分の内訳は当該ファイルの docstring が持つ。本 ADR は所在と突き合わせの条件だけを持つ。

### 検討した選択肢

| 案                                           | 意図的乖離と上流 drift の区別 | 整形ノイズ | 追加で抱えるもの                                      |
| -------------------------------------------- | ----------------------------- | ---------- | ----------------------------------------------------- |
| **生成時 baseline を commit する 3-way**     | つく                          | 無し       | baseline ファイルと更新規律                           |
| `shadcn add --diff` の 2-way                 | つかない                      | 混ざる     | 無し                                                  |
| registry を submodule / vendor mirror で持つ | つく                          | 混ざる     | mirror の同期。repo の生 JSON と CLI 出力が一致しない |
| 各コンポーネントのコメントだけで管理         | つかない (一覧できない)       | —          | 無し                                                  |

## Consequences

- 乖離の行が増減するたびに本 ADR を更新する。行の増減は決定内容の変更ではないため、README 一覧の Date 欄は動かさない
- baseline は lint と型検査の対象外なので、上流コードに含まれる規約違反はこのリポジトリの緑に影響しない。一方、上流を追随するときは違反が `src/` 側へ入るため、追随の可否は lint を通るかで決まる
- 初期 baseline は各コンポーネントを実際に生成した時点の出力ではない。取得時点で残っている乖離が許容リストと 1:1 であることを確認したうえで採用しているため、以後の判別はこの baseline を起点にできる
- registry コードが依存するパッケージの選定は上流に従う。`class-variance-authority` は 12 コンポーネントが、`tw-animate-css` の `animate-in` / `animate-out` は 7 コンポーネントが使う (2026-09-02 時点、いずれも baseline 側にも同じ import がある)。どちらも更新が細っている (`class-variance-authority` は最終公開 2024-11-26 の 0.7.1 のまま。`tw-animate-css` は 1.4.0 が 2026-02-28 で、リポジトリの最終 push も同日。2026-09-02 確認)。乗り換えは上流が動いたときにしか成立しない。`shadcn/tailwind.css` は `animate-in` を供給しないため、`tw-animate-css` の撤去は registry コードを壊す
- baseline を自前で持つのは、上流に生成時点を特定する手段が無いあいだの代替である。shadcn が生成時点の記録や registry item の版数フィールドを持つようになったら、そちらへの移行を検討する (shadcn-ui/ui#10374)

## 出典

- shadcn のカスタマイズ方針 (ソース編集を含む優先順位): https://ui.shadcn.com/docs/components-json
- 複数 add で `"use client"` が 1 件おきに残る件: https://github.com/shadcn-ui/ui/issues/8991
- ScrollArea の Content 省略: https://github.com/shadcn-ui/ui/issues/10534
- Base UI 側 (https://github.com/mui/base-ui/issues/4696) はメンテナが起票 43 分後に `NOT_PLANNED` で閉じ、後日 `type: expected behavior` のラベルが付いた。「`ScrollArea.Content` が ResizeObserver で内容の変化を観測する。Content で包むのが期待される anatomy で、直すのは shadcn wrapper 側」という判断で、この乖離は上流に追認されている。shadcn-ui/ui#10534 はこの回答を受けて起票者が立てた派生 issue なので、撤去条件は #10534 だけでよい
- InputGroup の popup 内リング抑制が効かない件: https://github.com/shadcn-ui/ui/issues/11444
- SidebarMenuButton の `data-open:` が trigger に立たない件: https://github.com/shadcn-ui/ui/issues/11479
- `components.lock` の提案: https://github.com/shadcn-ui/ui/discussions/10374
