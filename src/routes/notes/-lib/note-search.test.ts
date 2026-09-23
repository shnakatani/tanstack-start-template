import { describe, expect, it } from "vite-plus/test";

import { noteSearchResultMessage } from "./note-search";

describe("noteSearchResultMessage", () => {
  it("検索語が空なら解除の文言", () => {
    expect(noteSearchResultMessage("", 3)).toBe("絞り込みを解除し、メモを全件表示しています");
  });

  it("検索語があれば件数を含める (0 件も同じ形)", () => {
    expect(noteSearchResultMessage("abc", 0)).toBe("『abc』に一致するメモは 0 件です");
    expect(noteSearchResultMessage("abc", 2)).toBe("『abc』に一致するメモは 2 件です");
  });
});
