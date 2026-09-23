import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";

/** 検索欄のアクセシブルネーム。placeholder と同じ文言 (見た目と読み上げを揃える)。 */
export const NOTE_SEARCH_LABEL = `${NOTE_ENTITY_LABEL}を検索`;

/**
 * 打鍵が止まってから一覧の取得を始めるまでの待ち。`useDebouncedValue` の `wait`。
 * 0 にすると打鍵ごとに server function が走る (ADR-0026)。
 * literal 型に固めない。ページのテストが `vi.mock` でこの値を広げる (`-components/notes-page.test.tsx` の `vi.mock`)
 */
export const NOTE_SEARCH_DEBOUNCE_MS: number = 300;

/**
 * 絞り込みの結果が入れ替わったときの通知文 (ADR-0035: `aria-busy` は印であって通知ではない)。
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
