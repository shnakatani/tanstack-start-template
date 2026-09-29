import * as v from "valibot";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_FIELD_LABELS,
  NOTE_QUERY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  noteIdSchema,
  noteInputSchema,
  noteListFilterSchema,
  noteSchema,
  noteUpdateSchema,
} from "./schema";

describe("noteInputSchema", () => {
  const valid = { title: "テスト", body: "本文", dueDate: null };

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

  it("accepts title of 1 char (下限)", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, title: "あ" });
    expect(result.success).toBe(true);
  });

  it("accepts empty body (body に minLength 制約はない)", () => {
    const result = v.safeParse(noteInputSchema, { ...valid, body: "" });
    expect(result.success).toBe(true);
  });

  // 上限の境界: cap - 1 / cap は受け付け、cap + 1 は落とす。数える単位は code point (ADR-0036) で、
  // 𠮷 は 2 code unit・1 code point。code unit で数えると cap / 2 + 1 文字で落ちる
  it.each([
    ["title", NOTE_TITLE_MAX_LENGTH, "あ"],
    ["title", NOTE_TITLE_MAX_LENGTH, "𠮷"],
    ["body", NOTE_BODY_MAX_LENGTH, "い"],
    ["body", NOTE_BODY_MAX_LENGTH, "𠮷"],
  ] as const)("%s は上限 %i 文字まで受け付ける (%s)", (field, cap, char) => {
    const at = (length: number) =>
      v.safeParse(noteInputSchema, { ...valid, [field]: char.repeat(length) }).success;
    expect(at(cap - 1)).toBe(true);
    expect(at(cap)).toBe(true);
    expect(at(cap + 1)).toBe(false);
  });

  describe("dueDate", () => {
    it.each([null, "2026-08-20", "2024-02-29"])("%p を受け付ける", (dueDate) => {
      const result = v.safeParse(noteInputSchema, { ...valid, dueDate });
      expect.assert(result.success, "safeParse が失敗した");
      expect(result.output.dueDate).toBe(dueDate);
    });

    // 形式違いは isoDate、形式が正しく暦に無い日付は v.check が落とす。isoDate だけでは
    // 2023-06-31 が通る (valibot 1.4.2 の isoDate の型定義の Hint)
    it.each([
      ["2026/08/20", `${NOTE_FIELD_LABELS.dueDate}は YYYY-MM-DD の形式で指定してください`],
      ["2026-8-20", `${NOTE_FIELD_LABELS.dueDate}は YYYY-MM-DD の形式で指定してください`],
      ["2023-06-31", `${NOTE_FIELD_LABELS.dueDate}に存在しない日付が指定されています`],
      ["2023-02-29", `${NOTE_FIELD_LABELS.dueDate}に存在しない日付が指定されています`],
    ])("%p を日本語の文言で拒否する", (dueDate, message) => {
      const result = v.safeParse(noteInputSchema, { ...valid, dueDate });
      expect.assert(!result.success, "safeParse が成功してしまった");
      expect(result.issues.map((issue) => issue.message)).toContain(message);
    });

    // 期日なしは null で持つ。キーの欠けを null とみなさない (送信側の書き忘れを通さない)
    it("dueDate の欠けた入力を拒否する", () => {
      const result = v.safeParse(noteInputSchema, { title: "テスト", body: "本文" });
      expect(result.success).toBe(false);
    });
  });

  /**
   * 検証メッセージはフォームの FieldError にそのまま出る。valibot の既定文言は
   * "Invalid length: Expected >=1 but received 0" のような英語の技術文言なので、
   * 日本語 UI に出さないことを回帰として固定する。
   */
  describe("検証メッセージ", () => {
    const messagesOf = vi.defineHelper((input: Record<string, unknown>): string[] => {
      const result = v.safeParse(noteInputSchema, input);
      expect.assert(!result.success, "safeParse が成功してしまった");
      return result.issues.map((issue) => issue.message);
    });

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
  const valid = {
    title: "テスト",
    body: "本文",
    dueDate: null,
    id: 1,
    createdAt: new Date("2026-08-17"),
    updatedAt: new Date("2026-08-17"),
  };

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

  // 読み出し時の検証も入力と同じく code point で数える。cap - 1 / cap は通し、cap + 1 は落とす
  it("保存済みの title はサロゲートペアの文字を 1 文字と数える", () => {
    const at = (length: number) =>
      v.safeParse(noteSchema, { ...valid, title: "𠮷".repeat(length) }).success;
    expect(at(NOTE_TITLE_MAX_LENGTH - 1)).toBe(true);
    expect(at(NOTE_TITLE_MAX_LENGTH)).toBe(true);
    expect(at(NOTE_TITLE_MAX_LENGTH + 1)).toBe(false);
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
    const result = v.safeParse(noteInputSchema, { title: "  見出し  ", body: "", dueDate: null });
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.title).toBe("見出し");
  });

  // 読み出しゲートも入力側と同じ制約で読む。手書き SQL で入った暦に無い日付を画面へ流さない
  it("暦に無い dueDate を reject する", () => {
    const result = v.safeParse(noteSchema, { ...valid, dueDate: "2023-02-29" });
    expect(result.success).toBe(false);
  });

  it("期日の呼称を NOTE_FIELD_LABELS に載せる", () => {
    expect(NOTE_FIELD_LABELS.dueDate).toBe("期日");
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

describe("noteUpdateSchema", () => {
  const valid = { id: 1, title: "見出し", body: "", dueDate: null };

  it("accepts valid input", () => {
    const result = v.safeParse(noteUpdateSchema, valid);
    expect(result.success).toBe(true);
  });

  it("rejects a missing id", () => {
    const { id: _id, ...withoutId } = valid;
    const result = v.safeParse(noteUpdateSchema, withoutId);
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from title", () => {
    const result = v.safeParse(noteUpdateSchema, { ...valid, title: "  見出し  " });
    expect.assert(result.success, "safeParse が失敗した");
    expect(result.output.title).toBe("見出し");
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

  // 上限の境界: cap - 1 / cap 文字は保ち、cap + 1 文字は cap 文字に切る (reject しない)。数える単位は
  // code point (ADR-0036) で、𠮷 は 2 code unit・1 code point
  it.each(["a", "𠮷"])("上限を超えた分は切り詰め、エラーにしない (%s)", (char) => {
    const cap = NOTE_QUERY_MAX_LENGTH;
    const parseQ = (length: number) => v.parse(noteListFilterSchema, { q: char.repeat(length) }).q;
    expect(parseQ(cap - 1)).toBe(char.repeat(cap - 1));
    expect(parseQ(cap)).toBe(char.repeat(cap));
    expect(parseQ(cap + 1)).toBe(char.repeat(cap));
  });

  // "a" × (cap - 1) + " b" は cap + 1 文字。cap で切ると末尾が空白になるので落とし、cap - 1 文字の "a" にする。
  // 残すと、切った値をもう一度通したときに trim で値が変わる
  it("切った末尾に空白を残さず、切った値をもう一度通しても変わらない", () => {
    const cap = NOTE_QUERY_MAX_LENGTH;
    const once = v.parse(noteListFilterSchema, { q: `${"a".repeat(cap - 1)} b` });
    expect(once).toEqual({ q: "a".repeat(cap - 1) });
    expect(v.parse(noteListFilterSchema, once)).toEqual(once);
  });

  it("trim してから切り詰める (前後の空白は上限に含めない)", () => {
    expect(v.parse(noteListFilterSchema, { q: ` ${"a".repeat(NOTE_QUERY_MAX_LENGTH)} ` })).toEqual({
      q: "a".repeat(NOTE_QUERY_MAX_LENGTH),
    });
  });

  // URL の `?q=123` は Router の JSON パースで number になる (ADR-0019)。既定の英語文言を出さない
  it("文字列以外の q は日本語の文言で落ちる", () => {
    const result = v.safeParse(noteListFilterSchema, { q: 1 });
    expect(result.success).toBe(false);
    expect(result.issues?.[0]?.message).toBe("検索語は文字列で指定してください");
  });
});
