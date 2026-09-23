import { createAlertDialogHandle } from "@/components/ui/alert-dialog";
import type { NoteDeleteTarget } from "@/features/notes/mutations";

/**
 * 削除確認ダイアログの detached trigger (一覧の各行、`-components/note-cells.tsx`) と、Root
 * (`DeleteConfirmDialog`、ページが描く) を結ぶ handle。Base UI が求めるのは Trigger と Root が
 * 同じ handle を持つことだけなので、両方が import できる module 定数として置く。
 * ページの `confirmDelete` も完了点 (a) の `close()` にこれを使う (ADR-0020)。
 */
export const noteDeleteDialogHandle = createAlertDialogHandle<NoteDeleteTarget>();
