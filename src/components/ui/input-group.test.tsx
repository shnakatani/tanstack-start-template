import { describe, expect, it } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { maxShadowSpread } from "@/test/box-shadow";

/**
 * input-group.tsx の registry 乖離 (popup 内リング抑制 patch、ADR-0006) のガード。
 * shadcn add --overwrite で patch が消えると本テストが fail する。
 *
 * リングは常設の shadow-xs に重なる box-shadow の層の spread で描かれ、これを表す matcher は
 * 無い。抑制は `:has()` の詳細度と `not-in-` の組み合わせで効くため描画して測る
 * (ADR-0029 の escape hatch)。transition-[box-shadow] の途中値は expect.poll の retry が
 * 吸収する。
 */

/** リングの spread。3px (ring-3) と 0 の間に中間値は無い */
function ringSpread(group: Locator): number {
  return maxShadowSpread(getComputedStyle(group.element()).boxShadow);
}

describe("InputGroup の popup 内リング抑制 (ADR-0006)", () => {
  it("combobox popup 内の検索入力はフォーカスしてもリングが付かず border も変わらない", async () => {
    const screen = await render(
      <Combobox items={["りんご", "みかん"]}>
        {/* テキストは DOM に出るが、ComboboxTrigger が付ける role="combobox" は内容から
            accessible name を取らない (ARIA の name from author)。aria-label を外すと
            getByRole の name 解決が 0 件になるため必須 (2026-08-09 に Chromium で実測) */}
        <ComboboxTrigger
          render={
            <button type="button" aria-label="開く">
              開く
            </button>
          }
        />
        <ComboboxContent aria-label="果物の候補">
          <ComboboxInput aria-label="検索" placeholder="検索" showTrigger={false} />
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );

    await screen.getByRole("combobox", { name: "開く" }).click();

    // 入力が popup の中にあるので popup は role="dialog" になる (base-ui.md)
    const popup = screen.getByRole("dialog", { name: "果物の候補" });
    const input = popup.getByRole("combobox", { name: "検索" });
    const group = popup.getBySlot("input-group");
    await expect.element(group).toBeInTheDocument();
    const borderBefore = getComputedStyle(group.element()).borderColor;

    await input.click();
    await expect.element(input).toHaveFocus();

    // リングは box-shadow の spread で描画される。0 ならリング無し = 下の行への食い込みは構造的に起きない
    await expect.poll(() => ringSpread(group)).toBe(0);
    // フォーカスで border 色を変えない (popup 様式の border-input/30 のまま)
    await expect.poll(() => getComputedStyle(group.element()).borderColor).toBe(borderBefore);
  });

  it("popup 外の InputGroup はフォーカスで 3px のリングが付く (抑制の効かせすぎガード)", async () => {
    const screen = await render(
      <InputGroup>
        <InputGroupInput aria-label="単独入力" />
      </InputGroup>,
    );

    const input = screen.getByRole("textbox", { name: "単独入力" });
    await input.click();
    await expect.element(input).toHaveFocus();

    await expect.poll(() => ringSpread(screen.getBySlot("input-group"))).toBe(3);
  });

  it("combobox popup 内の aria-invalid 入力は 3px のリングが付く", async () => {
    const screen = await render(
      <Combobox items={["りんご", "みかん"]}>
        <ComboboxTrigger
          render={
            <button type="button" aria-label="エラー入力を開く">
              エラー入力を開く
            </button>
          }
        />
        <ComboboxContent aria-label="果物の候補">
          <ComboboxInput
            aria-invalid
            aria-label="エラー検索"
            placeholder="エラー検索"
            showTrigger={false}
          />
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );

    await screen.getByRole("combobox", { name: "エラー入力を開く" }).click();

    const popup = screen.getByRole("dialog", { name: "果物の候補" });
    const input = popup.getByRole("combobox", { name: "エラー検索" });
    await input.click();
    await expect.element(input).toHaveFocus();

    await expect.poll(() => ringSpread(popup.getBySlot("input-group"))).toBe(3);
  });
});
