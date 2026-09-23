import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { expectAbsent, expectRemoved } from "@/test/absent";

/**
 * registry は `{children}` を `ScrollArea.Viewport` へ直接置き、base-ui の
 * `ScrollArea.Content` を使っていない (shadcn-ui/ui#10534)。Content は ResizeObserver で
 * 内容の寸法変化を拾い thumb と overflow 判定を再計算するパートで、上流 base-ui は
 * 「期待される構造は Root > Viewport > Content」と回答している (mui/base-ui#4696、CLOSED)。
 *
 * viewport の高さが内容に追随する `max-h-*` では viewport 自身の resize が再計算を誘発する
 * ため差が出ない。高さが固定される使い方 (`h-*` や flex で伸びた領域) で顕在化する。
 * `docs/registry-deviations.md` の表がこのファイルをガードに指名している。
 */
function Harness() {
  const [many, setMany] = useState(true);
  const rows = Array.from({ length: many ? 30 : 2 }, (_, i) => `行 ${i + 1}`);
  return (
    <div data-testid="scroll-area-harness">
      <button type="button" onClick={() => setMany(false)}>
        減らす
      </button>
      {/* 内容が縮んでも viewport は縮まない = 再計算のきっかけが Content しかない */}
      <ScrollArea viewportClassName="h-24">
        {rows.map((row) => (
          <p key={row}>{row}</p>
        ))}
      </ScrollArea>
    </div>
  );
}

describe("ScrollArea", () => {
  it("高さ固定の領域で内容が縮んだとき overflow 判定が更新される", async () => {
    const screen = await render(<Harness />);
    const viewport = screen.getByTestId("scroll-area-harness").getBySlot("scroll-area-viewport");

    await expect.element(viewport).toHaveAttribute("data-has-overflow-y");

    await screen.getByRole("button", { name: "減らす" }).click();

    // ユーザーがスクロールしなくても再計算される (Content の ResizeObserver 経由)
    await expect.element(viewport).not.toHaveAttribute("data-has-overflow-y");
  });
});

/**
 * 余白が `ScrollBar` の太さと一致することを、Viewport の端とバーの端の一致で固定する。
 * 一致で見るのは、足りなければバーが内容に被り、余ればバーの無い空帯が残るため。
 * 端の一致は矩形でしか表せないので `getBoundingClientRect` を読む。mount を `expect.element` で待ってから読む (ADR-0040)。
 *
 * 寸法は `size-24` = 4px * 24 = 96px、`pb-2.5` / `pr-2.5` = 4px * 2.5 = 10px
 * (`--spacing` は既定の 0.25rem。`src/styles.css` の `@theme` は色しか触っていない)。
 * したがって片軸が溢れた Root の Viewport は 86px 四方になる。
 */
/** Viewport (最大 96px) を確実に超える内容幅・高さ */
const OVERFLOWING_PX = 400;
/** 余白が付いた Viewport (86px) にも収まる内容幅・高さ */
const FITTING_PX = 20;
function Overflowing({ x, y }: { x: boolean | number; y: boolean }) {
  return (
    <ScrollArea className="size-24" data-testid="gutter-root">
      <div
        style={{
          minWidth: typeof x === "number" ? x : x ? OVERFLOWING_PX : FITTING_PX,
          minHeight: y ? OVERFLOWING_PX : FITTING_PX,
        }}
      />
    </ScrollArea>
  );
}

type Orientation = "horizontal" | "vertical";

/** poll のコールバックの中から呼び、observation ごとに locator を引き直す (ADR-0043) */
function rect(locator: Locator): DOMRect {
  return locator.element().getBoundingClientRect();
}

/** 溢れていない軸のバーは DOM に出ない (base-ui は keepMounted=false) */
function scrollbar(root: Locator, orientation: Orientation) {
  return root.getBySlot("scroll-area-scrollbar", { "data-orientation": orientation });
}

async function renderOverflowing(axes: { x: boolean | number; y: boolean }) {
  const screen = await render(<Overflowing {...axes} />);
  const root = screen.getByTestId("gutter-root");
  const viewport = root.getBySlot("scroll-area-viewport");
  const bar = (orientation: Orientation) => scrollbar(root, orientation);
  return { root, viewport, bar };
}

/**
 * 溢れている状態から縮める。base-ui は測定前の初期状態を「どちらの軸も溢れていない」と置く
 * (`ScrollAreaRoot` の `DEFAULT_HIDDEN_STATE`) ため、最初から溢れない器で余白ゼロを見ても
 * 測定が走る前に通ってしまう。バーが出るところまで進めてから縮めることで、測定を経た結果を見る。
 */
function Shrinkable() {
  const [overflowing, setOverflowing] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOverflowing(false)}>
        縮める
      </button>
      <ScrollArea className="size-24" data-testid="shrinkable-root">
        <div style={{ minWidth: overflowing ? 400 : 20, minHeight: overflowing ? 400 : 20 }} />
      </ScrollArea>
    </div>
  );
}

