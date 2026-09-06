import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * registry は `{children}` を `ScrollArea.Viewport` へ直接置き、base-ui の
 * `ScrollArea.Content` を使っていない (shadcn-ui/ui#10534)。Content は ResizeObserver で
 * 内容の寸法変化を拾い thumb と overflow 判定を再計算するパートで、上流 base-ui は
 * 「期待される構造は Root > Viewport > Content」と回答している (mui/base-ui#4696、CLOSED)。
 *
 * viewport の高さが内容に追随する `max-h-*` では viewport 自身の resize が再計算を誘発する
 * ため差が出ない。高さが固定される使い方 (`h-*` や flex で伸びた領域) で顕在化する。
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
    // 溢れが解消するとスクロールバーごと unmount されるため、都度引き直す
    const wrap = screen.getByTestId("scroll-area-harness").element();
    const hasOverflow = () =>
      wrap
        .querySelector('[data-slot="scroll-area-viewport"]')
        ?.hasAttribute("data-has-overflow-y") ?? null;

    expect(hasOverflow()).toBe(true);

    await screen.getByRole("button", { name: "減らす" }).click();

    // ユーザーがスクロールしなくても再計算される (Content の ResizeObserver 経由)
    await expect.poll(hasOverflow, { timeout: 2000 }).toBe(false);
  });
});

/**
 * 余白が `ScrollBar` の太さと一致することを、Viewport の端とバーの端の一致で固定する。
 * 一致で見るのは、足りなければバーが内容に被り、余ればバーの無い空帯が残るため。
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

async function renderOverflowing(axes: { x: boolean | number; y: boolean }) {
  const screen = await render(<Overflowing {...axes} />);
  const root = screen.getByTestId("gutter-root").element();
  const viewport = root.querySelector('[data-slot="scroll-area-viewport"]');
  if (viewport === null) throw new Error("scroll-area-viewport が見つかりません");
  // 溢れていない軸のバーは DOM に出ない (base-ui は keepMounted=false)
  const findBar = (orientation: "horizontal" | "vertical") =>
    root.querySelector(`[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`);
  async function expectBarMounted(orientation: "horizontal" | "vertical") {
    await expect.poll(() => findBar(orientation)).not.toBeNull();
    const bar = findBar(orientation);
    if (bar === null) throw new Error(`${orientation} のスクロールバーが見つかりません`);
    return bar;
  }
  return { root, viewport, expectBarMounted };
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
    const root = screen.getByTestId("shrinkable-root").element();
    const findBar = (orientation: "horizontal" | "vertical") =>
      root.querySelector(`[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`);

    // 先に両軸のバーと余白を出す。ここを通ることで測定済みの状態から縮められる
    await expect.poll(() => findBar("vertical")).not.toBeNull();
    expect(findBar("horizontal")).not.toBeNull();
    expect(getComputedStyle(root).paddingRight).toBe("10px");
    expect(getComputedStyle(root).paddingBottom).toBe("10px");

    await screen.getByRole("button", { name: "縮める" }).click();

    await expect.poll(() => findBar("vertical")).toBeNull();
    expect(findBar("horizontal")).toBeNull();
    const style = getComputedStyle(root);
    expect(style.paddingRight).toBe("0px");
    expect(style.paddingBottom).toBe("0px");
  });

  it("縦に溢れたとき Viewport が縦バーと重ならず、空帯も残さない", async () => {
    const { root, viewport, expectBarMounted } = await renderOverflowing({ x: false, y: true });

    const bar = await expectBarMounted("vertical");
    expect(viewport.getBoundingClientRect().right).toBeCloseTo(bar.getBoundingClientRect().left, 0);
    // Corner が無い軸ではバーが Viewport の全高を占める (`h-full` を外した後も縮まない)
    expect(bar.getBoundingClientRect().height).toBeCloseTo(
      viewport.getBoundingClientRect().height,
      0,
    );
    // 横は溢れていないので下端は空けない (空帯が残らない)
    expect(getComputedStyle(root).paddingBottom).toBe("0px");
  });

  it("横に溢れたとき Viewport が横バーと重ならず、空帯も残さない", async () => {
    const { root, viewport, expectBarMounted } = await renderOverflowing({ x: true, y: false });

    const bar = await expectBarMounted("horizontal");
    expect(viewport.getBoundingClientRect().bottom).toBeCloseTo(bar.getBoundingClientRect().top, 0);
    expect(getComputedStyle(root).paddingRight).toBe("0px");
  });

  // registry の `data-vertical:h-full` を残すと縦バーの top / height / bottom が全て非 auto に
  // なり、base-ui がバーに当てる `bottom: var(--scroll-area-corner-height)` が over-constrained
  // で捨てられる。Root に余白を持たせるまでは Viewport の border box が Root と同じだったため
  // 露見しなかったが、余白が付くと縦バーだけが Corner の帯まで伸びて Viewport の下端を越える
  // 縦の余白が横の溢れ判定を動かす経路は本 registry 乖離が新設したもの。base-ui の判定は
  // `clientWidth >= scrollWidth` (`ScrollAreaViewport` の `getHiddenState`) なので、縦に溢れて
  // `pr-2.5` が付いた Viewport では 96 - 10 = 86px が閾値になる。cap-1 / cap / cap+1 で踏む
  it.each([
    [85, false],
    [86, false],
    [87, true],
  ])("縦に溢れた器で内容幅が %ipx のとき横バーの有無が %s になる", async (width, expected) => {
    const { root, expectBarMounted } = await renderOverflowing({ x: width, y: true });

    // 縦バーの mount を待つことで、測定を経た状態から横バーの有無を見る
    await expectBarMounted("vertical");
    expect(getComputedStyle(root).paddingRight).toBe("10px");

    const horizontal = root.querySelector(
      '[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]',
    );
    expect(horizontal !== null).toBe(expected);
  });

  it("両軸が溢れたとき縦バーが Corner のぶん短くなり、Viewport の端を越えない", async () => {
    const { root, viewport, expectBarMounted } = await renderOverflowing({ x: true, y: true });

    const vbar = (await expectBarMounted("vertical")).getBoundingClientRect();
    const hbar = (await expectBarMounted("horizontal")).getBoundingClientRect();
    const vp = viewport.getBoundingClientRect();

    expect(vp.right).toBeCloseTo(vbar.left, 0);
    expect(vp.bottom).toBeCloseTo(hbar.top, 0);
    expect(vbar.bottom).toBeCloseTo(vp.bottom, 0);
    expect(getComputedStyle(root).paddingRight).toBe("10px");
    expect(getComputedStyle(root).paddingBottom).toBe("10px");
  });
});
