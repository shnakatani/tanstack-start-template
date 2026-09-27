import { format } from "date-fns/format";
import { formatISO } from "date-fns/formatISO";
import { isValid } from "date-fns/isValid";
import { ja } from "date-fns/locale/ja";
import { parseISO } from "date-fns/parseISO";

/**
 * 暦の日付 (ADR-0031 の分類 2) の `YYYY-MM-DD` と、入力部品が返す `Date` の境界。
 * `Date` はローカル TZ の 0 時として扱い、年・月・日だけを出し入れする。`toISOString()` と
 * `new Date("YYYY-MM-DD")` は UTC を挟み、TZ によって 1 日ずれる
 * (`docs/guides/dates-and-time-zones.md`「日付の入力を扱う」)。
 */

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** ローカル TZ の年・月・日を `YYYY-MM-DD` にする。Calendar が返す `Date` を form の値にするときに使う */
export function formatCalendarDate(date: Date): string {
  return formatISO(date, { representation: "date" });
}

/**
 * `YYYY-MM-DD` をローカル TZ の 0 時の `Date` にする。Calendar の `selected` と画面の文字列に使う。
 * 形式違いと暦に無い日付は throw する。Invalid Date を返すと Calendar は何も選ばない表示になり、
 * 壊れた値が画面から見えなくなる。正規の経路の値は、スキーマの `v.check` が `isExistingCalendarDate` で検証している
 */
export function parseCalendarDate(value: string): Date {
  if (!CALENDAR_DATE_PATTERN.test(value) || !isExistingCalendarDate(value)) {
    throw new Error(`暦の日付ではない: ${value}`);
  }
  return parseISO(value);
}

/** `YYYY-MM-DD` の形の文字列が、暦に存在する日付か。2023-02-29 は false。形式はスキーマの `isoDate()` が見る */
export function isExistingCalendarDate(value: string): boolean {
  return isValid(parseISO(value));
}

type CalendarDateLabelLength = "short" | "long";

/** date-fns のロケールの書式。並びと区切りは ja のデータ (formatLong) に任せ、パターンを自前で持たない */
const LABEL_PATTERNS = { short: "P", long: "PPP" } as const satisfies Record<
  CalendarDateLabelLength,
  string
>;

/**
 * `YYYY-MM-DD` を画面に出す文字列にする。short は 2026/08/07、long は 2026年8月7日。
 * ローカルの 0 時を同じローカル TZ で整形するので、サーバーとブラウザの TZ が違っても同じ文字列になる。
 * 瞬間 (分類 1) と違い `in: tz(APP_TIME_ZONE)` を渡さない
 */
export function formatCalendarDateLabel(value: string, length: CalendarDateLabelLength): string {
  return format(parseCalendarDate(value), LABEL_PATTERNS[length], { locale: ja });
}
