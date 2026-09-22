import * as v from "valibot";

/** ドメインの呼称。画面見出し・追加ボタン・削除確認の文言が使う。 */
export const NOTE_ENTITY_LABEL = "メモ";

/** 項目の呼称。検証メッセージと各項目の `v.metadata({ label })` が同じ定数を使う (ADR-0008 §4)。 */
const TITLE_LABEL = "タイトル";
const BODY_LABEL = "本文";
/**
 * 入力用と保存用で pipe が分かれる title は、同じ action を両方に渡す。pipe の外で作る action は
 * `TInput` を型引数で与える。無いと `unknown` に推論され、`v.pipe` の overload に合わない。
 */
const titleLabel = v.metadata<string, { label: typeof TITLE_LABEL }>({ label: TITLE_LABEL });

/** 制約値はメッセージにも埋まるため、制約とメッセージが別々の数値を持たないよう定数で束ねる。 */
export const NOTE_TITLE_MAX_LENGTH = 100;
export const NOTE_BODY_MAX_LENGTH = 2000;

function requiredMessage(label: string): string {
  return `${label}を入力してください`;
}

function maxLengthMessage(label: string, maxLength: number): string {
  return `${label}は ${maxLength} 文字以内で入力してください`;
}

/**
 * 入力の 1 件。server function の validator とフォームのフィールド検証が同じ定義を使う。
 *
 * メッセージを明示するのは、フォームの FieldError がこの文言をそのまま描画するため。
 * 既定に任せると "Invalid length: Expected >=1 but received 0" のような英語の技術文言が
 * 日本語 UI に出る (schema.test.ts が回帰として固定している)。
 */
export const noteInputSchema = v.object({
  title: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, requiredMessage(TITLE_LABEL)),
    v.maxLength(NOTE_TITLE_MAX_LENGTH, maxLengthMessage(TITLE_LABEL, NOTE_TITLE_MAX_LENGTH)),
    titleLabel,
  ),
  body: v.pipe(
    v.string(),
    v.maxLength(NOTE_BODY_MAX_LENGTH, maxLengthMessage(BODY_LABEL, NOTE_BODY_MAX_LENGTH)),
    v.metadata({ label: BODY_LABEL }),
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
const noteIdValueSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.metadata({ label: "ID" }),
);

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
  v.minLength(1, requiredMessage(TITLE_LABEL)),
  v.maxLength(NOTE_TITLE_MAX_LENGTH, maxLengthMessage(TITLE_LABEL, NOTE_TITLE_MAX_LENGTH)),
  v.check((value) => value === value.trim(), `${TITLE_LABEL}の前後に空白が残っています`),
  titleLabel,
);

/** 保存済みの 1 件。DB からの読み出し結果を検証するゲートも兼ねる。 */
export const noteSchema = v.object({
  ...noteInputSchema.entries,
  // 入力側の title は trim 変換を持つため、変換なしの読み出し用へ差し替える
  title: storedTitleSchema,
  id: noteIdValueSchema,
  createdAt: v.pipe(v.date(), v.metadata({ label: "作成日時" })),
});
export type Note = v.InferOutput<typeof noteSchema>;

/**
 * 項目の呼称。値はスキーマの metadata から型付きで読む (キーの typo と label の欠落は型エラー)。
 * `satisfies` で `Note` の全項目を要求するので、項目を足すと呼称の追加も強制される。
 * フォームの label、一覧の見出し、テストのアクセシブルネーム参照がここを見る。
 */
export const NOTE_FIELD_LABELS = {
  title: v.getMetadata(noteSchema.entries.title).label,
  body: v.getMetadata(noteSchema.entries.body).label,
  id: v.getMetadata(noteSchema.entries.id).label,
  createdAt: v.getMetadata(noteSchema.entries.createdAt).label,
} satisfies Record<keyof Note, string>;

/** 1 件を指す入力 (削除など)。 */
export const noteIdSchema = v.object({
  id: noteIdValueSchema,
});
export type NoteId = v.InferOutput<typeof noteIdSchema>;

/** 絞り込みの検索語の呼称。検証メッセージが使う。 */
const QUERY_LABEL = "検索語";
export const NOTE_QUERY_MAX_LENGTH = 100;

/**
 * 一覧の絞り込み条件。URL の search param (`/notes?q=`) と `listNotes` の validator が同じ定義を使う。
 * valibot 1.x は Standard Schema なので、Router の `validateSearch` にそのまま渡せる (ADR-0033)。
 * `q` の既定は空文字 = 絞り込みなし。URL 上では `stripSearchParams` が既定値を落とす。
 */
export const noteListFilterSchema = v.object({
  q: v.optional(
    v.pipe(
      // URL の `?q=123` は Router の JSON パースで number になる。既定の英語文言を UI に出さない
      v.string(`${QUERY_LABEL}は文字列で指定してください`),
      v.trim(),
      v.maxLength(NOTE_QUERY_MAX_LENGTH, maxLengthMessage(QUERY_LABEL, NOTE_QUERY_MAX_LENGTH)),
    ),
    "",
  ),
});
export type NoteListFilter = v.InferOutput<typeof noteListFilterSchema>;
