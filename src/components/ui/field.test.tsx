import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

/**
 * registry 乖離のガード。`FieldLabel` の `weight` は、shadcn の例がまとまりの中の行に付ける
 * `className="font-normal"` を variant で表す (docs/registry-deviations.md、ADR-0020)。
 * 太さは `Label` の `font-medium` と `cn` で合わさって決まるので、計算後の値で見る。
 * 既定の側も見る。`normal` だけを見ると、既定まで通常の太さに倒れた壊れ方を見逃す。
 */
describe("FieldLabel の太さ", () => {
  it("weight を省くと registry の既定の太さで描く", async () => {
    const screen = await render(
      <Field orientation="horizontal">
        <Checkbox id="field-weight-default" />
        <FieldLabel htmlFor="field-weight-default">ハードディスク</FieldLabel>
      </Field>,
    );

    await expect.element(screen.getByText("ハードディスク")).toHaveStyle("font-weight: 500");
  });

  it('weight="normal" はまとまりの中の行のラベルを通常の太さで描く', async () => {
    const screen = await render(
      <Field orientation="horizontal">
        <Checkbox id="field-weight-normal" />
        <FieldLabel htmlFor="field-weight-normal" weight="normal">
          外部ディスク
        </FieldLabel>
      </Field>,
    );

    await expect.element(screen.getByText("外部ディスク")).toHaveStyle("font-weight: 400");
  });
});
