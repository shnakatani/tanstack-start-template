# ADR-0030: reduced motion の利用者には、部品ごとの `motion-safe:` / `motion-reduce:` で移動と大きさの変化を外し、フェードと読み込みの表示は残す

- Status: Accepted
- Date: 2026-09-27
- 関連: ADR-0020 (registry との乖離の記録)

## Context

`prefers-reduced-motion: reduce` を選んだ利用者に、部品の動きをどこまで出すかを決める。

### 上流の既定

shadcn・Base UI・tw-animate-css は、どれも既定では reduced motion を扱わない (2026-09-27 に確認)。

| 上流                 | 扱い                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn の registry   | base-vega の UI 63 件に `motion-safe` / `motion-reduce` / `prefers-reduced-motion` は無い。本体の CSS (`shadcn/tailwind.css`) で打ち消すのは `.shimmer` の 1 か所だけ |
| shadcn への提案      | 部品に `motion-safe` を付ける PR 27 と PR 1222 は、どちらも merge されずに close した                                                                                 |
| tw-animate-css 1.4.0 | reduced motion の記述が無い。変数 (`--tw-enter-scale` など) は `@property` で登録され、未指定なら initial-value (移動 0、拡縮 1) になる                               |
| Base UI              | 全体に効く option は無い。docs の demo は部品ごとに media query を書く (`tabs.md` は移動だけを `no-preference` の中に置き、フェードは外に残す)                        |
| Tailwind CSS         | docs「Supporting reduced motion」は、クラスごとに `motion-safe` / `motion-reduce` の variant を付ける形を示す                                                         |

### 何が motion か

WCAG 2.3.3 (Level AAA) の motion animation は "addition of steps between conditions to create the illusion of movement or to give a sense of a smooth transition" で、大きさの閾値は無い。瞬時の変化は animation に当たらない ("An element which appears instantly without transitioning is not using animation.")。判定は動きとして知覚されるかで、色と opacity の変化は大きさ・形・位置を変えない限り含まない。blur は WCAG 2.2 の errata (w3c/wcag の PR 4040、2025-06-27) で除外から外れた。

読み込みの表示は、WCAG 2.2.2 の Understanding が "can be considered essential if interaction cannot occur during that phase for all users and if not indicating progress could confuse users" と書く。

### テンプレートの部品の動き

| 動かし方                                           | 部品                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| tw-animate-css の keyframes (拡縮・移動・フェード) | dialog、alert-dialog、popover、dropdown-menu、select、combobox、tooltip |
| `data-starting-style` / `data-ending-style` の移動 | sheet                                                                   |
| 高さの keyframes                                   | accordion                                                               |
| 幅・位置・大きさの transition                      | sidebar (gap、container、menu button、rail)、toast (出入りと積み直し)   |
| 押下の 1px のずれの transition                     | button                                                                  |
| 読み込みの表示                                     | spinner、skeleton                                                       |

## Decision

**reduced motion の利用者には、部品の class に `motion-safe:` / `motion-reduce:` を付けて、移動・拡縮・大きさの変化を外す。フェード (opacity と色) と読み込みの表示は残す。**

| 対象                                       | 書き方                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| tw-animate-css の拡縮・移動                | `zoom-*` / `slide-in-from-*` に `motion-safe:`。`fade-*` は付けない                                |
| 開始・終了状態の移動                       | `data-starting-style:translate-*` などに `motion-safe:`                                            |
| 高さ・幅・位置の keyframes と transition   | keyframes は `motion-safe:`、transition は `motion-reduce:transition-none`                         |
| 色や opacity と動きを一緒に運ぶ transition | `motion-reduce:transition-[...]` で色・影・opacity だけに絞る。動きは瞬時になる (押した感触は残る) |
| spinner、skeleton                          | 付けない                                                                                           |

### 検討した選択肢

