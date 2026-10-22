import * as v from "valibot";
import { describe, expect, it, vi } from "vite-plus/test";

import { noteListSearchSchema, noteSearchResultMessage } from "./note-search";

describe("noteSearchResultMessage", () => {
  it("検索語が空なら解除の文言", () => {
    expect(noteSearchResultMessage("", 3)).toBe("絞り込みを解除し、メモを全件表示しています");
  });

  it("検索語があれば件数を含める (0 件も同じ形)", () => {
    expect(noteSearchResultMessage("abc", 0)).toBe("『abc』に一致するメモは 0 件です");
    expect(noteSearchResultMessage("abc", 2)).toBe("『abc』に一致するメモは 2 件です");
  });
});

describe("noteListSearchSchema", () => {
  it("文字列の q はそのまま通し、warn を出さない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(v.parse(noteListSearchSchema, { q: "abc" })).toEqual({ q: "abc" });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("q が無ければ既定の空文字で、warn を出さない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(v.parse(noteListSearchSchema, {})).toEqual({ q: "" });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  // URL の q は Router の既定の search パーサが JSON として先に読むので、手で書いた ?q=123 は number になる
  it.each([123, true, null, [1], { a: 1 }])(
    "文字列でない q (%o) は既定の空文字に落とし、受け取った値を warn に残す",
    (raw) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(v.parse(noteListSearchSchema, { q: raw })).toEqual({ q: "" });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("[notes]"), { rawInput: raw });
      } finally {
        warn.mockRestore();
      }
    },
  );
});
