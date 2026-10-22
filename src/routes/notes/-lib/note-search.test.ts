import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it.each([
    { input: { q: "abc" }, expected: { q: "abc" }, label: "文字列の q はそのまま通す" },
    { input: {}, expected: { q: "" }, label: "q が無ければ既定の空文字" },
  ])("$label (warn を出さない)", ({ input, expected }) => {
    expect(v.parse(noteListSearchSchema, input)).toEqual(expected);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // URL の q は Router の既定の search パーサが JSON として先に読むので、手で書いた ?q=123 は number になる
  it.each([123, true, null, [1], { a: 1 }])(
    "文字列でない q (%o) は既定の空文字に落とし、受け取った値を warn に残す",
    (raw) => {
      expect(v.parse(noteListSearchSchema, { q: raw })).toEqual({ q: "" });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[notes]"), { rawInput: raw });
    },
  );
});
