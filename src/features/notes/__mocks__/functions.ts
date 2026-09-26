import { vi } from "vite-plus/test";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// テストは factory なしの `vi.mock("@/features/notes/functions")` でこのファイルへ差し替え、
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
export const listNotes = vi.fn();
export const createNote = vi.fn();
export const removeNote = vi.fn();
