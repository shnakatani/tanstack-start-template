import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/parts/data-table-features";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";

import { NoteActionsCell, NoteBodyCell, NoteCreatedAtCell } from "../-components/note-cells";
import type { NoteRow } from "./note-rows";
import { noteInputOf } from "./note-rows";

const helper = createColumnHelper<DataTableFeatures, NoteRow>();

/**
 * メモ一覧の列定義 (ADR-0018)。`TableSkeleton` の列数もここから採る。
 * 描画を持つ列は `cell` にコンポーネントの参照を渡す (`FlexRender` が cell の context を
 * props にして描く。TanStack Table「Flex Render」)。JSX はこのファイルに書かない
 */
export const noteColumns = helper.columns([
  helper.accessor((row) => noteInputOf(row).title, {
    id: "title",
    header: NOTE_FIELD_LABELS.title,
  }),
  helper.accessor((row) => noteInputOf(row).body, {
    id: "body",
    header: NOTE_FIELD_LABELS.body,
    cell: NoteBodyCell,
  }),
  helper.display({ id: "createdAt", header: NOTE_FIELD_LABELS.createdAt, cell: NoteCreatedAtCell }),
  helper.display({ id: "actions", header: "操作", cell: NoteActionsCell }),
]);
