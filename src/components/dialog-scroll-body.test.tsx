import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DialogScrollBody, dialogScrollLayout } from "@/components/dialog-scroll-body";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  restoreDefaultViewport,
  setViewport,
  SHORT_VIEWPORT,
  TABLET_VIEWPORT,
  type Viewport,
} from "@/test/viewport";
import { waitForAnimations } from "@/test/wait-for-animations";

/**
 * 内部スクロール方式のダイアログ本体 (DialogScrollBody) の回帰テスト。
 *
 * 溢れコンテンツはフィールドの実数で作る (`height` 指定では flex item が潰れて溢れを
 * 再現できない — dialog.test.tsx の同趣旨のコメント参照)。
 */

const FIELD_COUNT = 8;

function renderFormDialog(fieldCount: number = FIELD_COUNT) {
  return render(
    <Dialog>
      <DialogTrigger render={<Button>開く</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>フォーム</DialogTitle>
        </DialogHeader>
        <form className={dialogScrollLayout}>
          <DialogScrollBody>
            <FieldGroup>
              {Array.from({ length: fieldCount }, (_, i) => (
                <Field key={i}>
                  <FieldLabel htmlFor={`field-${i}`}>項目 {i + 1}</FieldLabel>
                  <Input id={`field-${i}`} />
                </Field>
              ))}
            </FieldGroup>
          </DialogScrollBody>
          <DialogFooter>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>,
  );
}

async function openAt(viewport: Viewport, fieldCount?: number) {
  await setViewport(viewport);
  const screen = await renderFormDialog(fieldCount);
  await screen.getByText("開く").first().click();
  await waitForAnimations();

  const popup = screen.getByRole("dialog").element();
  const query = (slot: string) => {
    const found = popup.querySelector(`[data-slot="${slot}"]`);
    if (!found) throw new Error(`data-slot="${slot}" が見つからない`);
    return found;
  };
  return {
    screen,
    popup,
    body: query("dialog-scroll-body"),
    viewport: query("scroll-area-viewport"),
    footer: query("dialog-footer"),
    title: query("dialog-title"),
  };
}

describe("DialogScrollBody（内部スクロール）", () => {
  afterEach(restoreDefaultViewport);

  it("内容が溢れるとき本体だけがスクロールし、見出しとフッターは動かない", async () => {
    const { popup, viewport, footer, title } = await openAt(SHORT_VIEWPORT);

    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    // 本体が内部スクロールを担うため、popup 自身は backstop でスクロールしない
    expect(popup.scrollHeight).toBe(popup.clientHeight);

    const titleTop = title.getBoundingClientRect().top;
    const footerBottom = footer.getBoundingClientRect().bottom;

    viewport.scrollTop = viewport.scrollHeight;
    expect(viewport.scrollTop).toBeGreaterThan(0);

    expect(title.getBoundingClientRect().top).toBe(titleTop);
    expect(footer.getBoundingClientRect().bottom).toBe(footerBottom);
  });

  // -mx-6 と px-6 は DialogContent の p-6 を打ち消して Viewport の内側へ移すペア。
  // DialogContent の padding を変えるとこの前提が崩れ、focus ring がクリップされる
  it("本体の内容が見出しと同じ左端に揃い、本体自身は popup の端まで広がる", async () => {
    const { popup, body, title } = await openAt(TABLET_VIEWPORT);
    const label = body.querySelector('[data-slot="field-label"]');
    if (!label) throw new Error("FieldLabel が見つからない");

    expect(label.getBoundingClientRect().left).toBeCloseTo(title.getBoundingClientRect().left, 0);
    // 区切り線を popup の端まで届かせるため、本体自身は padding の外へ広がる
    expect(body.getBoundingClientRect().left).toBeCloseTo(popup.getBoundingClientRect().left, 0);
    expect(body.getBoundingClientRect().right).toBeCloseTo(popup.getBoundingClientRect().right, 0);
  });

  it("入力の focus ring がスクロール境界でクリップされない", async () => {
    const { viewport } = await openAt(SHORT_VIEWPORT);
    const input = viewport.querySelector("input");
    if (!input) throw new Error("input が見つからない");

    // input.tsx の focus-visible:ring-3 は box-shadow 3px として要素の外側に描画される
    const ringWidth = 3;
    const inputRect = input.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();

    expect(inputRect.left - ringWidth).toBeGreaterThanOrEqual(viewportRect.left);
    expect(inputRect.right + ringWidth).toBeLessThanOrEqual(viewportRect.right);
  });

  // 縦も横と同じ理由でクリップされる。ring / box-shadow を持つ要素 (input の focus ring、
  // card.tsx の ring-1) が先頭・末尾に来たとき、Viewport に縦 padding がないと境界で切れる
  it("先頭と末尾の要素の ring がスクロール境界の上下でクリップされない", async () => {
    const { viewport } = await openAt(TABLET_VIEWPORT, 1);
    const input = viewport.querySelector("input");
    const label = viewport.querySelector('[data-slot="field-label"]');
    if (!input || !label) throw new Error("input / FieldLabel が見つからない");

    const ringWidth = 3;
    const viewportRect = viewport.getBoundingClientRect();

    // 溢れていない状態では scrollTop が動かないため、先頭要素の上端と末尾要素の下端を直接見る
    expect(label.getBoundingClientRect().top - ringWidth).toBeGreaterThanOrEqual(viewportRect.top);
    expect(input.getBoundingClientRect().bottom + ringWidth).toBeLessThanOrEqual(
      viewportRect.bottom,
    );
  });

  it("区切り線の上下の余白が対称になる", async () => {
    const { body, footer, title } = await openAt(SHORT_VIEWPORT);

    const above = body.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
    const below = footer.getBoundingClientRect().top - body.getBoundingClientRect().bottom;

    expect(above).toBeCloseTo(below, 0);
  });

  it("溢れているときだけ固定領域との境界に区切り線が出る", async () => {
    const overflowing = await openAt(SHORT_VIEWPORT);
    const shown = getComputedStyle(overflowing.body);

    // 幅はどちらの状態でも 1px を保ち、色だけが変わる (レイアウトシフトを起こさない)
    expect(shown.borderTopWidth).toBe("1px");
    expect(shown.borderBottomWidth).toBe("1px");
    expect(shown.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");

    await overflowing.screen.unmount();

    const fits = await openAt(TABLET_VIEWPORT, 1);
    const hidden = getComputedStyle(fits.body);

    expect(fits.viewport.scrollHeight).toBe(fits.viewport.clientHeight);
    expect(hidden.borderTopWidth).toBe("1px");
    expect(hidden.borderTopColor).toBe("rgba(0, 0, 0, 0)");
  });

  // 公式 CSS の .BodyViewport が持つ指定。スクロール端でホイールが祖先へチェーンしない
  it("スクロール端で祖先へスクロールが伝播しない", async () => {
    const { viewport } = await openAt(SHORT_VIEWPORT);

    expect(getComputedStyle(viewport).overscrollBehavior).toBe("contain");
  });

  // Viewport は溢れている間だけ tabIndex 0 になる (base-ui)。その focus ring は Root の
  // overflow-hidden にクリップされるため、指標を Root の outline へ移している。
  // outline-none が同居すると --tw-outline-style が none に潰れて描画がゼロになるため
  // (segmented-radio-group.test.tsx と同じ罠)、outline-width ではなく実効 style で固定する
  it("スクロール領域にキーボードフォーカスが当たると本体に枠が描画される", async () => {
    const { body, viewport } = await openAt(SHORT_VIEWPORT);
    expect(viewport.getAttribute("tabindex")).toBe("0");
    expect(getComputedStyle(body).outlineStyle).toBe("none");

    // 先頭フィールドから Shift+Tab で戻ると Viewport に乗る
    const firstInput = viewport.querySelector("input");
    if (!(firstInput instanceof HTMLElement)) throw new Error("input が見つからない");
    firstInput.focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

    expect(document.activeElement).toBe(viewport);

    const focused = getComputedStyle(body);
    expect(focused.outlineStyle).toBe("solid");
    expect(focused.outlineWidth).toBe("2px");
    // Root の overflow-hidden にクリップされないよう内側へ描く
    expect(focused.outlineOffset).toBe("-2px");
  });
});
