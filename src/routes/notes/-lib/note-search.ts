import * as v from "valibot";

import type { NoteListFilter } from "@/features/notes/schema";
import {
  NOTE_ENTITY_LABEL,
  NOTE_QUERY_MAX_LENGTH,
  noteListFilterSchema,
} from "@/features/notes/schema";

/** 検索欄のアクセシブルネーム。placeholder と同じ文言 (見た目と読み上げを揃える)。 */
export const NOTE_SEARCH_LABEL = `${NOTE_ENTITY_LABEL}を検索`;

/**
 * 打鍵が止まってから一覧の取得を始めるまでの待ち。`useDebouncedValue` の `wait`。
 * 0 にすると打鍵ごとに server function が走る (ADR-0033)。
 */
export const NOTE_SEARCH_DEBOUNCE_MS = 300;

/**
 * 入力欄の文字列を、URL と server function が受けるのと同じ絞り込み条件にする (ADR-0033)。
 *
 * 入力欄は URL を通らずに `useSuspenseQuery` の key になるので、ここで `noteListFilterSchema` と同じ
 * 正規化 (trim) を通す。通さないと `" abc"` と `"abc"` が別のキャッシュになり、取得が 2 回走る。
 * 上限は input の `maxLength` と同じ値で切る。IME の変換中は `maxLength` が効かず、確定前に
 * debounce が明けると上限超えの文字列が届く。schema に通して throw させると一覧ごと
 * Error Boundary に落ちる (`.claude/rules/implementation.md`「操作の失敗を Error Boundary へ届けない」)。
 */
export function toNoteListFilter(text: string): NoteListFilter {
  return v.parse(noteListFilterSchema, { q: text.trim().slice(0, NOTE_QUERY_MAX_LENGTH) });
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
