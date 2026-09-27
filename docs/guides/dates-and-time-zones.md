# 日時とタイムゾーン

画面に日時を出すときに、どのタイムゾーンで整形するかを持つ。テストでタイムゾーンを扱う方法は `docs/guides/testing/time-zones.md` が持つ。

## how-to

### 画面に日時を出す

- 日時は `formatDateTime` (`src/lib/format-date-time.ts`) を通して整形する。`APP_TIME_ZONE` を `Intl.DateTimeFormat` の `timeZone` に渡すので、サーバーとブラウザで同じ文字列になる。実例は `src/routes/notes/-components/note-cells.tsx`
- 別の書式が要るときも `timeZone: APP_TIME_ZONE` を渡した `Intl.DateTimeFormat` で組み、`src/lib/format-date-time.ts` に並べる
- 描画する値を、実行環境のローカル TZ で組み立てない。`Date#toLocaleString` 系、`Date#getHours` 系、`timeZone` を渡さない `Intl.DateTimeFormat` が当たる。`timeZone` の既定は "the runtime's time zone" (MDN「Intl.DateTimeFormat() constructor」の `timeZone`)
- date-fns で整形するときは、各関数の `in` オプションに `tz(APP_TIME_ZONE)` を渡すか、値を `TZDate` にする。渡さないと date-fns はシステムの TZ で計算する (date-fns 同梱の `docs/timeZones.md`「Working with time zones」)
- `tz` と `TZDate` は `@date-fns/tz` の export で、テンプレートの直接の依存には入っていない (react-day-picker 経由でだけ入っている)。使うときは `vp add @date-fns/tz` で直接の依存に足す
- 利用者ごとのタイムゾーンで出したくなったら、`APP_TIME_ZONE` を固定値から「サーバーで一度決めてクライアントへ渡す値」に変える。決め方は TanStack Start「Hydration Errors」の Strategy 1 と 2 (cookie を正とし、無い間は決まった値を使う)

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

### 書式に `sv-SE` のロケールを使う理由

`sv-SE` の数値の既定の並びが `yyyy-MM-dd HH:mm` になるため。表示言語ではなく、数値の並びだけをこのロケールから採っている。`formatDateTime` の docstring にも同じ理由がある。
