# ADR-0031: 日付と日時の値は意味で分類し、瞬間は UTC で、暦の日付は TZ を持たない日付で持つ

- Status: Accepted
- Date: 2026-09-27
- 関連: ADR-0013 (ドメイン型の導出。日付と日時の値の型もスキーマから導出する)

## Context

日付や日時の値は、意味によってタイムゾーン (TZ) の扱いが逆になる。

| 値の意味                                        | 例                             | TZ の扱い                                               |
| ----------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| 一点を指す時刻                                  | 作成日時、セッションの有効期限 | 値は TZ を持たない一点。見る場所の壁時計に直して見せる  |
| 誰から見ても同じ数字の日                        | 誕生日、期日のラベル           | TZ を持たない。変換すると日付がずれる                   |
| ある場所の 1 日、人が壁時計で約束した将来の時刻 | 現地の営業日、会議の開始時刻   | その場所の TZ で意味を持つ。TZ の定義は後から変わりうる |

JavaScript の `Date` は一点の時刻しか表せない。日付だけの値を `Date` で扱うと、TZ によって日付が前後にずれる。2026-09-27 に Node 24.21.0 で確かめた。

| 経路                                                          | 結果                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| JST で `new Date(2026, 7, 17).toISOString()`                  | `2026-08-16T15:00:00.000Z`。日付部分が 1 日前になる  |
| America/New_York で `new Date("2026-08-17")` のローカルの日付 | 8/16。日付だけの文字列は UTC の 0 時として解釈される |

TC39 の Temporal は、この区別を型で持つ。一点の時刻は `Instant`、TZ を持たない暦の日付は `PlainDate`、場所に結びつく日時は `ZonedDateTime` である。MDN「Temporal.PlainDate」は `PlainDate` を "a calendar date (a date without a time or time zone); for example, an event on a calendar which happens during the whole day no matter which time zone it's happening in" と説明する。Temporal は MDN で "Limited availability" (Baseline ではない) で、テンプレートの Node 24 では `Temporal` が未定義だった (2026-09-27)。

SQLite には日付専用の型が無い。SQLite「Datatypes In SQLite」は、日付と時刻を "TEXT as ISO8601 strings" "REAL as Julian day numbers" "INTEGER as Unix Time" のどれで持ってもよいとし、日付関数は内部を UTC で扱う (「Date And Time Functions」)。drizzle の `integer` の `timestamp_ms` は、UTC のエポックミリ秒で持つ。SQLite の Unix Time は秒なので、SQLite の日付関数へ渡すときは秒に直す。

SQLite の `date()` は、31 以下の日をその月の日数を超えたら翌月へ繰り越す。SQLite User Forum の「date function is broken」で、SQLite の開発者 Stephan Beal は "Any day number of 31 or less will, for months with fewer days, wrap around to the next month." と書く。値が `date()` の結果と一致するかを比べれば、暦に無い日付と、`date()` が別の値にする形を DB で弾ける。2026-09-28 に better-sqlite3 の SQLite 3.53.4 で確かめた。`2023-02-29` は `2023-03-01`、`2026-8-7` は NULL、`2026-08-07T00:00` は `2026-08-07` になり、一致しない。ただし SQLite「Date And Time Functions」は、日付関数が働く範囲を 0000-01-01 から 9999-12-31 とし、"For dates outside that range, the results of these functions are undefined." と書く。範囲外の負の年 `-0001-01-01` は、`date()` の結果と一致して通った。長さを 10 文字に限ると、`0000-01-01` と `9999-12-31` は通り、`-0001-01-01` は弾かれた。

日付を選ぶ入力部品の Calendar (中身は react-day-picker) は、今日を強調する。選択が無いときは今日の月を開き、`autoFocus` を付けていれば今日へフォーカスを移す。react-day-picker docs「Setting the Time Zone」は "By default, DayPicker uses the browser’s local time zone." と書き、shadcn docs の Calendar も利用者の TZ で見せる例を載せる。この Calendar をサーバーで描くと、サーバーとブラウザの TZ で日付が違う時間帯に、今日が食い違う。2026-09-27 に、React 19.3.0、react-day-picker 10.0.1、TanStack Start 1.168.49 の dev サーバーで確かめた。サーバーは `Pacific/Kiritimati` で今日が 9/28、ブラウザは `Asia/Tokyo` で今日が 9/27 だった。

| 描き方                                                              | hydration の後に今日として付いていた日 (1 日だけ)               | コンソール                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| サーバーで描く                                                      | 9/28 (強調の class、aria-label の "Today"、`tabindex="0"` ごと) | "A tree hydrated but some attributes of the server rendered HTML didn't match" の error |
| サーバーで描き、`timeZone` を `useEffect` で渡す (shadcn docs の例) | 9/28                                                            | 同上                                                                                    |
| `<ClientOnly>` (`@tanstack/react-router`) で囲む                    | 9/27                                                            | 無し                                                                                    |
| Popover の中に置く (`FormDateField` の形)                           | 9/27                                                            | 無し                                                                                    |

