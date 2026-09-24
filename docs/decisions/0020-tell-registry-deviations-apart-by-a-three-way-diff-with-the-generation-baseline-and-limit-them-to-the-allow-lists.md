# ADR-0020: registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0011 (`no-restyle` の適用範囲)、ADR-0024 (`src/styles.css` の baseline とトークンの値の決め方)

## Context

`src/components/ui/` は shadcn CLI が生成するコードで、`vp dlx shadcn@latest add <name> --overwrite` でいつでも再生成される。
ローカルで手を入れた箇所は再生成で消えるか、逆に上流の改善を取り込めなくなる。

**生成コードを直接編集すること自体は公式の推奨である。** shadcn はカスタマイズの手段を variant → `className` → **ソース編集** → wrapper の順で挙げている。
したがって統制するのは「してはいけない改変」ではなく、**再生成と上流追随を安全に回すために「何を変えたか」を残すこと**である。

ローカルと最新 registry の 2-way 比較 (`shadcn add <name> --diff`) では、こちらの意図的な乖離と、生成後に上流が変わった差分を区別できない。
整形だけの差分は CLI が `Formatting-only changes` へ畳むため混ざらないが (shadcn 4.19.0)、残った差分がどちら由来かは出力に現れない。

2026-09-02 の追随で両者を突き合わせた。baseline を再生成して得た上流 drift は `checkbox` / `radio-group` / `field` の className 3 箇所だったが、
`--diff` は同じコンポーネントに対してそれより多くの hunk を出す。乖離と drift が混ざるためで、どちらの由来かは出力に現れない。
両者の規模の測り方は `docs/guides/registry.md`「乖離と drift の規模を測る」にある。

`src/styles.css` は shadcn CLI の生成物を土台にしている。生成し直すと、ローカルで手を入れた箇所は消える。消えたものを戻せるよう、生成物から動かした箇所を 1 行ずつ記録する。

## Decision

**registry コードと `src/styles.css` への改変、および registry コードの中の行単位の lint 抑制は、生成時 baseline を交えた 3-way で判別し、許容リストの行に限る。許容リストは台帳 `docs/registry-deviations.md` に置く。**

### 検査手順

生成時 baseline を `docs/registry-baseline/<name>.tsx` に保存する。

- **意図的乖離** = baseline とローカルの diff。台帳の「コードの乖離」と 1:1 で対応する
- **上流 drift** = baseline と最新 CLI 出力の diff。追随候補になる

baseline の取り直し方、3-way での取り込み方、`"use client"` の CLI のバグ、整形の揃え方は `docs/guides/registry.md`「baseline を取り直して取り込む」にある。baseline は lint と型検査の対象から外す。上流のコードをそのまま保存する記録だからである。

registry が宣言する依存は、コンポーネント本体が import していなくても受け入れる。
`calendar` は `date-fns` を宣言する。`calendar.tsx` 自身は import しないが、`react-day-picker` の `Locale` は `date-fns/locale` の `Locale` を拡張した型で、locale を渡す使い方では消費側が直接 import する。
外すと `add` のたびに CLI が足し直し、再生成のたびに戻す作業が要る。パッケージも `react-day-picker` の通常依存として既に入っているため、宣言しても依存木は増えない。

baseline の取得漏れは `scripts/checks/integrity/registry-baseline.test.ts` が双方向で検出する。`src/styles.css` の baseline は `docs/registry-baseline/styles.css` に置く。突き合わせの手順は `docs/guides/registry.md`「baseline と突き合わせる」にある。

### 許容リスト

許容リストは台帳 `docs/registry-deviations.md` に置く。「コードの乖離」「行単位の lint 抑制」「`src/styles.css` の乖離」「registry の値を複製したファイル」の 4 つの表を持つ。行の増減は決定の変更ではないので、この ADR は書き換えない。

### 行単位の抑制

抑制はディレクトリ単位の `overrides` ではなく **行単位で書く**。
`files: ["src/components/ui/**"]` の glob で一括 off にすると、後から追加されるファイルにも無条件で免除が及び、台帳の表と 1:1 で対応しなくなる。

これは違反の抑制についての規範である。規則そのものの適用範囲を決めることは別で、`overrides` の `excludeFiles` で書く。
`no-restyle` は「消費側が design system を上書きしていないか」を見る規則で、registry の内部には意味を持たないため `src/components/ui/**` を適用外にしてある (ADR-0011)。
適用外にした規則は許容リストに載らない。載るのは、適用される規則に対して個別に抑制した箇所である。

抑制の書き方の落とし穴は `docs/guides/lint/configuration.md`「行単位で抑制する」にある。

### 許容リストに載せないもの

`src/styles.css` はファイル全体が baseline の対象になったので、`@custom-variant` を含めた全行が台帳の「`src/styles.css` の乖離」の突き合わせに載る (ADR-0024)。
`data-*` の `@custom-variant` 定義をローカルから削除し `@import "shadcn/tailwind.css"` へ一本化した件は、CLI の生成物も同じ定義を持たないため差分にならず、行を持たない。

### 追加と削除の基準

追加は機能上の必要 (silent failure の防止、アーキテクチャ上の理由、アクセシビリティ要件) がある場合に限る。
公式はソース編集を認めているが、既存 variant と `className` で足りる範囲を先に使う (公式の優先順位)。

例外は公式の優先順位 3 (新規 variant の追加) に乗る場合。
同じ意匠の `className` 上書きが複数箇所に現れ、それが既存 variant で表現できないなら、variant へ引き上げる方が消費側に色と typography が散るより健全である。
この経路で追加するときは、どの variant の `className` 上書きを畳んだのかと、既存 variant で表現できない理由を許容リストの行に書く。

上記に当たらない、見た目や意味論の好みでソースを書き換えることはせず、上流に合わせる。
ローカルの実装が上流と同じ結果になったら行を削除する。

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
- registry は `cn` を `@/lib/utils` ではなく npm の `cn` パッケージから取るので、`src/lib/utils.ts` は置かない。`components.json` の `aliases.utils` は shadcn のスキーマが必須項目にしているので値は残すが、現行 registry は参照しない (`src/lib/utils.ts` が無くても `shadcn add` は成功する。2026-09-11 実測)
- baseline を自前で持つのは、上流に生成時点を特定する手段が無いあいだの代替である。shadcn が生成時点の記録や registry item の版数フィールドを持つようになったら、そちらへの移行を検討する (shadcn-ui/ui#10374)
- 乖離の行が増減したら台帳を更新する。行の増減は決定内容の変更ではないため、ADR と README 一覧の Date 欄は動かさない
- `src/styles.css` の許容リストへの行の足し忘れは `registry-baseline.test.ts` では鳴らない。突き合わせは `docs/guides/registry.md`「baseline と突き合わせる」の手順で行う

## 出典

- shadcn のカスタマイズ方針 (ソース編集を含む優先順位): https://ui.shadcn.com/docs/components-json
- `components.lock` の提案: https://github.com/shadcn-ui/ui/discussions/10374
