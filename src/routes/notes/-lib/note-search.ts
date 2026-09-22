import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";

/** 検索欄のアクセシブルネーム。placeholder と同じ文言 (見た目と読み上げを揃える)。 */
export const NOTE_SEARCH_LABEL = `${NOTE_ENTITY_LABEL}を検索`;

/**
 * 打鍵が止まってから一覧の取得を始めるまでの待ち。`useDebouncedValue` の `wait`。
 * 0 にすると打鍵ごとに server function が走る (ADR-0033)。
 */
export const NOTE_SEARCH_DEBOUNCE_MS = 300;
