import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { ComponentProps } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type FieldOrientation = NonNullable<ComponentProps<typeof Field>["orientation"]>;

/** control の選択肢の出処。`cva` の増減が両方向でここの型エラーになる (`directory-structure.md`「コンポーネント配置」) */
const ORIENTATION_OPTIONS = Object.keys({
  vertical: null,
  horizontal: null,
  responsive: null,
} satisfies Record<FieldOrientation, null>);

const meta = {
  component: Field,
  argTypes: {
    orientation: { control: "inline-radio", options: ORIENTATION_OPTIONS },
  },
  render: (args) => (
    <Field {...args}>
      <FieldLabel htmlFor="field-title">タイトル</FieldLabel>
      <Input id="field-title" placeholder="タイトルを入力" />
      <FieldDescription>一覧に表示される名前です</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。ラベルと入力欄を縦に積む */
export const Vertical: Story = {
  args: { orientation: "vertical" },
};

/**
 * 横並び。`@md/field-group` を持たないので、`FieldGroup` の外でも常に横に並ぶ。
 * チェックボックス 1 件の行をこの向きで組む流儀は `ChoiceCard` の story が持つ
 */
export const Horizontal: Story = {
  args: { orientation: "horizontal" },
};

/** コンテナ幅で縦横が切り替わる。`FieldGroup` の中でだけ横に転ぶ */
export const Responsive: Story = {
  args: { orientation: "responsive" },
  decorators: [
    (Story) => (
      <FieldGroup>
        <Story />
      </FieldGroup>
    ),
  ],
};

/** 検証に落ちた状態。`data-invalid` が文字色を destructive へ倒し、`FieldError` が理由を出す */
export const Invalid: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="field-invalid">タイトル</FieldLabel>
      <Input id="field-invalid" aria-invalid defaultValue="" />
      <FieldError errors={[{ message: "タイトルを入力してください" }]} />
    </Field>
  ),
};

/**
 * 補足付きの説明を `FieldContent` にまとめた形。見出しは `FieldLabel` にして control と結ぶ。
 * `FieldTitle` は label ではないので、見出しを押しても切り替わらず、control 側が可視テキストと
 * 同じ文字列を `aria-label` で二重に持つことになる
 */
export const WithContent: Story = {
  render: () => (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="field-notify">通知を受け取る</FieldLabel>
        <FieldDescription>更新があったときにメールで知らせます</FieldDescription>
      </FieldContent>
      <Checkbox id="field-notify" />
    </Field>
  ),
};

/** 複数のフィールドを束ねる外枠。`FieldSet` + `FieldLegend` がグループに名前を与える */
export const Grouped: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>メモの設定</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="field-grouped-title">タイトル</FieldLabel>
          <Input id="field-grouped-title" placeholder="タイトルを入力" />
        </Field>
        <Field>
          <FieldLabel htmlFor="field-grouped-tag">タグ</FieldLabel>
          <Input id="field-grouped-tag" placeholder="タグを入力" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
