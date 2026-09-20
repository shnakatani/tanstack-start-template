import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

const meta = {
  component: InputGroup,
} satisfies Meta<typeof InputGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 先頭にアイコンを添えた検索欄 */
export const WithIcon: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput aria-label="メモを検索" placeholder="メモを検索" />
    </InputGroup>
  ),
};

/** 末尾に操作を置いた形。`InputGroupButton` は既定で `ghost` の小さいボタン */
export const WithButton: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput
        aria-label="共有リンク"
        defaultValue="https://example.com/notes/1"
        readOnly
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>コピー</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/** 単位や接頭辞を添える形 */
export const WithText: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>¥</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput aria-label="金額" placeholder="0" />
    </InputGroup>
  ),
};

/**
 * `align` の `block-start`。枠を縦に伸ばし、addon を入力欄の上の行として置く。
 * 他の align は WithIcon / WithButton / WithTextarea が持つ
 */
export const AlignBlockStart: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon align="block-start">
        <InputGroupText>差出人</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput aria-label="差出人" placeholder="name@example.com" />
    </InputGroup>
  ),
};

/** textarea を包む形。枠の高さが内容に追従する */
export const WithTextarea: Story = {
  render: () => (
    <InputGroup>
      <InputGroupTextarea aria-label="メモの本文" placeholder="本文を入力" />
      <InputGroupAddon align="block-end">
        <InputGroupButton>送信</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
