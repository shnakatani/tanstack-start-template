import { notFound, redirect } from "@tanstack/react-router";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  exposesServerErrorDetails,
  SERVER_ERROR_MESSAGE,
  serverErrorAdapter,
} from "./server-error-exposure";

describe("exposesServerErrorDetails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 呼んだ時点で読むので、テストが DEV を切り替えられる
  it("DEV なら true、production なら false を返す", () => {
    vi.stubEnv("DEV", true);
    expect(exposesServerErrorDetails()).toBe(true);
    vi.stubEnv("DEV", false);
    expect(exposesServerErrorDetails()).toBe(false);
  });
});

describe("serverErrorAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Error とそのサブクラスを掴む", () => {
    expect(serverErrorAdapter.test(new Error("取得に失敗しました"))).toBe(true);
    expect(serverErrorAdapter.test(new DrizzleQueryError("select 1", ["secret"]))).toBe(true);
  });

  // redirect と notFound は Router の制御の throw で、差し替えると遷移と 404 が壊れる
  it("redirect と notFound を掴まない", () => {
    expect(serverErrorAdapter.test(redirect({ to: "/" }))).toBe(false);
    expect(serverErrorAdapter.test(notFound())).toBe(false);
  });

  it("production では、client で復元した Error は汎用の文言だけを持ち、元の文言を運ばない", () => {
    vi.stubEnv("DEV", false);
    const original = new DrizzleQueryError("select * from notes where title like ?", [
      "user-typed-secret",
    ]);

    const serialized = serverErrorAdapter.toSerializable(original);
    const restored = serverErrorAdapter.fromSerializable(serialized);

    expect(JSON.stringify(serialized)).not.toContain("user-typed-secret");
    expect(restored).toBeInstanceOf(Error);
    expect(restored.message).toBe(SERVER_ERROR_MESSAGE);
  });

  // DEV の画面は例外の文言を出すので、client まで運ぶ
  it("DEV では元の文言を運び、client で同じ文言の Error に復元する", () => {
    vi.stubEnv("DEV", true);
    const original = new Error("削除対象のノートが見つかりません: id=42");

    const restored = serverErrorAdapter.fromSerializable(
      serverErrorAdapter.toSerializable(original),
    );

    expect(restored).toBeInstanceOf(Error);
    expect(restored.message).toBe("削除対象のノートが見つかりません: id=42");
  });

  // server で描く errorComponent は生の Error を thrownValueMessage で文字列にする。client で別の文字列に
  // なると、DEV で server と client の描画が食い違う。message が空のサブクラスと、message を undefined で
  // 持つ Error (ライブラリが代入するもの) は、message ではなく値を文字列にした形で出る
  it("DEV では、server の画面が描くのと同じ文字列を運ぶ", () => {
    vi.stubEnv("DEV", true);
    const emptyMessage = new TypeError("");
    const undefinedMessage = new Error("取得に失敗しました");
    Object.defineProperty(undefinedMessage, "message", { value: undefined });

    const restoredEmpty = serverErrorAdapter.fromSerializable(
      serverErrorAdapter.toSerializable(emptyMessage),
    );
    const restoredUndefined = serverErrorAdapter.fromSerializable(
      serverErrorAdapter.toSerializable(undefinedMessage),
    );

    expect(restoredEmpty.message).toBe("TypeError");
    expect(restoredUndefined.message).toBe("Error");
  });
});
