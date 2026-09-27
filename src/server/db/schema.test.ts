import { describe, expectTypeOf, it } from "vite-plus/test";

import type { Note, NoteInput } from "@/features/notes/schema";
import { notes } from "@/server/db/schema";

// テーブル定義と valibot のスキーマは別々に書く (フロントのスキーマをテーブル定義から作ると、
// クライアントの bundle に drizzle が入る。ADR-0033)。2 つのずれを型で止める。
// 落とすのは `vp check` の type-aware lint で、`vp test run` は型検査をしない
describe("notes テーブルと valibot のスキーマ", () => {
  it("読み出した行の型が Note と一致する", () => {
    // 項目の有無・null を許すか・型のどれがずれても落ちる。入力スキーマへの項目の追加も、
    // Note が入力スキーマの entries を展開するのでここで落ちる
    expectTypeOf<typeof notes.$inferSelect>().toEqualTypeOf<Note>();
  });

  it("NoteInput をそのまま insert できる", () => {
    // DB が値を入れない NOT NULL の列を足すと、NoteInput に無い必須の項目になって落ちる
    expectTypeOf<NoteInput>().toExtend<typeof notes.$inferInsert>();
  });
});
