import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NOTE_UPDATE, OTHER_NOTE } from "./schema.test-helpers";
import { parseUpdatingNotes } from "./updating-rows";

/**
 * `useMutationState` の `select` が返す `variables` は `unknown`。行の突き合わせに使う前に
 * 更新の形 (`NoteUpdate`) へ絞る関数の境界テスト。除外は silent にせず warn を残す。
 */
describe("parseUpdatingNotes", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("更新の形の値を並べて返す", () => {
    const updates = [
      NOTE_UPDATE,
      { id: OTHER_NOTE.id, title: OTHER_NOTE.title, body: "", dueDate: null },
    ];

    expect(parseUpdatingNotes(updates)).toEqual(updates);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("更新の形を満たさない値は warn を残して除外する", () => {
    const { id: _id, ...withoutId } = NOTE_UPDATE;
    const { title: _title, ...withoutTitle } = NOTE_UPDATE;
    // id の 0 は noteIdSchema の境界 (autoincrement rowid は 1 始まりの整数)。id 欠落は作成の
    // variables (NoteInput) の形、title 欠落は入力項目の欠け。素の number と undefined は、
    // `variables` が `unknown` で届く経路
    const invalid = [{ ...NOTE_UPDATE, id: 0 }, withoutId, withoutTitle, 1, undefined];

    expect(parseUpdatingNotes([NOTE_UPDATE, ...invalid])).toEqual([NOTE_UPDATE]);

    expect(warnSpy).toHaveBeenCalledTimes(invalid.length);
    expect(warnSpy).toHaveBeenCalledWith("[parseUpdatingNotes] variables が更新の形でない", {
      rawInput: 1,
    });
  });
});
