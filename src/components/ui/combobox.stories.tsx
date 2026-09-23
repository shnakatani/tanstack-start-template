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
 * あっても `aria-label` が要る (WAI-ARIA 1.2 §5.2.8)。外すと
 * `getByRole` の名前解決が 0 件になる
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
          名前が要る。与えないと axe の aria-dialog-name で落ちる (ADR-0024) */}
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

/** 開くところまで。絞り込みと選択は書かない (ADR-0039) */
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
  parameters: {
    a11y: {
      context: {
        // 候補がゼロでも base-ui はリストへ role="listbox" を付ける
        // (`combobox/list/ComboboxList.js` の `role: grid ? "grid" : "listbox"`)。axe は中身が
        // 後から増える場合を考えて、空のコンテナを違反ではなく incomplete へ降ろす
        // (`aria-required-children` の `reviewEmpty`)。この story では増えない。
        // 「候補なし」は ComboboxEmpty と base-ui の live region が伝える。
        // 上流へは未起票。2026-09-21 に mui/base-ui を "aria-required-children" で検索し、
        // #5443 (Empty が listbox の直下に居る violation) は別件だった。投げるなら mui/base-ui。
        // 外せるのは base-ui が空のリストで role を落とすようになったとき
        exclude: ['[data-slot="combobox-list"]'],
      },
    },
  },
  play: async () => {
    await userEvent.click(screen.getByRole("combobox", { name: "果物" }));
    // base-ui は live region の末尾へ word joiner (U+2060) を 200ms 入れる
    // (`combobox/utils/useInitialLiveRegionTextMutation.js`)。`findByText` の normalizer は
    // 空白しか畳まないので、厳密一致だとそのタイマーが明けるまで poll し続ける
    await expect(await screen.findByText(/該当なし/)).toBeInTheDocument();
  },
};

/**
 * 入力欄の中で完結する形。`ComboboxInput` の既定 trigger を出す。アイコンだけのボタンで、
 * 名前は registry 側の既定 `aria-label` が持つ (上流 shadcn-ui/ui#11589、ADR-0024 の乖離)
 */
export const InlineWithTrigger: Story = {
  render: () => (
    <Combobox items={FRUITS}>
      <ComboboxInput aria-label="果物" placeholder="果物を選択" />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  parameters: {
    a11y: {
      config: {
        // 非 modal の popup を開くと base-ui が外側へ aria-hidden を付けるが、tab 順からは
        // 外さないため axe が aria-hidden-focus を出す。ここで落ちるのは violations 側で、
        // `a11y-story.ts` の `IGNORED_INCOMPLETE` (incomplete 側) とは守備範囲が違う。
        // この行を外すとこの story だけが violations で落ちる (2026-09-21 に実測)。
        // 上流のバグで mui/base-ui#5528 が open。直るまでこの story でだけ止める。
        // popup を開くのをやめる手は採らない。
        // 開かないと下の aria-prohibited-attr の見張りごと消える。
        //
        // InlineWithClear に同じ抑制が要らないのは、あちらの addon に残る操作子が
        // combobox-clear だけで tabindex="-1" を持ち、tab 順に入らないためである
        // (trigger は clear があると CSS で消える)。2026-09-21 に実測した
        rules: [{ id: "aria-hidden-focus", enabled: false }],
      },
    },
  },
  // popup を開いてから終える。開かないと Portal の中が mount されず、popup へ付いた
  // 禁止属性を axe の aria-prohibited-attr が見られない
  play: async () => {
    await expect(screen.getByRole("button", { name: "候補を開く" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "候補を開く" }));
    await expect(await screen.findByRole("option", { name: "りんご" })).toBeInTheDocument();
  },
};

/**
 * 値を消せる形。`showClear` を出すと trigger は CSS で隠れる
 * (`combobox.tsx` の `group-has-data-[slot=combobox-clear]/input-group:hidden`)
 */
export const InlineWithClear: Story = {
  render: () => (
    <Combobox items={FRUITS} defaultValue="りんご">
      <ComboboxInput aria-label="果物" showClear />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  // 上と同じ理由で popup を開く
  play: async () => {
    await expect(screen.getByRole("button", { name: "選択を消す" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "果物" }));
    await expect(await screen.findByRole("option", { name: "りんご" })).toBeInTheDocument();
  },
};
