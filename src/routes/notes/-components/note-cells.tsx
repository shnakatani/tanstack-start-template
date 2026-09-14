import { actionDisabledAppearance } from "@/components/action/button";
import type { DataTableCellContext } from "@/components/data-table-features";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date-time";

import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import type { NoteRow } from "../-lib/note-rows";

type NoteCellContext = DataTableCellContext<NoteRow>;

/** 作成日時の cell。保存中の行はまだ日時を持たないので、その位置で保存中を伝える。 */
export function NoteCreatedAtCell({ row }: NoteCellContext) {
  if (row.original.kind !== "saved") {
    // 行の aria-busy が true の間は支援技術が内容の変化を無視してよい (WAI-ARIA 1.2 aria-busy)
    // ので、このテキストは仮想カーソルで行を読んだとき用。通知は announcer (ADR-0017)
    return "保存中";
  }
  // 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の整形は
  // SSR と hydration で文字列が食い違う (format-date-time.ts)
  return formatDateTime(row.original.note.createdAt);
}

/**
 * 操作の cell。確定行には削除トリガー (detached trigger。Root はページが 1 つ描く) を出し、
 * 保存中の行は id をまだ持たないので何も出さない。
 */
export function NoteActionsCell({ row }: NoteCellContext) {
  if (row.original.kind !== "saved") {
    return null;
  }
  const { note, isDeleting } = row.original;
  return (
    <>
      {/* 削除中は行から可視の手掛かりが半透明しか出ないので、読み上げ用のテキストを足す。
          位置づけは保存中の行の「保存中」と同じ (ADR-0017) */}
      {isDeleting && <span className="sr-only">削除中</span>}
      <AlertDialogTrigger
        handle={noteDeleteDialogHandle}
        payload={{ id: note.id, name: note.title }}
        render={
          <Button
            variant="destructive"
            size="sm"
            focusableWhenDisabled
            className={actionDisabledAppearance}
          />
        }
        // 行が増えても操作対象が読み上げで分かるようにする。可視ラベル「削除」を
        // 含めることで WCAG 2.5.3 (Label in Name) も満たす
        aria-label={`${note.title}を削除`}
        // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)。render 側の
        // focusableWhenDisabled は閉じたあと Base UI がトリガーへフォーカスを返すとき、
        // native disabled でフォーカスが body へ落ちるのを防ぐ
        // (Trigger の props 型は受けず Button primitive が受ける)
        disabled={isDeleting}
      >
        削除
      </AlertDialogTrigger>
    </>
  );
}
