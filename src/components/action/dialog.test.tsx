import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogScrollBody,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { restoreDefaultViewport, setViewport, SHORT_VIEWPORT } from "@/test/viewport";

import { ActionDialogContent } from "./dialog";
import { ActionFormSubmit } from "./form";

/**
 * 状態のカタログは `dialog.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * 溢れる / 溢れないの 2 状態は story の play が base-ui の `data-has-overflow-y` で確かめ、
 * 余白・区切り線・バーとの重なりはその story で見る。
 *
 * ここに残すのは、CDP 経由の実イベントとレイアウトの実測が要る case である
 * (docs/guides/storybook.md「story とブラウザテストの分担」)。
 *
 * - 送信: `DialogContent` は Portal で body 直下へ出る。form が DOM の上で送信ボタンと入力欄の
 *   祖先になっているかは、実際にクリックと Enter を送らないと分からない
 * - form の `display: contents`: 見出し・本文・フッターを Popup の flex の子として並べる前提。
 *   外すと本文とフッターの間の gap が消え、内部スクロールも form の `min-h-0` 頼みになる
 * - focus outline: Viewport の focus ring は Root の `overflow-hidden` にクリップされるため
 *   `scroll-area-focus-outline` (`styles.css`) が Root の outline で代替しており、
 *   `:has(> viewport:focus-visible)` が実際の Tab 移動で効くかは描画して押さないと分からない
 */
const FIELD_COUNT = 8;

function renderFormDialog(submitAction: () => void) {
  return render(
    <Dialog>
      <DialogTrigger render={<Button>開く</Button>} />
      <ActionDialogContent submitAction={submitAction}>
        <DialogHeader>
          <DialogTitle>フォーム</DialogTitle>
        </DialogHeader>
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
          <ActionFormSubmit>保存</ActionFormSubmit>
        </DialogFooter>
      </ActionDialogContent>
    </Dialog>,
  );
}

async function openFormDialog(submitAction: () => void = vi.fn()) {
  const screen = await renderFormDialog(submitAction);
  await screen.getByText("開く").first().click();
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog).toBeInTheDocument();
  return dialog;
}

describe("ActionDialogContent", () => {
  afterEach(restoreDefaultViewport);

  it("送信ボタンを押すと submitAction が 1 回呼ばれる", async () => {
    const submitAction = vi.fn();
    const dialog = await openFormDialog(submitAction);

    await dialog.getByRole("button", { name: "保存", exact: true }).click();

    await expect.poll(() => submitAction.mock.calls.length).toBe(1);
  });

  it("入力欄で Enter を押すと submitAction が呼ばれる", async () => {
    const submitAction = vi.fn();
    const dialog = await openFormDialog(submitAction);

    await dialog.getByRole("textbox", { name: "項目 1", exact: true }).click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => submitAction.mock.calls.length).toBe(1);
  });

  // form の box を消し、見出し・本文・フッターを Popup の flex の子にする。本文の前後の間隔は
  // Popup の gap が持つ
  it("form が box を作らず、本文が Popup の flex の子として並ぶ", async () => {
    const dialog = await openFormDialog();

    // 名前の無い form は accessibility tree に form の役割として出ないので、slot で掴む
    await expect.element(dialog.getBySlot("action-dialog-form")).toHaveStyle("display: contents");
  });

  // outline-none が同居すると --tw-outline-style が none に潰れて描画されない
  // (segmented-radio-group.test.tsx と同じ罠)。値ではなく style の有無で見る
  it("スクロール領域にキーボードフォーカスが当たると本体に枠が描画される", async () => {
    await setViewport(SHORT_VIEWPORT);
    const dialog = await openFormDialog();

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
