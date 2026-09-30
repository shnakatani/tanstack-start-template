import { formatISO } from "date-fns/formatISO";
import { isValid } from "date-fns/isValid";
import { parseISO } from "date-fns/parseISO";

/**
 * 暦の日付 (ADR-0031) の `YYYY-MM-DD` と、入力部品が返す `Date` の境界。
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
  const date = CALENDAR_DATE_PATTERN.test(value) ? parseISO(value) : undefined;
  if (date === undefined || !isValid(date)) {
    throw new Error(`暦の日付ではない: ${value}`);
  }
  return date;
}

/** `YYYY-MM-DD` の形の文字列が、暦に存在する日付か。2023-02-29 は false。形式はスキーマの `isoDate()` が見る */
export function isExistingCalendarDate(value: string): boolean {
  return isValid(parseISO(value));
}
