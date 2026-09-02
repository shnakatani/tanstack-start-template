/**
 * 画面に出す日時の基準タイムゾーン。実行環境のローカルタイムゾーンには依存させない。
 * 利用者のタイムゾーンで出したくなったら、ここを差し替えるか値を引数で受ける形へ広げる。
 */
export const APP_TIME_ZONE = "Asia/Tokyo";

/**
 * SSR する画面で日時を出すときの正解形は「整形するタイムゾーンを明示する」こと。
 *
 * 実行環境のローカルタイムゾーンで壁時計を組み立てる整形 (`Date#getHours` 系や
 * タイムゾーン指定なしの日付ライブラリ) は、SSR (サーバーの TZ) と hydration
 * (ブラウザの TZ) で別の文字列になり React が hydration mismatch を報告する。
 * 両者の TZ が食い違う環境でしか出ないため、開発機だけを見ていると気付けない。
 *
 * ロケールに `sv-SE` を選ぶのは、数値既定の年月日時分が `yyyy-MM-dd HH:mm` の並びに
 * なるため。表示言語ではなく数値の並びだけをこのロケールから採っている。
 */
const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 日時を基準タイムゾーンの `yyyy-MM-dd HH:mm` で返す。 */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
