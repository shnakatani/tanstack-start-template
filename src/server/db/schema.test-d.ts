import { describe, expectTypeOf, it } from "vite-plus/test";

import type { Note } from "@/features/notes/schema";
import type { notes } from "@/server/db/schema";

// テーブル定義と valibot のスキーマの読み出しの型を突き合わせる (ADR-0034)。
// 検査のされ方は (docs/guides/testing/type-tests.md「型テストを置く」)
describe("notes テーブルと valibot のスキーマ", () => {
  it("読み出した行の型が Note と一致する", () => {
    // 入力スキーマへの項目の追加も、Note が入力スキーマの entries を展開するのでここで落ちる
    expectTypeOf<typeof notes.$inferSelect>().toEqualTypeOf<Note>();
  });
});
