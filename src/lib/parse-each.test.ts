import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { parseEach } from "./parse-each";

const itemSchema = v.object({ id: v.pipe(v.number(), v.integer()) });

describe("parseEach", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("schema を満たす要素の出力を入力順に並べて返す", () => {
    expect(parseEach(itemSchema, [{ id: 1 }, { id: 2 }], "[test]")).toEqual([{ id: 1 }, { id: 2 }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("満たさない要素は prefix と raw input を warn に残して除外する", () => {
    expect(parseEach(itemSchema, [{ id: 1 }, { id: 1.5 }, undefined], "[test]")).toEqual([
      { id: 1 },
    ]);

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith("[test]", { rawInput: { id: 1.5 } });
    expect(warnSpy).toHaveBeenCalledWith("[test]", { rawInput: undefined });
  });
});
