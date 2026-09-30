import { format } from "date-fns/format";
import { ja } from "date-fns/locale/ja";

import { parseCalendarDate } from "./calendar-date";

/**
 * 暦の日付 (ADR-0031) を画面の文字列にする。`calendar-date.ts` と分けるのは、あちらはスキーマの検証から
 * 読まれて main bundle に入るため。format とロケールのデータを同じ module に置くと、それらも main bundle へ入る
 */

type CalendarDateLabelLength = "short" | "long";

/** date-fns のロケールの書式。並びと区切りは ja のデータ (formatLong) に任せ、パターンを自前で持たない */
const LABEL_PATTERNS = { short: "P", long: "PPP" } as const satisfies Record<
  CalendarDateLabelLength,
  string
>;

/**
 * `YYYY-MM-DD` を画面に出す文字列にする。short は 2026/08/07、long は 2026年8月7日。
 * ローカルの 0 時を同じローカル TZ で整形するので、サーバーとブラウザの TZ が違っても同じ文字列になる。
 * 瞬間と違い `in: tz(APP_TIME_ZONE)` を渡さない
 */
export function formatCalendarDateLabel(value: string, length: CalendarDateLabelLength): string {
  return format(parseCalendarDate(value), LABEL_PATTERNS[length], { locale: ja });
}
