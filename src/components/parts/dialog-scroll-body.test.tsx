import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DialogScrollBody, dialogScrollLayout } from "@/components/parts/dialog-scroll-body";
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
import { restoreDefaultViewport, setViewport, SHORT_VIEWPORT } from "@/test/viewport";

/**
 * 状態のカタログは `dialog-scroll-body.stories.tsx` が持つ (ADR-0053)。溢れる / 溢れないの
 * 2 状態は story の play が base-ui の `data-has-overflow-y` で確かめ、本文だけがスクロールする
 * こと (`min-h-0` を外すと play が落ちることを実測済み)、余白・区切り線・バーとの重なりは
 * その story で見る。寸法は測らない (値を焼き付けると上流が寸法を変えただけで落ちる)。
 *
 * ここに残すのは、キーボードの実イベントが要る 1 件だけ。Viewport の focus ring は Root の
 * `overflow-hidden` にクリップされるため `scroll-area-focus-outline` (`styles.css`) が Root の
 * outline で代替しており、`:has(> viewport:focus-visible)` が実際の Tab 移動で効くかは
 * 描画して押さないと分からない。
 */
const FIELD_COUNT = 8;

function renderFormDialog() {
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
              {Array.from({ length: FIELD_COUNT }, (_, i) => (
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

describe("DialogScrollBody（内部スクロール）", () => {
  afterEach(restoreDefaultViewport);

  // outline-none が同居すると --tw-outline-style が none に潰れて描画されない
  // (segmented-radio-group.test.tsx と同じ罠)。値ではなく style の有無で見る
  it("スクロール領域にキーボードフォーカスが当たると本体に枠が描画される", async () => {
    await setViewport(SHORT_VIEWPORT);
    const screen = await renderFormDialog();
    await screen.getByText("開く").first().click();

    const dialog = screen.getByRole("dialog");
    const body = dialog.getBySlot("dialog-scroll-body");
    const viewport = dialog.getBySlot("scroll-area-viewport");

    // Viewport は溢れている間だけ tab 順に入る (base-ui)
    await expect.element(viewport).toHaveAttribute("tabindex", "0");
    await expect.element(body).toHaveStyle("outline-style: none");

    // 先頭フィールドから Shift+Tab で戻ると Viewport に乗る
    await viewport.getByRole("textbox").first().click();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

    await expect.element(viewport).toHaveFocus();
    await expect.element(body).toHaveStyle("outline-style: solid");
  });
});
