# ADR-0007: touch target は WCAG 2.2 AA を床とし registry 素寸法で一本化する

- Status: Accepted
- Date: 2026-08-17
- 関連: ADR-0006 (registry 乖離の許容リスト)

## Context

タッチ操作の目安としてよく参照される 44px は、Apple HIG の 44pt と Material Design の 48dp という**操作性の推奨値**であり、WCAG では 2.5.5 Target Size (AAA) にあたる。
適合の床は WCAG 2.2 AA の 2.5.8 Target Size (Minimum) = 24x24 CSS px である。
44px は法令や調達で参照される適合水準ではない。

44px を要件に置くと、担保のために次のどちらかを恒久的に抱えることになる。

- 疑似要素で不可視のヒット領域を広げる方式。隣接する拡大域を重ねない校正規律と、重なりゼロを固定するブラウザテストが要る。マウス環境では拡大域が不可視なため、視覚的な手掛かりのないまま反応が始まる帯が生じる
- 入力デバイス軸 (`any-pointer-coarse`) で視覚ごと 44px にする方式。タッチ環境だけ一覧の表示行数が減り、操作系だけを拡大するため UI 全体の比率も崩れる

## Decision

1. touch target は **WCAG 2.2 AA 2.5.8 (24x24 CSS px) を適合の床**とし、**視覚 = ヒット = registry 素寸法**で運用する
2. 疑似要素によるヒット領域の拡大機構と、寸法の入力デバイス分岐を置かない
3. 44px を要件にしない。実機で誤タップが報告された部品にのみ `any-pointer-coarse:min-h-11` (アイコン系は `min-w-11` も) を後付けする (誤タップレバー)
4. `touch-action: manipulation` も置かず registry 素へ揃える

2.5.8 は隣接ターゲットが十分離れていれば 24px 未満を許す例外条項を持つが、判定を単純に保つため例外には頼らず、全要素を素で 24px 以上にする。
24px を下回る interactive な size variant は新設しない。

### 44px の焼き込みを禁じる

`h-11` / `min-h-11` / `min-w-11` / `size-11` を variant なしで書かない。
書いてよいのは誤タップレバーとして後付けする場合だけで、そのときは必ず variant 付きで書く。

**この禁止に機械強制は無い。規範として守り、レビューで見る。**
以前は `src/**/*.{ts,tsx}` の字面を走査する自前の検査が当てていたが、書いてよい場合 (誤タップレバー) との区別が variant の有無という字面にしか現れず、走査側が例外を抱え続ける構造だったため撤去した。
素の `w-11` を対象に含めないことは変わらない。横 44px の焼き込みは `min-w-11` で書く決まりで、素の `w-11` はアイコン枠などの固定幅として正当な用途がある。

規範を外れた寸法が入ったかどうかは、次の実寸テストが見る。
`src/components/ui/touch-target.test.tsx` が主要部品の実寸と `::before` の不在を確認し、タッチ環境をエミュレートした状態でも寸法が変わらないことを見る。

### `touch-action: manipulation` を置かない理由

第 1 に、目的が既に達成されている。
`src/routes/__root.tsx` の viewport meta が `width=device-width, initial-scale=1` を宣言しており、主要ブラウザはこの宣言を持つページで tap 遅延を最適化する。

第 2 に、残る実効はダブルタップズームの無効化だけになる。
`manipulation` は「パンとピンチズームを有効にし、ダブルタップズーム等の非標準ジェスチャーを無効にする」値で、tap 遅延の除去はその副産物である。
ズームを禁じる方向の副作用だけが残るなら、registry からの乖離を維持する利益がない。

### 検討した選択肢

| 案                                  | 評価                                                                                                 | 採否     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| AA 24px を床に registry 素寸法      | 乖離ゼロで運用でき、視覚とヒットが一致するのでマウス環境の不可視な反応帯も生じない                   | **採用** |
| タッチ環境のみ視覚 44px 化          | AAA / HIG の水準を満たすが、タッチ環境だけ一覧の密度が落ち、spacing scale を据え置くため比率が崩れる | 却下     |
| 疑似要素でヒット領域だけ広げる      | 視覚コストなしで 44px を担保できるが、utility と校正規律と重なり実測の維持が恒久化する               | 却下     |
| `touch-action: manipulation` を残す | tap 遅延の除去は viewport meta で足りており、残る実効はダブルタップズームの無効化だけ                | 却下     |

## Consequences

- タッチ環境の実効ヒット領域は素寸法になる。AA は満たすが操作性推奨は下回るため、実機 UI 確認の観点に「タップ精度」を含める。とくに床ちょうどの要素を見る
- 誤タップの報告が誤タップレバーの発動条件になる。予防的に 44px 化しない
- tap 遅延の除去は viewport meta に依存する。`__root.tsx` から `width=device-width` を外すと遅延が復活するため、この meta は touch target の前提として扱う
- 新しい部品を registry 外で作るときも寸法は registry の size variant に合わせる。独自の寸法を持つ部品は、床を割っていないかと focus-visible のスタイルを持つかを個別に確認することになる
- 素寸法で運用する以上、registry の更新で寸法が変わればこちらの実寸も変わる。ADR-0006 の baseline diff がその変化を可視化する

## 出典

- WCAG 2.2 Understanding 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 Understanding 2.5.5 Target Size (Enhanced): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- CSS `touch-action` の値の定義 (MDN): https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- Bootstrap の `touch-action: manipulation` 撤去: https://github.com/twbs/bootstrap/pull/25250
