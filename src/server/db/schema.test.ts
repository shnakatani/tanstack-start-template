import { describe, expectTypeOf, it } from "vite-plus/test";

import type { Note } from "@/features/notes/schema";
import type { notes } from "@/server/db/schema";

// テーブル定義と valibot のスキーマは別々に書く (フロントのスキーマをテーブル定義から作ると、
// クライアントの bundle に drizzle が入る。ADR-0033)。読み出しのずれを型で止める。書き込みは
// handlers.server.ts の insert が NoteInput を受けるので、そこの型検査が止める。
// 落とすのは `vp check` の type-aware lint で、`vp test run` は型検査をしない
describe("notes テーブルと valibot のスキーマ", () => {
  it("読み出した行の型が Note と一致する", () => {
    // 項目の有無・null を許すか・型のどれがずれても落ちる。入力スキーマへの項目の追加も、
    // Note が入力スキーマの entries を展開するのでここで落ちる
    expectTypeOf<typeof notes.$inferSelect>().toEqualTypeOf<Note>();
  });
});
