import * as v from "valibot";
import { describe, expect, it } from "vite-plus/test";

import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_FIELD_LABELS,
  NOTE_QUERY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  noteIdSchema,
  noteInputSchema,
  noteListFilterSchema,
  noteSchema,
} from "./schema";

describe("noteInputSchema", () => {
  const valid = { title: "テスト", body: "本文" };

  it("accepts valid input", () => {
    const result = v.safeParse(noteInputSchema, valid);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only title (trim 後に空)", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, title: "   " });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from title", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, title: "  見出し  " });
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.title).toBe("見出し");
  });

  // title の長さ境界: 1 / 上限-1 / 上限 accept、上限 +1 reject
  it.each([1, NOTE_TITLE_MAX_LENGTH - 1, NOTE_TITLE_MAX_LENGTH])(
    "accepts title of %i chars (境界内)",
    (length) => {
      const result = v.safeParse(noteInputSchema, { ...valid, title: "あ".repeat(length) });
      expect(result.success).toBe(true);
    },
  );

  it("rejects title over the max length", () => {
    const result = v.safeParse(noteInputSchema, {
      ...valid,
      title: "あ".repeat(NOTE_TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty body (body に minLength 制約はない)", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, body: "" });
    expect(result.success).toBe(true);
  });

  // body の長さ境界: 0 / 上限-1 / 上限 accept、上限 +1 reject
  it.each([0, NOTE_BODY_MAX_LENGTH - 1, NOTE_BODY_MAX_LENGTH])(
    "accepts body of %i chars (境界内)",
    (length) => {
      const result = v.safeParse(noteInputSchema, { ...valid, body: "い".repeat(length) });
      expect(result.success).toBe(true);
    },
  );

  it("rejects body over the max length", () => {
    const result = v.safeParse(noteInputSchema, {
      ...valid,
      body: "い".repeat(NOTE_BODY_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  /**
   * 検証メッセージはフォームの FieldError にそのまま出る。valibot の既定文言は
   * "Invalid length: Expected >=1 but received 0" のような英語の技術文言なので、
   * 日本語 UI に出さないことを回帰として固定する。
   */
  describe("検証メッセージ", () => {
    function messagesOf(input: Record<string, unknown>): string[] {
      const result = v.safeParse(noteInputSchema, input);
      expect.assert(!result.success, "safeParse が成功してしまった");
      return result.issues.map((issue) => issue.message);
    }

    it("空 title は必須入力の日本語メッセージを返す", () => {
      expect(messagesOf({ ...valid, title: "" })).toContain(
        `${NOTE_FIELD_LABELS.title}を入力してください`,
      );
    });

    it("上限超過の title は文字数上限の日本語メッセージを返す", () => {
      expect(messagesOf({ ...valid, title: "あ".repeat(NOTE_TITLE_MAX_LENGTH + 1) })).toContain(
        `${NOTE_FIELD_LABELS.title}は ${NOTE_TITLE_MAX_LENGTH} 文字以内で入力してください`,
      );
    });

    it("上限超過の body は文字数上限の日本語メッセージを返す", () => {
      expect(messagesOf({ ...valid, body: "い".repeat(NOTE_BODY_MAX_LENGTH + 1) })).toContain(
        `${NOTE_FIELD_LABELS.body}は ${NOTE_BODY_MAX_LENGTH} 文字以内で入力してください`,
      );
    });

    it("valibot の既定文言 (英語) を返さない", () => {
      expect(messagesOf({ ...valid, title: "" }).join("\n")).not.toContain("Invalid length");
    });
  });
});

describe("noteSchema", () => {
  const valid = { title: "テスト", body: "本文", id: 1, createdAt: new Date("2026-08-17") };

  it("accepts valid note", () => {
    const result = v.safeParse(noteSchema, valid);
    expect(result.success).toBe(true);
  });

  it("rejects non-number id", () => {
    const result = v.safeParse(noteSchema, { ...valid, id: "1" });
    expect(result.success).toBe(false);
  });

  // noteSchema は読み出し時の検証ゲートも兼ねる。id の制約が noteIdSchema と違うと
  // 「書き込みでは弾かれるのに読み出しでは通る」非対称が生まれる
  it.each([0, -1, 1.5])("rejects id %p (noteIdSchema と同じ制約)", (id) => {
    const result = v.safeParse(noteSchema, { ...valid, id });
    expect(result.success).toBe(false);
  });

  it("rejects non-Date createdAt", () => {
    const result = v.safeParse(noteSchema, { ...valid, createdAt: "2026-08-17" });
    expect(result.success).toBe(false);
  });

  it("noteInputSchema の制約 (title 空) を継承して reject する", () => {
    const result = v.safeParse(noteSchema, { ...valid, title: "" });
    expect(result.success).toBe(false);
  });

  /**
   * 読み出しゲートは検証専用で、値を書き換えない。入力側と同じ trim 変換を掛けると、
   * 手書き SQL や別経路の書き込みで入った未 trim の行を黙って整えて通してしまい、
   * 「保存されている値」と「画面に出る値」が食い違ったまま気付けなくなる。
   */
  it("trim 済みの title をそのまま返す (変換しない)", () => {
    const result = v.safeParse(noteSchema, valid);
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.title).toBe(valid.title);
  });

  it("trim されていない title を reject する (整えずに乖離を顕在化させる)", () => {
    const result = v.safeParse(noteSchema, { ...valid, title: "  見出し  " });
    expect(result.success).toBe(false);
  });

  it("空白だけの title を reject する", () => {
    const result = v.safeParse(noteSchema, { ...valid, title: "   " });
    expect(result.success).toBe(false);
  });

  // 入力側の trim は維持する (フォームの前後空白は正規化して保存する)
  it("noteInputSchema 側の trim は残っている", () => {
    const result = v.safeParse(noteInputSchema, { title: "  見出し  ", body: "" });
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.title).toBe("見出し");
  });
});

describe("noteIdSchema", () => {
  it("accepts a positive integer id", () => {
    const result = v.safeParse(noteIdSchema, { id: 1 });
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.id).toBe(1);
  });

  // autoincrement の rowid は 1 始まりの整数。0 / 負数 / 小数は必ず未存在で、
  // DB へ問い合わせるまでもなく入口で弾く
  it.each([0, -1, 1.5])("rejects id %p (autoincrement rowid になり得ない)", (id) => {
    const result = v.safeParse(noteIdSchema, { id });
    expect(result.success).toBe(false);
  });

  it("rejects a string id (JSON 越しでも number のまま渡す契約)", () => {
    const result = v.safeParse(noteIdSchema, { id: "1" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing id", () => {
    const result = v.safeParse(noteIdSchema, {});
    expect(result.success).toBe(false);
  });
});

describe("noteListFilterSchema", () => {
  it("q が無ければ空文字に既定する", () => {
    expect(v.parse(noteListFilterSchema, {})).toEqual({ q: "" });
  });

  it("q の前後の空白を落とす", () => {
    expect(v.parse(noteListFilterSchema, { q: "  abc  " })).toEqual({ q: "abc" });
  });

  // title は空白だけを reject するが、q は空白だけ = 絞り込みなし (空文字) にする
  it("空白だけの q は空文字 (絞り込みなし) になる", () => {
    expect(v.parse(noteListFilterSchema, { q: "   " })).toEqual({ q: "" });
  });

  // 上限 cap = NOTE_QUERY_MAX_LENGTH。cap-1 / cap は保ち、cap+1 は cap で切る (reject しない)
  it("上限を超えた分は切り詰め、エラーにしない", () => {
    const cap = NOTE_QUERY_MAX_LENGTH;
    expect(v.parse(noteListFilterSchema, { q: "a".repeat(cap - 1) })).toEqual({
      q: "a".repeat(cap - 1),
    });
    expect(v.parse(noteListFilterSchema, { q: "a".repeat(cap) })).toEqual({ q: "a".repeat(cap) });
    expect(v.parse(noteListFilterSchema, { q: "a".repeat(cap + 1) })).toEqual({
      q: "a".repeat(cap),
    });
  });

  it("trim してから切り詰める (前後の空白は上限に含めない)", () => {
    expect(v.parse(noteListFilterSchema, { q: ` ${"a".repeat(NOTE_QUERY_MAX_LENGTH)} ` })).toEqual({
      q: "a".repeat(NOTE_QUERY_MAX_LENGTH),
    });
  });

  it("切り詰めは code unit で数え、割れたサロゲートを残さない (詳細は truncate-code-units.test.ts)", () => {
    expect(
      v.parse(noteListFilterSchema, { q: `${"あ".repeat(NOTE_QUERY_MAX_LENGTH - 1)}😀` }),
    ).toEqual({
      q: "あ".repeat(NOTE_QUERY_MAX_LENGTH - 1),
    });
  });

  // URL の `?q=123` は Router の JSON パースで number になる (ADR-0025)。既定の英語文言を出さない
  it("文字列以外の q は日本語の文言で落ちる", () => {
    const result = v.safeParse(noteListFilterSchema, { q: 1 });
    expect(result.success).toBe(false);
    expect(result.issues?.[0]?.message).toBe("検索語は文字列で指定してください");
  });
});