| 案                                                          | 評価                                                                                                                                                                                             | 採否     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 部品ごとに `motion-safe:` / `motion-reduce:` を付ける       | Tailwind の docs が示す形。動きを定義する class の隣に書け、上流が同じ行を変えたら ADR-0020 の 3-way で衝突として見える                                                                          | **採用** |
| 対応しない (上流の既定に従う)                               | 上流と MUI・Mantine・Chakra・Polaris の既定と同じで保守の手間が無い。reduced motion の利用者に popup の拡縮・移動、sheet のスライドが出る                                                        | 却下     |
| global CSS で `[data-open], [data-closed]` の変数を打ち消す | 部品を名指しせず新しい popup にも効く。Chakra の docs が勧める範囲と同じ。popup の外 (sheet、accordion、sidebar、toast、button) は覆えない                                                       | 却下     |
| global CSS で `[data-slot=...]` を列挙して打ち消す          | 実質は部品ごとの指定で、動きの定義から離れた場所に書く。slot 名が変わると静かに外れる                                                                                                            | 却下     |
| `*` へ `!important` で animation と transition を詰める     | 公式の推奨ではない (C39 は要素ごとのメディアクエリ)。スピナーを止め、フェードも消す。CSS Remedy のメンテナが best practice ではないと述べ (issue 97)、調べたデザインシステム 13 件に採用例が無い | 却下     |

フェードまで消す形 (Radix、Primer、Carbon) ではなく、移動と大きさだけを外す形 (Material 3、Apple HIG、Chakra、Spectrum の Toast) を選んだ。2.3.3 の範囲がそこまでで、フェードは開閉が起きたことを伝える。

### 付け忘れの防ぎ方

| 案                                                                               | 評価                                                                                                                                                                          | 採否     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 部品を足す手順に含め、`src/components/ui/reduced-motion.test.tsx` に値を足す     | 手順とレビューで見る。テストは載せた部品の値の退行を見る                                                                                                                      | **採用** |
| eslint-plugin-better-tailwindcss の `no-restricted-classes` を jsPlugin で入れる | 正規表現で variant の無い動きの class を止められ、`cn` / `cva` の中も見る。正規表現は自作で、例外 (opacity だけの transition) も書き分ける。oxlint 上で遅い issue 395 が open | 却下     |
| 付け忘れを止める上流の仕組みを使う                                               | 無い。Tailwind の discussion 12864 (既定で motion-safe) と eslint-plugin-tailwindcss の issue 274 (lint 化) はどちらも未解決                                                  | 該当なし |

## Consequences

- 新しい部品や新しい動きに variant を付け忘れても、lint も型検査も止めない。手順 (`docs/guides/accessibility.md`「動きを reduced motion に合わせる」) とレビューで見る
- `reduced-motion.test.tsx` は各部品を `no-preference` と `reduce` の両方で読む。`no-preference` の値は上流のままなので、media query 自体の誤りも落ちる。載せていない部品と、popup が開かなかった side の移動は見ない
- 付けた variant は registry の部品への乖離で、`docs/registry-deviations.md` に記録する。`--overwrite` で再生成したら 3-way で付け直す
- spinner は reduced motion でも回り続ける。skeleton の pulse も続く
- toast は出入りを移動だけで表し、フェードを持たない。reduced motion では瞬時に出入りする
- 上流 (shadcn、Base UI、tw-animate-css) が reduced motion を既定で扱うようになったら、乖離を外してこの ADR を見直す。付け忘れを止める上流の仕組みが出たら、付け忘れの防ぎ方を見直す

## 出典

- Tailwind CSS「Supporting reduced motion」: https://tailwindcss.com/docs/animation#supporting-reduced-motion
- WCAG 2.3.3 Understanding: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- WCAG 2.2 errata (blurring): https://www.w3.org/WAI/WCAG22/errata/
- WCAG 2.2.2 Understanding: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- WCAG Technique C39: https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- Chakra UI「Reduced motion」: https://chakra-ui.com/docs/components/concepts/animation
- CSS Remedy の issue 97: https://github.com/jensimmons/cssremedy/issues/97
- Tailwind CSS discussion 12864: https://github.com/tailwindlabs/tailwindcss/discussions/12864
- eslint-plugin-tailwindcss issue 274: https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/274
- eslint-plugin-better-tailwindcss `no-restricted-classes`: https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/rules/no-restricted-classes.md 、issue 395: https://github.com/schoero/eslint-plugin-better-tailwindcss/issues/395
