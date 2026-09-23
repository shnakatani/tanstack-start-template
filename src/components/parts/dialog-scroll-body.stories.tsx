import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, screen, waitFor } from "storybook/test";

import { ActionFormSubmit } from "@/components/action/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { DialogScrollBody, DialogScrollForm } from "./dialog-scroll-body";

/**
 * 内部スクロール方式のダイアログのカタログ。溢れている状態と溢れていない状態を並べる。
 *
 * 寸法と色の回帰 (区切り線の対称性、focus ring がクリップされないこと、本文と縦バーの
 * 重なり、`dialogScrollLayout` の flex 指定) は `dialog-scroll-body.test.tsx` が
 * `getComputedStyle` / `getBoundingClientRect` で持ち続ける (ADR-0050)。
 * ここの play は「その story が名乗る状態になっているか」だけを `data-has-overflow-y` で確かめる。
 *
 * 溢れはフィールドの実数で作る。`height` 指定では flex item が潰れて溢れを再現できない。
 */

interface StoryArgs {
  /** 本体に並べるフィールド数。溢れる / 溢れないをこれで切り替える */
  fieldCount: number;
  submitAction: () => Promise<void> | void;
}

function ScrollDialog({ fieldCount, submitAction }: StoryArgs) {
  return (
    // defaultOpen で開いた状態を見せるので trigger は置かない。置いてもダイアログの裏に
    // 隠れて読者からは見えない
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>フォーム</DialogTitle>
        </DialogHeader>
        <DialogScrollForm submitAction={submitAction}>
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
        </DialogScrollForm>
      </DialogContent>
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
  render: (args) => <ScrollDialog {...args} />,
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
