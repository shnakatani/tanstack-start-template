import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, screen, userEvent } from "storybook/test";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

const FRUITS = ["りんご", "みかん", "ぶどう", "もも"];

/**
 * `ComboboxTrigger` が付ける `role="combobox"` は name from author なので、可視テキストが
 * あっても `aria-label` が要る (`implementation.md`「可視テキストを持つ要素に aria-label を
 * 足さない」の例外)。外すと `getByRole` の名前解決が 0 件になる
 */
function ComboboxExample({ items = FRUITS }: { items?: string[] }) {
  return (
    <Combobox items={items}>
      <ComboboxTrigger
        render={
          <button type="button" aria-label="果物">
            <ComboboxValue placeholder="果物を選択" />
          </button>
        }
      />
      {/* popup 内に入力欄を置く構成では base-ui が popup へ role="dialog" を付けるため
          (`combobox/popup/ComboboxPopup.js` の `inputInsidePopup ? 'dialog' : 'presentation'`)、
          名前が要る。与えないと axe の aria-dialog-name で落ちる (`base-ui.md`) */}
      <ComboboxContent aria-label="果物の候補">
        <ComboboxInput aria-label="果物を検索" placeholder="検索" showTrigger={false} />
        <ComboboxEmpty>該当なし</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** 開くところまで。絞り込みと選択は書かない (ADR-0022) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("combobox", { name: "果物" }));
  await screen.findByRole("listbox");
}

const meta = {
  component: Combobox,
  render: () => <ComboboxExample />,
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  },
};

/** 開いた状態。検索欄と候補が portal へ出る */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("option", { name: "りんご" })).toBeInTheDocument();
  },
};

/** 候補が 1 件も無いとき。`ComboboxEmpty` が代わりの文言を出す */
export const NoItems: Story = {
  render: () => <ComboboxExample items={[]} />,
  play: async () => {
    await userEvent.click(screen.getByRole("combobox", { name: "果物" }));
    await expect(await screen.findByText("該当なし")).toBeInTheDocument();
  },
};
