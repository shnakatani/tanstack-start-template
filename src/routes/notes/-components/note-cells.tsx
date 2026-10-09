import { useMatchRoute } from "@tanstack/react-router";

import { ButtonLink } from "@/components/parts/button-link";
import type { DataTableCellContext } from "@/components/parts/data-table-features";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCalendarDateLabel } from "@/lib/format-calendar-date-label";
import { formatDateTime } from "@/lib/format-date-time";

import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { noteEditLinkProps } from "../-lib/note-edit-focus";
import type { NoteRow } from "../-lib/note-rows";
import { isNoteRowBusy, noteInputOf } from "../-lib/note-rows";

type NoteCellContext = DataTableCellContext<NoteRow>;

/** 本文の cell。長い本文で列が広がらないよう、1 行に切り詰める */
export function NoteBodyCell({ row }: NoteCellContext) {
  return <div className="max-w-xs truncate">{noteInputOf(row.original).body}</div>;
}

/**
 * 期日の cell。暦の日付は TZ で変換せずに、ロケールの書式で出す (ADR-0031)。保存中の行も
 * 送信した値を持つのでそのまま描く。未設定は「—」
 */
export function NoteDueDateCell({ row }: NoteCellContext) {
  const { dueDate } = noteInputOf(row.original);
  return dueDate === null ? "—" : formatCalendarDateLabel(dueDate, "short");
}

/** 作成日時の cell。保存中の行はまだ日時を持たないので、その位置で保存中を伝える。 */
export function NoteCreatedAtCell({ row }: NoteCellContext) {
  if (row.original.kind !== "saved") {
    // このテキストは仮想カーソルで行を読んだとき用。通知は announcer (ADR-0026)
    return "保存中";
  }
  // 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の整形は
  // SSR と hydration で文字列が食い違う (format-date-time.ts)
  return formatDateTime(row.original.note.createdAt);
}

/**
 * 更新日時の cell。更新中の行は再取得まで新しい日時を持たないので、その位置で更新中を伝える。
 * 保存中の行は作成日時の cell が「保存中」を出すので、状態を二重に出さないようここは空にする
 */
export function NoteUpdatedAtCell({ row }: NoteCellContext) {
  if (row.original.kind !== "saved") {
    return null;
  }
  if (row.original.pendingUpdate !== null) {
    // 位置づけは保存中の行の「保存中」と同じ (NoteCreatedAtCell)。通知は announcer (ADR-0026)
    return "更新中";
  }
  return formatDateTime(row.original.note.updatedAt);
}

/**
 * 操作の cell。確定行には編集の route へのリンクと、削除のトリガー (detached trigger。Root はページが描く) を
 * 出し、保存中の行は id をまだ持たないので何も出さない。
 */
export function NoteActionsCell({ row }: NoteCellContext) {
  const matchRoute = useMatchRoute();
  if (row.original.kind !== "saved") {
    return null;
  }
  const { note, isDeleting } = row.original;
  // 止めるのは削除中か更新中の行だけ (ADR-0017「ブロック範囲」)。更新と削除を同じ行に並行させない。
  // 判定は行の半透明と同じ isNoteRowBusy から取る。別々に書くと、条件を足したときに
  // 行の見た目とトリガーの無効化がずれる
  const isBusy = isNoteRowBusy(row.original);
  // 押した行の編集の route を読み込んでいる間、リンクに Spinner を出す (Router「Navigation」の useMatchRoute の pending)。
  // params を渡して照合すると、params.parse した数値と URL の文字列を比べて一致しない (TanStack/router#2450)。
  // route だけで照合し、返った params を文字列で比べる
  const pendingEdit = matchRoute({ to: "/notes/$noteId/edit", pending: true });
  const isEditPending = pendingEdit !== false && String(pendingEdit.noteId) === String(note.id);
  // トリガーの名前は行に見えている title から作る。更新中は編集後の値が見えているので、
  // 再取得前の note.title で読み上げると画面と食い違う
  const { title } = noteInputOf(row.original);
  return (
    <div className="flex gap-2">
      {/* 削除中は行から可視の手掛かりが半透明しか出ないので、読み上げ用のテキストを足す。
          位置づけは保存中の行の「保存中」と同じ (ADR-0026)。更新中は更新日時の cell が可視の
          「更新中」を出すので、ここには足さない */}
      {isDeleting && <span className="sr-only">削除中</span>}
      <ButtonLink
        from="/notes"
        to="/notes/$noteId/edit"
        params={{ noteId: note.id }}
        // 一覧の絞り込みを保ったまま開き、閉じたら同じ一覧へ戻る
        search={(prev) => prev}
        // 開くたびに loader が取り直すので、hover の preload は捨てる取得にしかならない (ADR-0041)
        preload={false}
        variant="outline"
        size="sm"
        {...noteEditLinkProps(note.id)}
        // 可視ラベル「編集」を含めて WCAG 2.5.3 (Label in Name) を満たす
        aria-label={`${title}を編集`}
        // 削除中と更新中は開かせない (ADR-0017「ブロック範囲」)。disabled の Link は href を外すので
        // focus できなくなる。保存して閉じたとき Base UI がこのリンクへ focus を戻せるよう、tab 順に残す
        disabled={isBusy}
        tabIndex={isBusy ? 0 : undefined}
      >
        編集
        {isEditPending && <Spinner aria-hidden />}
      </ButtonLink>
      <AlertDialogTrigger
        handle={noteDeleteDialogHandle}
        payload={{ id: note.id, name: note.title }}
        render={<Button variant="destructive" size="sm" />}
        // 行が増えても操作対象が読み上げで分かるようにする。可視ラベル「削除」を
        // 含めることで WCAG 2.5.3 (Label in Name) も満たす
        aria-label={`${title}を削除`}
        disabled={isBusy}
      >
        削除
      </AlertDialogTrigger>
    </div>
  );
}
