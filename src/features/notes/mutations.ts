/**
 * mutation の識別子。一覧側が `useMutationState` で pending な mutation を拾うために使う
 * (ADR-0016「テンプレートのメモ画面への適用」)。queryKey (`["notes"]`) とは別物で、
 * `invalidateQueries` の対象にはならない。
 */
export const noteMutationKeys = {
  create: ["notes", "create"],
  remove: ["notes", "remove"],
} as const;
