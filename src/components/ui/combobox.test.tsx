import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxValue,
} from "./combobox";

/**
 * 状態のカタログは `combobox.stories.tsx` が持つ。ここに残すのは、registry から動かした
 * chip の削除ボタンの名前だけ (docs/registry-deviations.md の combobox.tsx の行)
 */
describe("ComboboxChip", () => {
  // 削除ボタンはアイコンだけの button で、base-ui の ChipRemove は既定の名前を持たない
  it("削除ボタンが removeLabel を名前に持つ", async () => {
    const screen = await render(
      <Combobox items={["りんご", "みかん"]} multiple defaultValue={["りんご"]}>
        <ComboboxChips>
          <ComboboxValue>
            {(values: string[]) =>
              values.map((value) => (
                <ComboboxChip key={value} removeLabel={`${value}を外す`}>
                  {value}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput aria-label="果物" />
        </ComboboxChips>
      </Combobox>,
    );

    await expect.element(screen.getByRole("button", { name: "りんごを外す" })).toBeInTheDocument();
  });
});
