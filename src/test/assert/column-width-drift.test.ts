import { describe, expect, it } from "vite-plus/test";

import { columnWidthDrifts } from "./column-width-drift";

const TOLERANCE_PX = 0.5;

describe("columnWidthDrifts", () => {
  it("どの列も動いていなければ空", () => {
    expect(
      columnWidthDrifts(
        [
          [100, 200, 50],
          [100, 200, 50],
          [100, 200, 50],
        ],
        TOLERANCE_PX,
      ),
    ).toEqual([]);
  });

  // 境界は含まない。0.5px 未満のずれは sub-pixel の丸めで、動いたとは見なさない
  it("許容幅より小さいずれは動いたと見なさない", () => {
    expect(columnWidthDrifts([[100.2], [100.6]], TOLERANCE_PX)).toEqual([]);
  });

  it("動いた列を、最初の frame からのずれが最大の frame で 1 行ずつ返す", () => {
    // 操作の列 (列 3) が Spinner で広がり、title の列 (列 1) がその分だけ狭まる
    expect(
      columnWidthDrifts(
        [
          [300, 200, 50],
          [290, 200, 60],
          [266, 200, 84],
          [300, 200, 50],
        ],
        TOLERANCE_PX,
      ),
    ).toEqual([
      "列 1: 300.0 → 266.0 (-34.0px, frame 3/4)",
      "列 3: 50.0 → 84.0 (+34.0px, frame 3/4)",
    ]);
  });

  it("frame が 1 つだけの記録は、何も比べていないので通さない", () => {
    expect(columnWidthDrifts([[100, 200]], TOLERANCE_PX)).toEqual(["frames 1"]);
  });

  it("frame が無い記録も通さない", () => {
    expect(columnWidthDrifts([], TOLERANCE_PX)).toEqual(["frames 0"]);
  });

  it("列の数が途中で変わった記録は、幅を比べずにそのことを返す", () => {
    expect(
      columnWidthDrifts(
        [
          [100, 200, 50],
          [100, 200],
        ],
        TOLERANCE_PX,
      ),
    ).toEqual(["columns 3 → 2"]);
  });
});
