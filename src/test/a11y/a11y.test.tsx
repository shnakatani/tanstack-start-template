import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "./a11y";

describe("expectNoA11yViolations", () => {
  afterEach(() => vi.restoreAllMocks());

  it(
    "axe が判定できなかった項目を warning の注釈で残し、console.warn には出さない",
    { tags: ["axe"] },
    async ({ task }) => {
      // グラデーションの上の文字は背景色を 1 つに決められず、color-contrast が incomplete になる
      const screen = await render(
        <main style={{ backgroundImage: "linear-gradient(white, black)" }}>
          <p>グラデーションの上の文字</p>
        </main>,
      );
      const annotate = vi.fn();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expectNoA11yViolations(screen.container, { annotate, task });

      expect(annotate).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("color-contrast"),
        "warning",
      );
      // 注釈を見るのは github-actions と verbose の reporter。console.warn にも出すと二重になる
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("判定できなかった項目が無ければ注釈を残さない", { tags: ["axe"] }, async ({ task }) => {
    const screen = await render(
      <main>
        <p>白地の黒い文字</p>
      </main>,
    );
    const annotate = vi.fn();

    await expectNoA11yViolations(screen.container, { annotate, task });

    expect(annotate).not.toHaveBeenCalled();
  });

  // tag で絞った実行から、付け忘れたテストが黙って漏れないようにする
  it("axe の tag が無いテストで呼ぶと、tag を足すよう求めて落ちる", async ({ task }) => {
    const screen = await render(
      <main>
        <p>白地の黒い文字</p>
      </main>,
    );

    await expect(
      expectNoA11yViolations(screen.container, { annotate: vi.fn(), task }),
    ).rejects.toThrow('tags: ["axe"]');
  });

  // tag は呼んだテスト自身の文脈から読む。実行中のテストを 1 つだけ持つグローバルから読むと、
  // 並行で走る別のテストの tag を読む (vitest docs の guide/test-context の expect)
  describe.concurrent("並行で走るテスト", () => {
    it(
      "axe の tag を持つテストは、tag の無いテストと並行しても落ちない",
      { tags: ["axe"] },
      async ({ task }) => {
        // 隣の tag の無いテストが始まるのを待つ
        await new Promise((resolve) => setTimeout(resolve, 50));
        // 並行するテストは同じ iframe で動き、隣の beforeEach の cleanup が render した DOM を消す。
        // React を通さずに置く
        const main = document.createElement("main");
        main.innerHTML = "<p>白地の黒い文字</p>";
        document.body.append(main);
        try {
          await expectNoA11yViolations(main, { annotate: vi.fn(), task });
        } finally {
          main.remove();
        }
      },
    );

    it("tag の無いテスト", async ({ task }) => {
      expect(task.tags).not.toContain("axe");
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  });
});
