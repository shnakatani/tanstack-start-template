import { describe, expect, it } from "vite-plus/test";

import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";

import { noteSearchResultMessage, toNoteListFilter } from "./note-search";

describe("toNoteListFilter", () => {
  it("前後の空白を落とす (URL 経由の validateSearch と同じ正規化)", () => {
    expect(toNoteListFilter("  abc  ")).toEqual({ q: "abc" });
  });

  it("空白だけなら絞り込みなし", () => {
    expect(toNoteListFilter("   ")).toEqual({ q: "" });
  });

  // 上限 cap = NOTE_QUERY_MAX_LENGTH。cap-1 / cap は保ち、cap+1 は cap で切る
  it("上限を超える分は切り、超えない分は保つ", () => {
    const cap = NOTE_QUERY_MAX_LENGTH;
    expect(toNoteListFilter("a".repeat(cap - 1))).toEqual({ q: "a".repeat(cap - 1) });
    expect(toNoteListFilter("a".repeat(cap))).toEqual({ q: "a".repeat(cap) });
    expect(toNoteListFilter("a".repeat(cap + 1))).toEqual({ q: "a".repeat(cap) });
  });

  it("trim してから上限を数える (前後の空白は上限に含めない)", () => {
    expect(toNoteListFilter(` ${"a".repeat(NOTE_QUERY_MAX_LENGTH)} `)).toEqual({
      q: "a".repeat(NOTE_QUERY_MAX_LENGTH),
    });
  });
});

describe("noteSearchResultMessage", () => {
  it("検索語が空なら解除の文言", () => {
    expect(noteSearchResultMessage("", 3)).toBe("絞り込みを解除し、メモを全件表示しています");
  });

  it("検索語があれば件数を含める (0 件も同じ形)", () => {
    expect(noteSearchResultMessage("abc", 0)).toBe("『abc』に一致するメモは 0 件です");
    expect(noteSearchResultMessage("abc", 2)).toBe("『abc』に一致するメモは 2 件です");
  });
});
