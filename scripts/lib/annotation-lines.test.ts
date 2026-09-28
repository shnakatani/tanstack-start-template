import { describe, expect, it } from "vite-plus/test";

import { describeAnnotations } from "./annotation-lines";

const ROOT = "/repo";

describe("describeAnnotations", () => {
  it("テスト名の下に、注釈ごとの位置と type と本文を並べる", () => {
    const lines = describeAnnotations(
      {
        moduleId: "/repo/src/a.test.tsx",
        fullName: "部品 > 描く",
        annotations: [
          {
            type: "warning",
            message: "判定できなかった項目",
            location: { file: "/repo/src/a.test.tsx", line: 14, column: 5 },
          },
        ],
      },
      ROOT,
    );

    expect(lines).toEqual([
      "✓ src/a.test.tsx > 部品 > 描く",
      "  ❯ src/a.test.tsx:14:5 warning",
      "    ↳ 判定できなかった項目",
    ]);
  });

  it("複数行の本文は、2 行目以降を 1 行目の本文の位置へ揃える", () => {
    const lines = describeAnnotations(
      {
        moduleId: "/repo/src/a.test.tsx",
        fullName: "描く",
        annotations: [
          {
            type: "warning",
            message: "見出し\ncolor-contrast (serious)",
            location: { file: "/repo/src/a.test.tsx", line: 3, column: 1 },
          },
        ],
      },
      ROOT,
    );

    expect(lines.slice(2)).toEqual(["    ↳ 見出し", "      color-contrast (serious)"]);
  });

  // location はテストファイルの外 (node_modules など) から呼ばれると付かない (vitest docs の guide/test-annotations の html)
  it("位置の無い注釈は、テストファイルのパスと type だけを出す", () => {
    const lines = describeAnnotations(
      {
        moduleId: "/repo/src/a.test.tsx",
        fullName: "描く",
        annotations: [{ type: "notice", message: "メモ" }],
      },
      ROOT,
    );

    expect(lines).toEqual(["✓ src/a.test.tsx > 描く", "  ❯ src/a.test.tsx notice", "    ↳ メモ"]);
  });

  it("注釈が無ければ何も出さない", () => {
    expect(
      describeAnnotations(
        { moduleId: "/repo/src/a.test.tsx", fullName: "描く", annotations: [] },
        ROOT,
      ),
    ).toEqual([]);
  });
});
