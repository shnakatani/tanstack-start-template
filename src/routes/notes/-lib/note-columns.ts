import { createColumnHelper } from "@tanstack/react-table";

import { columnBaseFrom } from "@/components/parts/data-table-columns";
import type { DataTableFeatures } from "@/components/parts/data-table-features";

import {
  NoteActionsCell,
  NoteBodyCell,
  NoteCreatedAtCell,
  NoteDueDateCell,
  NoteUpdatedAtCell,
} from "../-components/note-cells";
import type { NoteRow } from "./note-rows";
import { noteInputOf } from "./note-rows";
import { NOTE_COLUMN_HEADERS } from "./notes-page-constants";

const helper = createColumnHelper<DataTableFeatures, NoteRow>();

/** 列の id と見出し。id の typo は型が止め、見出しは `NOTE_COLUMN_HEADERS` から引く */
const base = columnBaseFrom(NOTE_COLUMN_HEADERS);

/**
 * メモ一覧の列定義 (ADR-0018)。列の順・id・見出しは pending 表示と共有する `NOTE_COLUMN_HEADERS` が持ち、
 * ここと過不足なく並ぶことは `index.test.tsx` の pending のテストが見る。
 * 描画を持つ列は `cell` にコンポーネントの参照を渡す (`FlexRender` が cell の context を
 * props にして描く。TanStack Table「Flex Render」)。JSX はこのファイルに書かない
 */
export const noteColumns = helper.columns([
  helper.accessor((row) => noteInputOf(row).title, base("title")),
  helper.accessor((row) => noteInputOf(row).body, { ...base("body"), cell: NoteBodyCell }),
  helper.accessor((row) => noteInputOf(row).dueDate, { ...base("dueDate"), cell: NoteDueDateCell }),
  helper.display({ ...base("createdAt"), cell: NoteCreatedAtCell }),
  helper.display({ ...base("updatedAt"), cell: NoteUpdatedAtCell }),
  helper.display({ ...base("actions"), cell: NoteActionsCell }),
]);