react.dev「hydrateRoot」は "There are no guarantees that attribute differences will be patched up in case of mismatches." と書く。サーバーの TZ とブラウザの TZ を同じ `Asia/Tokyo` にした対照では、今日の食い違いは出なかった。

## Decision

日付や日時の値を足すときは、値の意味で次の 4 つに分け、分類ごとに持ち方を決める。分類は Temporal の型に合わせる。

| 分類                     | 見分け方                                                            | 保存の形                                                                                          | ドメイン型 | 表示                                                 | Temporal の型                                           |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------------------------------- |
| 瞬間                     | 一点を指す時刻 (既に起きたことの記録、期間から計算した期限)         | UTC のエポックミリ秒 (`integer` の `timestamp_ms`)                                                | `Date`     | 決めた TZ の壁時計に直す。今は `APP_TIME_ZONE`       | `Instant`                                               |
| 暦の日付                 | 誰から見ても同じ数字の日                                            | `YYYY-MM-DD` の TEXT。`CHECK (<列> IS date(<列>) AND length(<列>) = 10)` で暦にある日付だけを通す | 文字列     | 変換せずにそのまま出す                               | `PlainDate`                                             |
| 場所に結びつく日付・日時 | ある場所の 1 日、人が壁時計で約束した将来の時刻                     | ローカルの日付や日時 (TEXT) と、IANA の TZ 名 (TEXT) を別の列で持つ。オフセットは持たない         | 文字列の組 | その TZ で意味を持つ。他の TZ で見せるときは変換する | 日時は `ZonedDateTime`。日付は `PlainDate` と TZ 名の組 |
| 「今日」や期限の判定     | 値ではなく判定 (期限を過ぎたか、既定値にする今日、選べる範囲の制限) | —                                                                                                 | —          | どの TZ の今日かを明示する。今は `APP_TIME_ZONE`     | `Temporal.Now.plainDateISO(timeZone)`                   |

- 暦の日付と、場所に結びつく日付・日時の値は、途中で `Date` や瞬間を経由しない。入力部品が `Date` を返すときは、その場で年・月・日だけを取り出して文字列にする
- 場所に結びつく日付・日時は、TZ が `APP_TIME_ZONE` の 1 つしか無くても TZ 名の列を持つ。値だけで意味が決まり、TZ を足しても列の形は変わらない。夏時間のある TZ を足すときは、重複する時刻を区別する規則が要るので、この ADR を書き換える (下の「扱わない値」)
- 人が壁時計で約束した将来の時刻 (会議の開始など) は、瞬間ではなく場所に結びつく日付・日時で持つ。保存したあとに TZ の定義が変わっても、約束した壁時計の時刻を保てる。期間から計算した期限 (有効期限など) は壁時計の約束を持たないので、瞬間で持つ
- 「今日」や期限の判定は、実行環境のローカル TZ に任せない。SSR では同じ判定がサーバーとブラウザの両方で走り、TZ が違うと今日が食い違う (サーバーが UTC なら、JST の 0 時から 9 時までは前日になる)
- 「今日」や期限の判定は、テストで時計を固定できる形にする (Vitest の `vi.setSystemTime`)
- 入力部品が入力の手助けとして見せる今日 (Calendar の今日の強調、選択が無いときに開く月とフォーカス先) は、「今日」や期限の判定に入れず、ブラウザの TZ に任せる。選ぶ人に、その人の暦の今日を見せる。その部品はブラウザでだけ描く (初めに閉じていて `keepMounted` を付けない Popover の中に置くか、`<ClientOnly>` で囲む)。サーバーで描くと、サーバーの今日が hydration の後も残る (Context の表)
- 選べる範囲の制限 (過去の日を選べなくするなど) は値の妥当性の判定なので、「今日」や期限の判定に従う。`APP_TIME_ZONE` の今日を求めてから Calendar に渡す。ブラウザの今日で決めると、サーバーの検証と割れる
- 既定値にする今日 (「今日」や期限の判定) と、Calendar が強調する今日は、`APP_TIME_ZONE` の外にいる利用者では、2 つの TZ で日付が違う時間帯に食い違ってよい

次の値は扱わない。足すときにこの ADR を書き換える。

