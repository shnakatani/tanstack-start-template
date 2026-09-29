# ADR-0036: 文字数の上限は code point で数え、入力欄は maxlength で打ち止めにしない

- Status: Accepted
- Date: 2026-09-29
- 関連: ADR-0013 (ドメイン型は valibot のスキーマから導出する)、ADR-0019 (検索語の上限は reject せず切り詰める)

## Context

入力の文字数に上限を設けるとき、何を 1 文字と数えるかが単位によって違う。日本語の UI では、サロゲートペアの漢字 (𠮷) と単体の絵文字 (😀) の数え方が「N 文字以内」の文言と利用者の感覚に直に効く。

| 前提                       | 中身                                                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 上限の判定はスキーマが持つ | server function の validator とフォームのフィールド検証が同じスキーマを使う (ADR-0013)                                                                                                                         |
| DB は SQLite               | `length()` と `substr` は code point で数える (sqlite.org の lang_corefunc)                                                                                                                                    |
| HTML の `maxlength`        | Infra の length (「the number of code units」) で数える。超えないように止めるかはブラウザの任意 (「User agents may prevent」)                                                                                  |
| valibot の長さの action    | `maxLength` は `.length` と同じ UTF-16 の code unit、`maxCodePoints` は code point、`maxGraphemes` は `Intl.Segmenter` の grapheme で数える。切り詰めの action は無い (1.5.0、2026-09-29 に同梱の型定義で確認) |

## Decision

**文字数の上限は code point で数える。スキーマは `v.maxCodePoints` で判定し、切り詰めるときも code point の境界で切る (`src/lib/truncate-code-points.ts`)。入力欄には `maxlength` を付けず、上限を超えた入力はスキーマが文言を出すか切り詰める。**

### 数える単位

| 案                                      | 評価                                                                                                                                                                                                                               | 採否     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| code point (`maxCodePoints`)            | 𠮷 と 😀 を 1 と数え、日本語の本文は感覚と合う。SQLite の `length()` / `substr` と一致する。valibot の docs が DB の `LENGTH()` に合わせる用途として挙げる単位                                                                     | **採用** |
| UTF-16 の code unit (`maxLength`)       | 𠮷 と 😀 を 2 と数え、「N 文字以内」の文言と感覚がずれる。SQLite とも一致しない                                                                                                                                                    | 却下     |
| grapheme (`maxGraphemes`)               | 見た目の 1 文字を 1 と数え、最も感覚に近い。1 grapheme に入る code point 数に上限が無く、valibot の docs は `maxCodePoints` などとの併用を勧めるので、判定と文言が 2 つになる。1 回の判定が code point の約 30 倍かかる (調査結果) | 却下     |
| grapheme と code point の上限を併用する | 表示される上限は感覚と合うが、検証と文言が 2 種類になる。上限の保証は code point 側が持つので、1 つで足りる                                                                                                                        | 却下     |

### 上限を守る場所

| 案                                         | 評価                                                                                                                                                                                                                                                                                                                                                    | 採否     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| スキーマだけが上限を持ち、入力欄は止めない | 上限の判定が 1 か所で、数える単位もスキーマの 1 つになる。超えたら文言を出すか切り詰める                                                                                                                                                                                                                                                                | **採用** |
| 入力欄にも `maxlength` を付ける            | `maxlength` は code unit で数えるので、code point のスキーマとずれる (上限が N なら 𠮷 は N/2 文字で止まる)。変換中に上限へ達すると意図した文字列を入力できず、貼り付けた文字列は黙って切られる (デジタル庁デザインシステムの input-text のアクセシビリティ)。GOV.UK の Character count も入力欄の `maxlength` を外し、超えたことを知らせる形にしている | 却下     |

## Consequences

- ZWJ で結んだ絵文字 (👨‍👩‍👧 は 5 code point) や結合文字 (か + 結合濁点は 2) は、見た目の 1 文字より多く数える。「N 文字以内」の文言とずれるのはこの場合だけである。GOV.UK の Character count は `text.length` (code unit) で数え、単体の絵文字も 2 と数えることを既知の問題として残している (govuk-frontend の issue 1104、2026-09-29 に open)
- 切り詰めは code point の境界で切るので、サロゲートペアの片割れは残らない。ZWJ で結んだ絵文字は途中で切れうる
- 上限を目で見て分かるようにするなら、入力欄の近くに説明を置く (デジタル庁デザインシステムの案内)。検索語のように稀にしか超えない長さなら置かなくてよい

### 再評価の条件

- DB を code point 以外で長さを数えるもの (MySQL の `VARCHAR` のバイト数など) に替えたとき
- 見た目の 1 文字で数える要件が出て、grapheme の数え方がサーバとブラウザで揃うことを確かめられたとき

## 調査結果

2026-09-29 に Node v24.21.0、valibot 1.5.0、better-sqlite3 で測った。

| 文字列        | code unit | code point | grapheme | SQLite の `length()` |
| ------------- | --------- | ---------- | -------- | -------------------- |
| 👨‍👩‍👧            | 8         | 5          | 1        | 5                    |
| 𠮷            | 2         | 1          | 1        | 1                    |
| 😀            | 2         | 1          | 1        | 1                    |
| か + 結合濁点 | 2         | 2          | 1        | 2                    |
| 🇯🇵            | 4         | 2          | 1        | 2                    |

1 回の判定の時間は次のとおり (ASCII 2000 文字と「あ」2000 文字を、それぞれ 20000 回判定した平均)。

| action          | ASCII   | 「あ」  |
| --------------- | ------- | ------- |
| `maxLength`     | 0.08µs  | 0.03µs  |
| `maxCodePoints` | 3.02µs  | 3.22µs  |
| `maxGraphemes`  | 81.40µs | 98.63µs |

## 出典

- valibot `maxLength` (「measured like JavaScript's value.length, i.e. by UTF-16 code units」): <https://valibot.dev/api/maxLength/>
- valibot `maxGraphemes` (`maxCodePoints` を DB の `LENGTH()` に合わせる用途に挙げ、併用を勧める): <https://valibot.dev/api/maxGraphemes/>
- valibot 1.5.0 のリリースノート (code point の action の追加): <https://github.com/open-circle/valibot/releases/tag/v1.5.0>
- HTML Standard の maxlength と Infra の length: <https://html.spec.whatwg.org/multipage/input.html#attr-input-maxlength> / <https://infra.spec.whatwg.org/#string-length>
- SQLite の core functions (`length()` と `substr` は code point): <https://sqlite.org/lang_corefunc.html>
- デジタル庁デザインシステム input-text のアクセシビリティ (maxlength を使わない): <https://design.digital.go.jp/dads/components/input-text/accessibility/>
- GOV.UK Design System の Character count: <https://design-system.service.gov.uk/components/character-count/>
- govuk-frontend の Character count のソース (`removeAttribute('maxlength')` と `text.length`) と issue 1104: <https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/components/character-count/character-count.mjs> / <https://github.com/alphagov/govuk-frontend/issues/1104>
