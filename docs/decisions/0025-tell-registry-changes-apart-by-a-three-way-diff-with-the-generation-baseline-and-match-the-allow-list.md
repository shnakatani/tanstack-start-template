# ADR-0025: registry コードへの改変は生成時 baseline との 3-way で判別し、許容リストと 1:1 に保つ

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0026 (コードの乖離と行単位の lint 抑制の許容リスト)、ADR-0034 (`src/styles.css` の乖離の許容リスト)、ADR-0008 (registry コードも同じ lint を受ける)、ADR-0033 (`src/styles.css` の baseline とトークンの値の決め方)

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

**判別は生成時 baseline を交えた 3-way で行い、baseline とローカルの差分を許容リスト (ADR-0026 / ADR-0034) と 1:1 に保つ。**

### 検査手順

生成時 baseline を `docs/registry-baseline/<name>.tsx` に保存する。

- **意図的乖離** = baseline とローカルの diff。許容リスト (ADR-0026) と 1:1 で対応する
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
取り込んだら `git diff --no-index` で baseline とローカルを全件突き合わせ、残る差分が許容リスト (ADR-0026) と 1:1 であることを確かめる。

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

`src/styles.css` の baseline は `docs/registry-baseline/styles.css` に置く。`shadcn add` は出力しないため、作り直す手順は ADR-0033「土台は空ファイルへの生成物とし、自作分を載せ直す」が持つ。
突き合わせは `git diff --no-index docs/registry-baseline/styles.css src/styles.css` で、残る差分が ADR-0034 の許容リストと 1:1 で対応する。
取得漏れは `registry-baseline.test.ts` が落とす (`EXTERNAL_REGISTRY_FILES` に `styles.css` を登録してある)。許容リストへの行の足し忘れは鳴らない。

### 許容リストに載せないもの

`src/styles.css` はファイル全体が baseline の対象になったので、`@custom-variant` を含めた全行が ADR-0034 の表の突き合わせに載る (ADR-0033)。
`data-*` の `@custom-variant` 定義をローカルから削除し `@import "shadcn/tailwind.css"` へ一本化した件は、CLI の生成物も同じ定義を持たないため差分にならず、行を持たない。

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

| ファイル                                         | 出所                                                                      | 突き合わせの条件                      |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| `src/components/parts/segmented-radio-group.tsx` | `tabs.tsx` の `tabsListVariants` (トラック) と `TabsTrigger` (セグメント) | `tabs.tsx` の baseline が変わったとき |

そのまま採っていない差分の内訳は当該ファイルの docstring が持つ。本 ADR は所在と突き合わせの条件だけを持つ。

### 検討した選択肢

| 案                                           | 意図的乖離と上流 drift の区別 | 整形ノイズ | 追加で抱えるもの                                      |
| -------------------------------------------- | ----------------------------- | ---------- | ----------------------------------------------------- |
| **生成時 baseline を commit する 3-way**     | つく                          | 無し       | baseline ファイルと更新規律                           |
| `shadcn add --diff` の 2-way                 | つかない                      | 混ざる     | 無し                                                  |
| registry を submodule / vendor mirror で持つ | つく                          | 混ざる     | mirror の同期。repo の生 JSON と CLI 出力が一致しない |
| 各コンポーネントのコメントだけで管理         | つかない (一覧できない)       | —          | 無し                                                  |

## Consequences

- baseline は lint と型検査の対象外なので、上流コードに含まれる規約違反はこのリポジトリの緑に影響しない。一方、上流を追随するときは違反が `src/` 側へ入るため、追随の可否は lint を通るかで決まる
- 初期 baseline は各コンポーネントを実際に生成した時点の出力ではない。取得時点で残っている乖離が許容リストと 1:1 であることを確認したうえで採用しているため、以後の判別はこの baseline を起点にできる
- registry コードが依存するパッケージの選定は上流に従う。`class-variance-authority` は 12 コンポーネントが、`tw-animate-css` の `animate-in` / `animate-out` は 7 コンポーネントが使う (2026-09-02 時点、いずれも baseline 側にも同じ import がある)。どちらも更新が細っている (`class-variance-authority` は最終公開 2024-11-26 の 0.7.1 のまま。`tw-animate-css` は 1.4.0 が 2026-02-28 で、リポジトリの最終 push も同日。2026-09-02 確認)。乗り換えは上流が動いたときにしか成立しない。`shadcn/tailwind.css` は `animate-in` を供給しないため、`tw-animate-css` の撤去は registry コードを壊す
- registry は `cn` を `@/lib/utils` ではなく npm の `cn` パッケージから取るので、`src/lib/utils.ts` は置かず、消費側も `cn` パッケージから import する。`components.json` の `aliases.utils` は shadcn のスキーマが必須項目にしているので値は残すが、現行 registry は参照しない (`src/lib/utils.ts` が無くても `shadcn add` は成功する。2026-09-11 実測)
- baseline を自前で持つのは、上流に生成時点を特定する手段が無いあいだの代替である。shadcn が生成時点の記録や registry item の版数フィールドを持つようになったら、そちらへの移行を検討する (shadcn-ui/ui#10374)
- registry 由来でない付随ファイル (`*.test.*` / `*.stories.*` / `*.test-helpers.*` / `*.story-helpers.*`) は `src/components/ui/` に置いてよい。`shadcn add` の出力に含まれないため baseline を持たず、網羅検査の対象外になる

## 出典

- shadcn のカスタマイズ方針 (ソース編集を含む優先順位): https://ui.shadcn.com/docs/components-json
- 複数 add で `"use client"` が 1 件おきに残る件: https://github.com/shadcn-ui/ui/issues/8991
- `components.lock` の提案: https://github.com/shadcn-ui/ui/discussions/10374
