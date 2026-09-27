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
 * 書式は画面の言語 (`<html lang="ja">`) のロケールに任せる。区切りや並びを自前で決めない。
 */
const dateTimeFormatter = new Intl.DateTimeFormat("ja", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 日時を基準タイムゾーンの年・月・日・時・分で、画面の言語の書式で返す。 */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
