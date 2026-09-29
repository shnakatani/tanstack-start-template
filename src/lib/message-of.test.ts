import { describe, expect, it } from "vite-plus/test";

import { messageOf } from "./message-of";

describe("messageOf", () => {
  it("空でない文字列の message を持つ object はその message を返す", () => {
    expect(messageOf(new Error("取得に失敗しました"))).toBe("取得に失敗しました");
    expect(messageOf({ message: "入力してください", path: ["title"] })).toBe("入力してください");
  });

  it("message が空か文字列でないなら undefined を返す", () => {
    expect(messageOf({ message: "" })).toBeUndefined();
    expect(messageOf({ message: 404 })).toBeUndefined();
    expect(messageOf({ code: "REQUIRED" })).toBeUndefined();
  });

  it("object でない値は undefined を返す", () => {
    expect(messageOf("入力してください")).toBeUndefined();
    expect(messageOf(null)).toBeUndefined();
    expect(messageOf(undefined)).toBeUndefined();
    expect(messageOf(404)).toBeUndefined();
  });

  it("message の読み取りが throw する値は、その throw を呼び出し側へ渡す", () => {
    const value = {
      get message(): string {
        throw new Error("読み取れない");
      },
    };

    expect(() => messageOf(value)).toThrow("読み取れない");
  });
});