| 扱わない値                                                     | 公式の型の例                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 時刻だけの値 (開店時刻、毎朝のアラーム)                        | Temporal `PlainTime`、java.time `LocalTime`、.NET `TimeOnly`                                                                       |
| 時間の長さ                                                     | Temporal `Duration`、java.time `Duration` / `Period`                                                                               |
| 年月だけ、月日だけの値                                         | Temporal `PlainYearMonth` / `PlainMonthDay`                                                                                        |
| 繰り返しの予定                                                 | iCalendar (RFC 5545) の RRULE                                                                                                      |
| TZ を持たない日時 (どの TZ でも同じローカル時刻に起きる出来事) | Temporal `PlainDateTime`                                                                                                           |
| 夏時間で存在しない時刻と重複する時刻の解決規則                 | `Asia/Tokyo` には夏時間が無い。夏時間のある TZ を足すときに決める。Temporal は `disambiguation` と `offset` のオプションで選ばせる |

### 検討した選択肢

| 案                                                                             | 評価                                                                                                                                                                                                                                                                                                | 採否     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 値の意味で分類し、分類ごとに持ち方を変える                                     | 主要な言語とライブラリの公式の型の分け方と一致する (「出典」の表)                                                                                                                                                                                                                                   | **採用** |
| すべてを瞬間 (UTC) で持つ                                                      | 暦の日付が TZ でずれる。Martin Fowler「Time Point」は、Outlook の終日の予定が時刻の範囲で持たれ、ボストンからシカゴへ移ると前日に表示された例を挙げる。Stack Overflow の定番の回答 (質問 2532729) は "Timestamping can use UTC, but future time scheduling and date-only values should not." と書く | 却下     |
| すべてをローカルの日時 (TZ なし) で持つ                                        | 瞬間を一意に表せない。PostgreSQL の wiki「Don't Do This」は TZ を持たない `timestamp` を "a picture of a calendar and a clock rather than a point in time" と呼び、瞬間には `timestamptz` を勧める                                                                                                  | 却下     |
| 場所に結びつく日付・日時の TZ をオフセットで持つ                               | オフセットは夏時間や TZ の定義の変更に追従しない。MDN「Temporal.ZonedDateTime」は "Avoid using offset identifiers if there is a named time zone you can use instead." と書く。RFC 9557 も、タイムスタンプの TZ の注記にオフセットを使う形を "strongly discouraged" とする                           | 却下     |
| 場所に結びつく日付・日時の TZ を列に持たず、規約で `APP_TIME_ZONE` とみなす    | 列は要らないが、TZ が増えたとき既存の値の TZ を規約からしか復元できない                                                                                                                                                                                                                             | 却下     |
| 瞬間をオフセット付き (記録時のオフセットを残す形) で持つ                       | .NET の `DateTimeOffset` と java.time の `OffsetDateTime` の形。記録した場所の壁時計を後で復元できるが、テンプレートの値 (作成日時) は記録時の場所を使わない。Django と PostgreSQL は UTC で持つ                                                                                                    | 却下     |
| Calendar の今日はブラウザの TZ に任せ、Calendar はブラウザでだけ描く           | react-day-picker の既定のまま使える。サーバーで描かない形は、gpbl/react-day-picker#2768 でメンテナが案内し、TanStack Start「Hydration Errors」の Strategy 3 (`<ClientOnly>`) にもある                                                                                                               | **採用** |
| Calendar の今日も `APP_TIME_ZONE` で決める (`timeZone` prop を渡す)            | サーバーとブラウザで今日が揃い、サーバーで描ける。代わりに、選択中の値を素の `Date` ではなく `TZDate` で渡す必要がある (react-day-picker docs「Working with time-zoned dates」)。`APP_TIME_ZONE` の外にいる利用者では、その人の暦の今日と食い違う                                                   | 却下     |
| Calendar をサーバーで描き、`timeZone` を `useEffect` で渡す (shadcn docs の例) | 今日の食い違いは直らなかった (Context の表)                                                                                                                                                                                                                                                         | 却下     |
| Calendar に `today` prop で `APP_TIME_ZONE` の今日を渡す                       | `timeZone` を使わないので素の `Date` のまま渡せ、サーバーとブラウザで今日が揃う。`APP_TIME_ZONE` の外にいる利用者では、その人の暦の今日と食い違う。実測していない                                                                                                                                   | 却下     |
| cookie で受けたブラウザの TZ を `timeZone` に渡し、Calendar をサーバーでも描く | TanStack Start「Hydration Errors」の Strategy 1 と 2。cookie が無い初回の訪問は決まった TZ (docs の例は UTC) で描くので、ブラウザの今日と食い違う。`timeZone` を使うので、選択中の値も `TZDate` で渡す必要がある。実測していない                                                                    | 却下     |
| Calendar を置く route を Selective SSR (`ssr: false` か `'data-only'`) にする  | TanStack Start「Hydration Errors」の Strategy 4。route 全体がサーバーで描かれなくなり、Calendar 以外の部分まで巻き込む。`<ClientOnly>` は Calendar だけを外せる。実測していない                                                                                                                     | 却下     |

