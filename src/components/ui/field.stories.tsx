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
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type FieldOrientation = NonNullable<ComponentProps<typeof Field>["orientation"]>;

/** control の選択肢の出処。`fieldVariants` に足した側がここで型エラーになる (ADR-0022) */
const ORIENTATION_MEMBERS = {
  vertical: null,
  horizontal: null,
  responsive: null,
} satisfies Record<FieldOrientation, null>;

const meta = {
  component: Field,
  argTypes: {
    orientation: { control: "inline-radio", options: Object.keys(ORIENTATION_MEMBERS) },
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
  render: (args) => (
    <FieldGroup>
      <Field {...args}>
        <FieldLabel htmlFor="field-responsive">タイトル</FieldLabel>
        <Input id="field-responsive" placeholder="タイトルを入力" />
      </Field>
    </FieldGroup>
  ),
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

/** 補足付きの説明を `FieldContent` にまとめた形 */
export const WithContent: Story = {
  render: () => (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle>通知を受け取る</FieldTitle>
        <FieldDescription>更新があったときにメールで知らせます</FieldDescription>
      </FieldContent>
      <Checkbox id="field-notify" aria-label="通知を受け取る" />
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
