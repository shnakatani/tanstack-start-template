import { describe, expect, it } from "vite-plus/test";

import { NOTE, OTHER_NOTE, UPDATED_NOTE } from "@/features/notes/schema.test-helpers";

import { hasDifferingListRow } from "./note-list-staleness";

describe("hasDifferingListRow", () => {
  it("同じ id の行の updatedAt が違えば true", () => {
    // NOTE.updatedAt = 2026-08-17T00:30Z、UPDATED_NOTE.updatedAt = 2026-08-19T03:00Z (同じ id)
    expect(
      hasDifferingListRow(UPDATED_NOTE, [
        [
          ["notes", {}],
          [NOTE, OTHER_NOTE],
        ],
      ]),
    ).toBe(true);
  });

  it("updatedAt が 1 ms でも違えば true", () => {
    // 2026-08-17T00:30:00.000Z + 1 ms
    const later = { ...NOTE, updatedAt: new Date(NOTE.updatedAt.getTime() + 1) };

    expect(hasDifferingListRow(later, [[["notes", {}], [NOTE]]])).toBe(true);
  });

  it("同じ時刻の別の Date なら false", () => {
    const sameTime = { ...NOTE, updatedAt: new Date(NOTE.updatedAt.getTime()) };

    expect(
      hasDifferingListRow(sameTime, [
        [
          ["notes", {}],
          [NOTE, OTHER_NOTE],
        ],
      ]),
    ).toBe(false);
  });

  it("どれか 1 つの一覧で違えば、ほかの一覧で一致していても true", () => {
    expect(
      hasDifferingListRow(UPDATED_NOTE, [
        [["notes", {}], [UPDATED_NOTE]],
        [["notes", { q: "買い物" }], [NOTE]],
      ]),
    ).toBe(true);
  });

  it("その id の行がどの一覧にも無ければ false", () => {
    expect(hasDifferingListRow(UPDATED_NOTE, [[["notes", {}], [OTHER_NOTE]]])).toBe(false);
  });

  it("data の無い一覧と、一覧のキャッシュが 1 つも無いときは false", () => {
    expect(hasDifferingListRow(UPDATED_NOTE, [[["notes", {}], undefined]])).toBe(false);
    expect(hasDifferingListRow(UPDATED_NOTE, [])).toBe(false);
  });
});