## Consequences

- Temporal が使えるようになったとき、保存の形を変えずに読み替えられる。瞬間は `Instant`、暦の日付は `PlainDate`、場所に結びつく日時は `ZonedDateTime`、場所に結びつく日付は `PlainDate` と TZ 名の組になる
- 暦の日付の値は `Date` を経由できないので、`Date` を返す入力部品 (Calendar など) との境界に変換が要る。変換の手順は `docs/guides/dates-and-time-zones.md` が持つ
- 暦の日付の値を `new Date("YYYY-MM-DD")` で読むと、ブラウザの TZ によって 1 日ずれる。型は文字列なので、`Date` に渡すまでは型検査で気付けない
- 再評価の条件: Temporal が Baseline になり、テンプレートの Node で使えるようになったら、ドメイン型を Temporal の型へ移すかを見直す。保存の形は変えない

## 出典

| 出典                                                                                                                                                                           | 使った内容                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| MDN「Temporal」 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal                                                                      | 一点の時刻と、TZ を持たない calendar date / wall-clock time の区別                                                                     |
| MDN「Temporal.PlainDate」 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate                                                  | 暦の日付の定義                                                                                                                         |
| MDN「Temporal.ZonedDateTime」 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime                                          | 将来の時刻は、保存後に TZ の定義が変わりうる                                                                                           |
| TC39 Temporal の提案文書 https://tc39.es/proposal-temporal/docs/                                                                                                               | `ZonedDateTime` の文書は "As the only `Temporal` type that persists a time zone" と書く。`PlainDateTime` の文書に、TZ を別の列に持つ形 |
| java.time `LocalDate` の Javadoc                                                                                                                                               | "a description of the date, as used for birthdays"                                                                                     |
| .NET「Choose between DateTime, DateOnly, DateTimeOffset, TimeSpan, TimeOnly, and TimeZoneInfo」 https://learn.microsoft.com/dotnet/standard/datetime/choosing-between-datetime | `DateOnly` は "can't be offset by a time zone"                                                                                         |
| Django「Time zones」 https://docs.djangoproject.com/en/stable/topics/i18n/timezones/                                                                                           | datetime は UTC で保存する。date は "a **calendaring concept**" で、datetime から date への変換を避ける                                |
| PostgreSQL wiki「Don't Do This」 https://wiki.postgresql.org/wiki/Don%27t_Do_This                                                                                              | 瞬間には `timestamptz`。TZ を持たない `timestamp` は時計の絵                                                                           |
| RFC 9557 https://www.rfc-editor.org/rfc/rfc9557                                                                                                                                | タイムスタンプの TZ の注記にオフセットを使う形を強く非推奨とする                                                                       |
| SQLite「Datatypes In SQLite」 https://www.sqlite.org/datatype3.html                                                                                                            | 日付専用の型は無く、TEXT・REAL・INTEGER で持つ                                                                                         |
| SQLite User Forum「date function is broken」 https://sqlite.org/forum/forumpost/67e07534e6                                                                                     | `date()` は 31 以下の日を翌月へ繰り越す (SQLite の開発者の回答)                                                                        |
| Google Calendar API「Events」 https://developers.google.com/workspace/calendar/api/v3/reference/events                                                                         | 終日の予定は TZ を持たない `date` (`yyyy-mm-dd`)。繰り返しの予定では IANA の名前の `timeZone` が必須                                   |
| Martin Fowler「Time Point」 https://martinfowler.com/eaaDev/TimePoint.html                                                                                                     | 終日の予定を時刻の範囲で持ったときのずれの例                                                                                           |
| react-day-picker docs「Setting the Time Zone」 https://daypicker.dev/localization/setting-time-zone                                                                            | 既定はブラウザのローカル TZ。`timeZone` を渡すときは `TZDate` で読み書きする                                                           |
| shadcn docs「Calendar」の「Selected Date (With TimeZone)」 https://ui.shadcn.com/docs/components/base/calendar                                                                 | 利用者の TZ を `useEffect` の中で取って `timeZone` に渡す例                                                                            |
| gpbl/react-day-picker#2768 https://github.com/gpbl/react-day-picker/issues/2768                                                                                                | Next.js 15 でビルド時に描いた日の today が残り、今日が 2 つ付く。メンテナは DayPicker をサーバーで描かない形を案内した                 |
| react.dev「hydrateRoot」 https://react.dev/reference/react-dom/client/hydrateRoot                                                                                              | hydration で食い違った属性は直される保証が無い                                                                                         |
| TanStack Start「Hydration Errors」 https://tanstack.com/start/latest/docs/framework/react/guide/hydration-errors                                                               | TZ は食い違いの原因の 1 つ。Strategy 3 は `<ClientOnly>` で囲む                                                                        |
