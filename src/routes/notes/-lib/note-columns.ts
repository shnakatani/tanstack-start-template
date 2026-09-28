import { createColumnHelper } from "@tanstack/react-table";

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

const [titleHeader, bodyHeader, dueDateHeader, createdAtHeader, updatedAtHeader, actionsHeader] =
  NOTE_COLUMN_HEADERS;

/**
 * メモ一覧の列定義 (ADR-0018)。見出しは pending 表示と共有する `NOTE_COLUMN_HEADERS` から採り、長さを `satisfies` で
 * 突き合わせる。`helper.columns()` は配列をタプルのまま返すので、列を足して定数を直し忘れると型エラーになる。
 * 描画を持つ列は `cell` にコンポーネントの参照を渡す (`FlexRender` が cell の context を
 * props にして描く。TanStack Table「Flex Render」)。JSX はこのファイルに書かない
 */
export const noteColumns = helper.columns([
  helper.accessor((row) => noteInputOf(row).title, {
    id: "title",
    header: titleHeader,
  }),
  helper.accessor((row) => noteInputOf(row).body, {
    id: "body",
    header: bodyHeader,
    cell: NoteBodyCell,
  }),
  helper.accessor((row) => noteInputOf(row).dueDate, {
    id: "dueDate",
    header: dueDateHeader,
    cell: NoteDueDateCell,
  }),
  helper.display({ id: "createdAt", header: createdAtHeader, cell: NoteCreatedAtCell }),
  helper.display({ id: "updatedAt", header: updatedAtHeader, cell: NoteUpdatedAtCell }),
  helper.display({ id: "actions", header: actionsHeader, cell: NoteActionsCell }),
]) satisfies { length: (typeof NOTE_COLUMN_HEADERS)["length"] };
