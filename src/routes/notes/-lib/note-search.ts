import * as v from "valibot";

import type { NoteListFilter } from "@/features/notes/schema";
import {
  NOTE_ENTITY_LABEL,
  NOTE_QUERY_MAX_LENGTH,
  noteListFilterSchema,
} from "@/features/notes/schema";
import { truncateCodeUnits } from "@/lib/truncate-code-units";

/** 検索欄のアクセシブルネーム。placeholder と同じ文言 (見た目と読み上げを揃える)。 */
export const NOTE_SEARCH_LABEL = `${NOTE_ENTITY_LABEL}を検索`;

/**
 * 打鍵が止まってから一覧の取得を始めるまでの待ち。`useDebouncedValue` の `wait`。
 * 0 にすると打鍵ごとに server function が走る (ADR-0033)。
 * literal 型に固めない。ページのテストが `vi.mock` でこの値を広げる (`-components/notes-page.test.tsx` の `vi.mock`)
 */
export const NOTE_SEARCH_DEBOUNCE_MS: number = 300;

/**
 * 入力欄の文字列を、URL と server function が受けるのと同じ絞り込み条件にする (ADR-0033)。
 *
 * 入力欄は URL を通らずに `useSuspenseQuery` の key になるので、ここで `noteListFilterSchema` と同じ
 * 正規化 (trim) を通す。通さないと `" abc"` と `"abc"` が別のキャッシュになり、取得が 2 回走る。
 * 上限は input の `maxLength` と同じ値で切る。IME の変換中は maxLength が効かず (React の
 * 変換中の change は facebook/react#8683)、確定の仕方によっては確定後も超える (Chromium 40520211)。
 * schema に通して throw させると一覧ごと Error Boundary に落ちる (ADR-0033)。
 * 切り詰めは maxLength と同じ規則を先に当てるだけなので記録しない。submit では入力欄にも反映する。
 * 呼ぶのは入力の直後に 1 回で、debounce / deferred / key / submit はその値から導く (使い忘れる場所を作らない)。
 * render から呼ぶので純粋に保つ
 */
export function toNoteListFilter(text: string): NoteListFilter {
  // 上限は input の maxLength と同じく UTF-16 の code unit で数える
  return v.parse(noteListFilterSchema, {
    q: truncateCodeUnits(text.trim(), NOTE_QUERY_MAX_LENGTH),
  });
}

/**
 * 絞り込みの結果が入れ替わったときの通知文 (ADR-0017: `aria-busy` は印であって通知ではない)。
 * 件数は楽観行を含めない (取得した一覧の件数)。
 */
export function noteSearchResultMessage(q: string, count: number): string {
  if (q === "") {
    return `絞り込みを解除し、${NOTE_ENTITY_LABEL}を全件表示しています`;
  }
  // 空状態の見出し (『…』に一致する…はありません) と同じ文字列にしない。テストの getByText が
  // live region と見出しの 2 要素に解決する
  return `『${q}』に一致する${NOTE_ENTITY_LABEL}は ${count} 件です`;
}
