import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, screen, waitFor } from "storybook/test";

import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogScrollBody,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { ActionDialogContent } from "./dialog";
import { ActionFormSubmit } from "./form";

/**
 * フォームを持つダイアログのカタログ。溢れている状態と溢れていない状態を並べる。
 *
 * 送信の経路、form の `display: contents`、キーボードでの focus outline は `dialog.test.tsx` が
 * 実イベントと computed style で持つ (docs/guides/storybook.md「story とブラウザテストの分担」)。
 * ここの play は「その story が名乗る状態になっているか」だけを `data-has-overflow-y` で確かめる。
 * 見出しと本文、本文とフッターの間隔、区切り線、本文と縦バーの重なりはこの story で見る。
 *
 * 溢れはフィールドの実数で作る。`height` 指定では flex item が潰れて溢れを再現できない。
 */

interface StoryArgs {
  /** 本体に並べるフィールド数。溢れる / 溢れないをこれで切り替える */
  fieldCount: number;
  submitAction: () => Promise<void> | void;
}

function FormDialog({ fieldCount, submitAction }: StoryArgs) {
  return (
    // defaultOpen で開いた状態を見せるので trigger は置かない。置いてもダイアログの裏に
    // 隠れて読者からは見えない
    <Dialog defaultOpen>
      <ActionDialogContent submitAction={submitAction}>
        <DialogHeader>
          <DialogTitle>フォーム</DialogTitle>
        </DialogHeader>
        <DialogScrollBody>
          <FieldGroup>
            {Array.from({ length: fieldCount }, (_, index) => (
              <Field key={index}>
                <FieldLabel htmlFor={`field-${index}`}>項目 {index + 1}</FieldLabel>
                <Input id={`field-${index}`} />
              </Field>
            ))}
          </FieldGroup>
        </DialogScrollBody>
        <DialogFooter>
          <ActionFormSubmit>保存</ActionFormSubmit>
        </DialogFooter>
      </ActionDialogContent>
    </Dialog>
  );
}

/** base-ui は溢れの有無を Root と Viewport の双方に data-has-overflow-y で出す */
function scrollBody(): HTMLElement {
  const found = screen.getByRole("dialog").querySelector('[data-slot="dialog-scroll-body"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("[story] dialog-scroll-body が見つからない");
  }
  return found;
}

const meta = {
  render: (args) => <FormDialog {...args} />,
  args: { fieldCount: 20, submitAction: fn() },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 溢れている状態。本体だけがスクロールし、固定領域との境界に区切り線が出る */
export const Overflowing: Story = {
  play: async () => {
    await waitFor(() => expect(scrollBody()).toHaveAttribute("data-has-overflow-y"));
  },
};

/** 溢れていない状態。区切り線は透明のまま場所だけ取る (レイアウトシフトを起こさない) */
export const Fits: Story = {
  args: { fieldCount: 1 },
  play: async () => {
    await waitFor(() => expect(scrollBody()).not.toHaveAttribute("data-has-overflow-y"));
  },
};
