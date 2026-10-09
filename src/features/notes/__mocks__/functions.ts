import { vi } from "vite-plus/test";

// server functions は Start の server runtime (node:async_hooks) と実 DB (better-sqlite3) を引くため、
// ブラウザテストからは読ませない。
// テストは factory なしの `vi.mock(import("@/features/notes/functions"))` でこのファイルへ差し替え、
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
export const listNotes = vi.fn();
export const getNote = vi.fn();
export const createNote = vi.fn();
export const updateNote = vi.fn();
export const removeNote = vi.fn();
