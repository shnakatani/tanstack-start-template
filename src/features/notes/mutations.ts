import type { MutationFilters } from "@tanstack/react-query";
import { mutationOptions } from "@tanstack/react-query";

import type { DeleteTarget } from "@/components/parts/delete-confirm-dialog";

import { createNote, removeNote } from "./functions";
import type { Note, NoteInput } from "./schema";

/** 削除 mutation の variables。確認ダイアログの payload と同じ形で、完了の通知に name を使う */
export type NoteDeleteTarget = DeleteTarget<Note["id"]>;

/**
 * mutation の定義。`queries.ts` の `queryOptions` と同じ置き方で、`mutationKey` と `mutationFn` を
 * 1 箇所に結ぶ。`onMutate` / `onSuccess` / `onError` は、通知の文言と閉じる対象 (ダイアログの
 * handle) を持つ route 側が足す (ADR-0037「呼び出し層」)。
 *
 * `mutationKey` は一覧側が `useMutationState` で pending な mutation を拾うための識別子
 * (ADR-0021「テンプレートのメモ画面への適用」)。queryKey (`["notes"]`) とは別物で、
 * `invalidateQueries` の対象にはならない。
 */
export const createNoteMutation = mutationOptions({
  mutationKey: ["notes", "create"],
  mutationFn: (data: NoteInput) => createNote({ data }),
});

export const removeNoteMutation = mutationOptions({
  mutationKey: ["notes", "remove"],
  // variables に name も載せるのは完了の通知で対象を名指しするため (同時削除で 2 件の
  // 「削除しました」が並ぶと区別できない)。id の検証は removeNote 側の validator
  // (noteIdSchema) が持つ
  mutationFn: (target: NoteDeleteTarget) => removeNote({ data: { id: target.id } }),
});

/**
 * `useMutationState` / `isMutating` に渡す filters。`exact` を付けないと `mutationKey` は
 * 前方一致で当たる (query-core の `matchMutation`)。呼び出し側で都度書くと、1 箇所の抜けが
 * 別の mutation を silent に拾う。
 */
export const noteMutationFilters = {
  create: { mutationKey: createNoteMutation.mutationKey, exact: true },
  remove: { mutationKey: removeNoteMutation.mutationKey, exact: true },
} as const satisfies Record<string, MutationFilters>;
