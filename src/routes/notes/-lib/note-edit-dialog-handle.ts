import { createDialogHandle } from "@/components/ui/dialog";
import type { Note } from "@/features/notes/schema";

/**
 * 編集のダイアログの detached trigger (一覧の各行、`-components/note-cells.tsx`) と Root
 * (`NoteEditDialog`、ページが描く) を結ぶ handle。payload は編集する行の `Note`
 */
export const noteEditDialogHandle = createDialogHandle<Note>();
