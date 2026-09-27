import { describe, expect, it } from "vitest";

import { NOTE_COLUMN_IDS } from "./note-column-ids";
import { noteColumns } from "./note-columns";

describe("noteColumns", () => {
  it("列の並びが NOTE_COLUMN_IDS と一致する", () => {
    expect(noteColumns.map((column) => column.id)).toEqual(NOTE_COLUMN_IDS);
  });
});
