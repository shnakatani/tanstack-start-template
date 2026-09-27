# 日時とタイムゾーン

日付や日時の値を足すときの持ち方と、画面に出すときにどのタイムゾーンで整形するかを持つ。テストでタイムゾーンを扱う方法は `docs/guides/testing/time-zones.md` が持つ。

| 決定                                                                                        | ADR      |
| ------------------------------------------------------------------------------------------- | -------- |
| 日付と日時の値は意味で分類し、瞬間は UTC で、暦の日付は TZ を持たない日付で持つ             | ADR-0031 |
| テストの import を重くする依存のバレルは使わず、個別エントリポイントから引き、lint で止める | ADR-0032 |

## how-to

### 日付や日時の値を足す

値の意味を次の順に問い、最初に当てはまった分類にする。分類ごとの保存の形とドメイン型は ADR-0031 の Decision の表に従う。

| 問い                                                                              | 当てはまったら                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. 誰から見ても同じ数字の日か (誕生日、期日のラベル)                              | 暦の日付                                              |
| 2. ある場所の 1 日か、人が壁時計で約束した将来の時刻か (現地の営業日、会議の開始) | 場所に結びつく値                                      |
| 3. 一点を指す時刻か (既に起きたことの記録、期間から計算した期限)                  | 瞬間。実例は `src/server/db/schema.ts` の `createdAt` |

- 「今日」や期限の判定は、ADR-0031 の分類 4 に従う
- 迷ったら、「別の場所にいる人が、同じ数字で理解すべきか」を問う。同じ数字で理解すべきなら暦の日付、場所の 1 日として意味を持つなら場所に結びつく値にする
- ADR-0031 が扱わない値 (時刻だけの値、時間の長さ、繰り返しの予定など) を足すときは、先に ADR-0031 を書き換える

### 画面に日時を出す

- 日時は `formatDateTime` (`src/lib/format-date-time.ts`) を通して整形する。`APP_TIME_ZONE` を `Intl.DateTimeFormat` の `timeZone` に渡すので、サーバーとブラウザで同じタイムゾーンの壁時計になる。書式は画面の言語 (`<html lang="ja">`) のロケールに任せる。実例は `src/routes/notes/-components/note-cells.tsx`
- 別の書式が要るときも `timeZone: APP_TIME_ZONE` を渡した `Intl.DateTimeFormat` で組み、`src/lib/format-date-time.ts` に並べる。並びや区切りはオプション (`dateStyle`、`month: "long"` など) で選び、ロケールを別の言語に替えて並びを得ない (「書式をロケールに任せる理由」)
- ロケールに無い並びがどうしても要るときは、`formatToParts()` で部品を取り出して組み立てる。MDN「Intl.DateTimeFormat.prototype.formatToParts()」は "useful for building custom strings from the locale-specific tokens" と書く
- 描画する値を、実行環境のローカル TZ で組み立てない。`Date#toLocaleString` 系、`Date#getHours` 系、`timeZone` を渡さない `Intl.DateTimeFormat` が当たる。`timeZone` の既定は "the runtime's time zone" (MDN「Intl.DateTimeFormat() constructor」の `timeZone`)
- 瞬間 (ADR-0031 の分類 1) を date-fns で整形するときは、各関数の `in` オプションに `tz(APP_TIME_ZONE)` を渡すか、値を `TZDate` にする。渡さないと date-fns はシステムの TZ で計算する (date-fns 同梱の `docs/timeZones.md`「Working with time zones」)
- `tz` と `TZDate` は `@date-fns/tz` の export で、テンプレートの直接の依存には入っていない (react-day-picker 経由でだけ入っている)。使うときは `vp add @date-fns/tz` で直接の依存に足す
- 利用者ごとのタイムゾーンで出したくなったら、`APP_TIME_ZONE` を固定値から「サーバーで一度決めてクライアントへ渡す値」に変える。決め方は TanStack Start「Hydration Errors」の Strategy 1 と 2 (cookie を正とし、無い間は決まった値を使う)

### 画面に暦の日付を出す

- 暦の日付 (ADR-0031 の分類 2) は `formatCalendarDateLabel` (`src/lib/calendar-date.ts`) で出す。`YYYY-MM-DD` をローカルの 0 時の `Date` にしてから、ローカルのまま date-fns で整形するので、TZ に依存せず、SSR と hydration で割れない
- Calendar との受け渡しは `formatCalendarDate` (`Date` → `YYYY-MM-DD`) と `parseCalendarDate` (`YYYY-MM-DD` → `Date`) を使う
- date-fns は個別エントリポイント (`date-fns/format`、`date-fns/locale/ja`) から引く (ADR-0032)

### 整形した日時をテストで確かめる

- `Intl.DateTimeFormat` の `format()` の出力を固定の文字列と比べない。MDN「Intl.DateTimeFormat.prototype.format()」の Note は "the output may vary between implementations, even within the same locale" "You should not compare the results of `format()` to hardcoded constants." と書く
- 壁時計の値は、出力から数字の並び (年・月・日・時・分) を取り出して比べる。実例は `src/lib/format-date-time.test.ts`
- 画面に描いた文字列を探すテストは、期待値を `formatDateTime` で作る。実例は `src/features/notes/schema.test-helpers.ts` の `NOTE_CREATED_AT_TEXT`
- date-fns の `format` は Intl を使わず、同梱のロケールのデータで文字列を作る (date-fns 4.4.0 の `format.js` と `locale/ja` に `Intl` の参照が無い、2026-09-27)。その出力は固定の文字列と比べてよい。実例は `src/lib/calendar-date.test.ts`