describe("ScrollArea のスクロールバー分の余白", () => {
  it("溢れが解消したとき余白も引っ込む", async () => {
    const screen = await render(<Shrinkable />);
    const root = screen.getByTestId("shrinkable-root");
    const bar = (orientation: Orientation) => scrollbar(root, orientation);

    // 先に両軸のバーと余白を出す。ここを通ることで測定済みの状態から縮められる
    await expect.element(bar("vertical")).toBeInTheDocument();
    await expect.element(bar("horizontal")).toBeInTheDocument();
    await expect.element(root).toHaveStyle("padding-right: 10px; padding-bottom: 10px");

    await screen.getByRole("button", { name: "縮める" }).click();

    await expectRemoved(bar("vertical"));
    await expectRemoved(bar("horizontal"));
    await expect.element(root).toHaveStyle("padding-right: 0px; padding-bottom: 0px");
  });

  it("縦に溢れたとき Viewport が縦バーと重ならず、空帯も残さない", async () => {
    const { root, viewport, bar } = await renderOverflowing({ x: false, y: true });
    const vertical = bar("vertical");
    await expect.element(vertical).toBeInTheDocument();

    // 隙間は差の絶対値を整数 px に丸めて 0 と比べる (0.5px 未満のずれは符号を問わず許す。
    // `Math.round(-0.3)` は `-0` で、`toEqual` は `Object.is` で比べるので絶対値を取る)。2 つは 1 回の観測から取る (ADR-0045)
    await expect
      .poll(() => {
        const vp = rect(viewport);
        const vbar = rect(vertical);
        return {
          viewportRightToVerticalBar: Math.round(Math.abs(vp.right - vbar.left)),
          // Corner が無い軸ではバーが Viewport の全高を占める (`h-full` を外した後も縮まない)
          verticalBarHeightToViewport: Math.round(Math.abs(vbar.height - vp.height)),
        };
      })
      .toEqual({ viewportRightToVerticalBar: 0, verticalBarHeightToViewport: 0 });
    // 横は溢れていないので下端は空けない (空帯が残らない)
    await expect.element(root).toHaveStyle("padding-bottom: 0px");
  });

  it("横に溢れたとき Viewport が横バーと重ならず、空帯も残さない", async () => {
    const { root, viewport, bar } = await renderOverflowing({ x: true, y: false });
    const horizontal = bar("horizontal");
    await expect.element(horizontal).toBeInTheDocument();

    await expect.poll(() => Math.round(rect(viewport).bottom - rect(horizontal).top)).toBe(0);
    await expect.element(root).toHaveStyle("padding-right: 0px");
  });

  // registry の `data-vertical:h-full` を残すと縦バーの top / height / bottom が全て非 auto に
  // なり、base-ui がバーに当てる `bottom: var(--scroll-area-corner-height)` が over-constrained
  // で捨てられる。Root に余白を持たせるまでは Viewport の border box が Root と同じだったため
  // 露見しなかったが、余白が付くと縦バーだけが Corner の帯まで伸びて Viewport の下端を越える
  // 縦の余白が横の溢れ判定を動かす経路は本 registry 乖離が新設したもの。base-ui の判定は
  // `clientWidth >= scrollWidth` (`ScrollAreaViewport` の `getHiddenState`) なので、縦に溢れて
  // `pr-2.5` が付いた Viewport では 96 - 10 = 86px が閾値になる。cap-1 / cap / cap+1 で踏む
  it.each([85, 86])("縦に溢れた器で内容幅が %ipx なら横バーは出ない", async (width) => {
    const { root, bar } = await renderOverflowing({ x: width, y: true });

    // 縦バーの mount を待つことで、測定を経た状態から横バーの有無を見る (肯定 anchor)
    await expect.element(bar("vertical")).toBeInTheDocument();
    await expect.element(root).toHaveStyle("padding-right: 10px");
    await expectAbsent(bar("horizontal"));
  });

  it("縦に溢れた器で内容幅が 87px なら横バーが出る", async () => {
    const { root, bar } = await renderOverflowing({ x: 87, y: true });

    await expect.element(bar("vertical")).toBeInTheDocument();
    await expect.element(root).toHaveStyle("padding-right: 10px");
    await expect.element(bar("horizontal")).toBeInTheDocument();
  });

  it("両軸が溢れたとき縦バーが Corner のぶん短くなり、Viewport の端を越えない", async () => {
    const { root, viewport, bar } = await renderOverflowing({ x: true, y: true });
    const vertical = bar("vertical");
    const horizontal = bar("horizontal");
    await expect.element(vertical).toBeInTheDocument();
    await expect.element(horizontal).toBeInTheDocument();

    // 3 つの隙間は 1 回の観測から取る。分けると別々の瞬間で成立してよいことになる (ADR-0045)
    await expect
      .poll(() => {
        const vbar = rect(vertical);
        const hbar = rect(horizontal);
        const vp = rect(viewport);
        return {
          viewportRightToVerticalBar: Math.round(Math.abs(vp.right - vbar.left)),
          viewportBottomToHorizontalBar: Math.round(Math.abs(vp.bottom - hbar.top)),
          verticalBarBottomToViewport: Math.round(Math.abs(vbar.bottom - vp.bottom)),
        };
      })
      .toEqual({
        viewportRightToVerticalBar: 0,
        viewportBottomToHorizontalBar: 0,
        verticalBarBottomToViewport: 0,
      });
    await expect.element(root).toHaveStyle("padding-right: 10px; padding-bottom: 10px");
  });
});
