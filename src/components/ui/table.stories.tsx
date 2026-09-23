import type { Meta, StoryObj } from "@storybook/tanstack-react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROWS = [
  { title: "買い物リスト", updatedAt: "2026-09-18", count: 3 },
  { title: "読みたい本", updatedAt: "2026-09-15", count: 7 },
  { title: "旅行の持ち物", updatedAt: "2026-09-02", count: 12 },
];

const meta = {
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 素の表。列見出しには `scope="col"` を付ける。暗黙の role は locator と一部の支援技術で
 * columnheader に解決されない (ADR-0024)。
 * アプリの一覧は `DataTable` (parts) を通すので、ここは registry の意匠の見本
 */
export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">タイトル</TableHead>
          <TableHead scope="col">更新日</TableHead>
          <TableHead scope="col">項目数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.title}>
            <TableCell>{row.title}</TableCell>
            <TableCell>{row.updatedAt}</TableCell>
            <TableCell>{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** 表題と合計行を添えた形 */
export const WithCaptionAndFooter: Story = {
  render: () => (
    <Table>
      <TableCaption>登録済みのメモ</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">タイトル</TableHead>
          <TableHead scope="col">項目数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.title}>
            <TableCell>{row.title}</TableCell>
            <TableCell>{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>合計</TableCell>
          <TableCell>{ROWS.reduce((sum, row) => sum + row.count, 0)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
