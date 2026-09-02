import * as v from "valibot";

/**
 * 項目の呼称の SSOT。フォームの label、検証メッセージ、テストのアクセシブルネーム参照が
 * すべてここを見る。呼称を変えるときの書き換えを 1 箇所に閉じる。
 */
export const NOTE_FIELD_LABELS = {
  title: "タイトル",
  body: "本文",
} as const;

/** 制約値はメッセージにも埋まるため、制約とメッセージが別々の数値を持たないよう定数で束ねる。 */
export const NOTE_TITLE_MAX_LENGTH = 100;
export const NOTE_BODY_MAX_LENGTH = 2000;

function maxLengthMessage(label: string, maxLength: number): string {
  return `${label}は ${maxLength} 文字以内で入力してください`;
}

/**
 * 入力の 1 件。server function の validator とフォームのフィールド検証が同じ定義を使う。
 *
 * メッセージを明示するのは、フォームの FieldError がこの文言をそのまま描画するため。
 * 既定に任せると "Invalid length: Expected >=1 but received 0" のような英語の技術文言が
 * 日本語 UI に出る (notes-schema.test.ts が回帰として固定している)。
 */
export const noteInputSchema = v.object({
  title: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, `${NOTE_FIELD_LABELS.title}を入力してください`),
    v.maxLength(
      NOTE_TITLE_MAX_LENGTH,
      maxLengthMessage(NOTE_FIELD_LABELS.title, NOTE_TITLE_MAX_LENGTH),
    ),
  ),
  body: v.pipe(
    v.string(),
    v.maxLength(
      NOTE_BODY_MAX_LENGTH,
      maxLengthMessage(NOTE_FIELD_LABELS.body, NOTE_BODY_MAX_LENGTH),
    ),
  ),
});
export type NoteInput = v.InferOutput<typeof noteInputSchema>;

/**
 * id の値そのものの制約。sqlite の autoincrement rowid は 1 始まりの整数なので、
 * 0 以下と小数は存在し得ない。
 *
 * 1 件を指す入力 (noteIdSchema) と保存済みの 1 件 (noteSchema) の両方がこれを使う。
 * 別々に書くと「書き込みでは弾かれるのに読み出しでは通る」非対称が生まれる。
 */
const noteIdValueSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

/**
 * 保存済み title の制約。入力側と同じ長さ制約を課すが、**変換は持たない**。
 *
 * 読み出しゲートの目的は out-of-band の書き込み (手書き SQL、別経路のアプリ、schema 変更前の
 * 残存行) との乖離を顕在化させること。入力側と同じ `v.trim()` を掛けると、未 trim で入った行を
 * 黙って整えて通してしまい、保存値と画面表示が食い違ったまま気付けなくなる。
 * 「trim 済みであること」を検証条件として課し、満たさない行は fail-loud で弾く。
 */
const storedTitleSchema = v.pipe(
  v.string(),
  v.minLength(1, `${NOTE_FIELD_LABELS.title}を入力してください`),
  v.maxLength(
    NOTE_TITLE_MAX_LENGTH,
    maxLengthMessage(NOTE_FIELD_LABELS.title, NOTE_TITLE_MAX_LENGTH),
  ),
  v.check(
    (value) => value === value.trim(),
    `${NOTE_FIELD_LABELS.title}の前後に空白が残っています`,
  ),
);

/** 保存済みの 1 件。DB からの読み出し結果を検証するゲートも兼ねる。 */
export const noteSchema = v.object({
  ...noteInputSchema.entries,
  // 入力側の title は trim 変換を持つため、変換なしの読み出し用へ差し替える
  title: storedTitleSchema,
  id: noteIdValueSchema,
  createdAt: v.date(),
});
export type Note = v.InferOutput<typeof noteSchema>;

/** 1 件を指す入力 (削除など)。 */
export const noteIdSchema = v.object({
  id: noteIdValueSchema,
});
export type NoteId = v.InferOutput<typeof noteIdSchema>;
