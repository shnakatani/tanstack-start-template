# 日時とタイムゾーン

画面に日時を出すときに、どのタイムゾーンで整形するかを持つ。テストでタイムゾーンを扱う方法は `docs/guides/testing/time-zones.md` が持つ。

## how-to

### 画面に日時を出す

- 日時は `formatDateTime` (`src/lib/format-date-time.ts`) を通して整形する。`APP_TIME_ZONE` を `Intl.DateTimeFormat` の `timeZone` に渡すので、サーバーとブラウザで同じタイムゾーンの壁時計になる。書式は画面の言語 (`<html lang="ja">`) のロケールに任せる。実例は `src/routes/notes/-components/note-cells.tsx`
- 別の書式が要るときも `timeZone: APP_TIME_ZONE` を渡した `Intl.DateTimeFormat` で組み、`src/lib/format-date-time.ts` に並べる。並びや区切りはオプション (`dateStyle`、`month: "long"` など) で選び、ロケールを別の言語に替えて並びを得ない (「書式をロケールに任せる理由」)
- ロケールに無い並びがどうしても要るときは、`formatToParts()` で部品を取り出して組み立てる。MDN「Intl.DateTimeFormat.prototype.formatToParts()」は "useful for building custom strings from the locale-specific tokens" と書く
- 描画する値を、実行環境のローカル TZ で組み立てない。`Date#toLocaleString` 系、`Date#getHours` 系、`timeZone` を渡さない `Intl.DateTimeFormat` が当たる。`timeZone` の既定は "the runtime's time zone" (MDN「Intl.DateTimeFormat() constructor」の `timeZone`)
- date-fns で整形するときは、各関数の `in` オプションに `tz(APP_TIME_ZONE)` を渡すか、値を `TZDate` にする。渡さないと date-fns はシステムの TZ で計算する (date-fns 同梱の `docs/timeZones.md`「Working with time zones」)
- `tz` と `TZDate` は `@date-fns/tz` の export で、テンプレートの直接の依存には入っていない (react-day-picker 経由でだけ入っている)。使うときは `vp add @date-fns/tz` で直接の依存に足す
- 利用者ごとのタイムゾーンで出したくなったら、`APP_TIME_ZONE` を固定値から「サーバーで一度決めてクライアントへ渡す値」に変える。決め方は TanStack Start「Hydration Errors」の Strategy 1 と 2 (cookie を正とし、無い間は決まった値を使う)

### 整形した日時をテストで確かめる

- `format()` の出力を固定の文字列と比べない。MDN「Intl.DateTimeFormat.prototype.format()」の Note は "the output may vary between implementations, even within the same locale" "You should not compare the results of `format()` to hardcoded constants." と書く
- 壁時計の値は、出力から数字の並び (年・月・日・時・分) を取り出して比べる。実例は `src/lib/format-date-time.test.ts`
- 画面に描いた文字列を探すテストは、期待値を `formatDateTime` で作る。実例は `src/features/notes/schema.test-helpers.ts` の `NOTE_CREATED_AT_TEXT`

### 日付の入力を扱う

- `Calendar` (`src/components/ui/calendar.tsx`、中身は react-day-picker) は、既定でブラウザのローカル TZ で日付を組む。react-day-picker docs「Setting the Time Zone」は "By default, DayPicker uses the browser's local time zone." と書く
- `timeZone` prop を渡すと、指定した TZ で日付を読み書きする。その場合、値は素の `Date` ではなく `TZDate` で扱う (同じ docs「Working with time-zoned dates」)。react-day-picker 10.0.1 は `TZDate` を `@date-fns/tz` から再 export している。テンプレートは `timeZone` prop を今は使っていない

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
| 並びが目的の形に近い別の言語のロケール (`sv-SE` で `yyyy-MM-dd HH:mm` を得るなど) | 却下 | 表示言語ではないロケールのデータに依存する。出力は実装ごとに違ってよいので、その並びも保証されない                                  |
| `formatToParts()` で `yyyy-MM-dd HH:mm` に組み立てる                              | 却下 | 部品の組み立ては MDN が想定する用途だが、書式を自前で持つ理由が無い                                                                 |
| date-fns の `format` にパターンを渡す                                             | 却下 | 書式を自前で持つ理由が無いうえ、`@date-fns/tz` を直接の依存に足す必要がある                                                         |
| Temporal                                                                          | 却下 | MDN で "Limited availability" (Baseline ではない)。テンプレートの Node 24 では `Temporal` が未定義だった (2026-09-27、Node 24.21.0) |

ロケールの書式は、サーバー (Node) とブラウザで ICU の版が違うと文字列が変わりうる (MDN の同じ Note)。`ja` の数値の書式で食い違った例は確認していない。