### 日付の入力を扱う

- `Calendar` (`src/components/ui/calendar.tsx`、中身は react-day-picker) は、既定でブラウザのローカル TZ で日付を組む。react-day-picker docs「Setting the Time Zone」は "By default, DayPicker uses the browser's local time zone." と書く
- `timeZone` prop を渡すと、指定した TZ で日付を読み書きする。その場合、値は素の `Date` ではなく `TZDate` で扱う (同じ docs「Working with time-zoned dates」)。react-day-picker 10.0.1 は `TZDate` を `@date-fns/tz` から再 export している。テンプレートは `timeZone` prop を今は使っていない
- 暦の日付を `Calendar` で入力するときは、選ばれた `Date` から、ローカル TZ のまま年・月・日だけを取り出して `YYYY-MM-DD` にする。`toISOString()` を使わない。UTC に直すので、UTC より進んだ TZ (JST など) では 1 日前になる (ADR-0031 の Context)
- 保存した `YYYY-MM-DD` を `new Date("YYYY-MM-DD")` で読まない。日付だけの文字列は UTC の 0 時として解釈され、UTC より遅れた TZ では 1 日前になる (ADR-0031 の Context)
- `YYYY-MM-DD` の形式を valibot の `isoDate()` で検証しても、存在しない日付は通る。型定義の Hint は "The regex used cannot validate the maximum number of days based on year and month. For example, "2023-06-31" is valid although June has only 30 days." と書く (valibot 1.4.2)。`isoDate()` の後ろに `v.check` を足し、年・月・日が暦に存在するかを見る。valibot の API docs「isoDate」は、存在を検証する組み込みの手段を挙げていない

## explanation

### タイムゾーンを明示して整形する理由

SSR する画面では、同じ値をサーバーとブラウザの両方で整形する。ローカル TZ で整形すると、サーバーの TZ とブラウザの TZ が違う環境でだけ別の文字列になり、React が hydration mismatch を報告する。開発機ではサーバーとブラウザが同じ TZ なので、手元では気付けない。

TanStack Start「Hydration Errors」は原因の筆頭に `Intl` (locale / time zone) を挙げ、対処を次の 5 つに分ける。

| 対処       | 中身                                                                 | 採否                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy 1 | サーバーで決まったタイムゾーンを選び、クライアントでも同じものを使う | 採用。`APP_TIME_ZONE` を固定値として両方で使う                                                                                                                               |
| Strategy 2 | 初回訪問でクライアントの TZ を cookie に書き、以後の SSR で使う      | 利用者ごとの TZ が要るときに Strategy 1 と組む                                                                                                                               |
| Strategy 3 | `<ClientOnly>` で包み、サーバーで描かない                            | 日時の一覧のように初回表示に要る値には向かない。SSR の利点が消える                                                                                                           |
| Strategy 4 | route の SSR を切るか `ssr: 'data-only'` にする                      | 同上                                                                                                                                                                         |
| Strategy 5 | `suppressHydrationWarning` で警告を抑える                            | 採らない。文字列が食い違ったまま出る。TanStack Start は "Avoid blind suppression"、React docs「hydrateRoot」は、避けられない差 (例として timestamp) に限る最終手段として扱う |

### 書式をロケールに任せる理由

`Intl.DateTimeFormat` のロケールは、その言語の利用者に合う書式で出すための指定である。画面の言語は日本語なので、ロケールも `ja` にし、並びと区切りはロケールのデータに任せる。

| 案                                                                                | 採否 | 理由                                                                                                                                |
| --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 画面の言語のロケール (`ja`) に任せる                                              | 採用 | Intl の本来の用途。書式を自前で持たない                                                                                             |
| 並びが目的の形に近い別の言語のロケール (`sv-SE` で `yyyy-MM-dd HH:mm` を得るなど) | 却下 | 表示言語ではないロケールのデータに依存する。`format()` の出力は実装ごとに違ってよいので、その並びも保証されない                     |
| `formatToParts()` で `yyyy-MM-dd HH:mm` に組み立てる                              | 却下 | 部品の組み立ては MDN が想定する用途だが、書式を自前で持つ理由が無い                                                                 |
| date-fns の `format` にパターンを渡す                                             | 却下 | 書式を自前で持つ理由が無いうえ、`@date-fns/tz` を直接の依存に足す必要がある                                                         |
| Temporal                                                                          | 却下 | MDN で "Limited availability" (Baseline ではない)。テンプレートの Node 24 では `Temporal` が未定義だった (2026-09-27、Node 24.21.0) |

`format()` の出力は同じロケールでも実装ごとに違ってよいので (「整形した日時をテストで確かめる」が引く MDN の Note)、`format()` を使う `formatDateTime` には、サーバー (Node) とブラウザで文字列が変わる余地がある。`ja` の数値の書式で食い違った例は確認していない。
