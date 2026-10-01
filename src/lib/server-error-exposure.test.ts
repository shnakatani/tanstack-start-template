import { runInNewContext } from "node:vm";

import { notFound, redirect } from "@tanstack/react-router";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { SERVER_ERROR_MESSAGE, serverErrorAdapter } from "./server-error-exposure";
import { thrownValueMessage } from "./thrown-value-message";

describe("serverErrorAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Error とそのサブクラスを掴む", () => {
    expect(serverErrorAdapter.test(new Error("取得に失敗しました"))).toBe(true);
    expect(serverErrorAdapter.test(new DrizzleQueryError("select 1", ["secret"]))).toBe(true);
  });

  // 別の realm で作った Error は instanceof Error が偽になる。掴まないと seroval が直列化を拒み、
  // SSR ではエラー画面の代わりに汎用の 500 になる
  it("別の realm で作った Error を掴む", () => {
    const otherRealmError: unknown = runInNewContext("new Error('取得に失敗しました')");

    expect(serverErrorAdapter.test(otherRealmError)).toBe(true);
  });

  // Error.isError が偽で instanceof Error が真の値 (Node の worker の 'error' イベントの値など) も掴む。
  // 掴まないと組み込みの直列化が message を運ぶ
  it("Error.prototype を持つが Error.isError が偽の値も掴む", () => {
    expect(serverErrorAdapter.test(Object.create(Error.prototype))).toBe(true);
  });

  // adapter は client の bundle にも入り、Vite の既定の build target のブラウザは Error.isError を持たない。
  // 型は lib の ESNext.Error が常にあるとするので、有無の確かめを消すと型でも lint でも止まらない
  it("Error.isError が無い環境でも throw せず、instanceof で Error を掴む", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Error, "isError");
    Reflect.deleteProperty(Error, "isError");
    try {
      expect(serverErrorAdapter.test(new Error("取得に失敗しました"))).toBe(true);
    } finally {
      if (descriptor) {
        Object.defineProperty(Error, "isError", descriptor);
      }
    }
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

  // server で描く errorComponent は生の Error を thrownValueMessage で文字列にし、client は復元した Error を
  // 同じ関数で文字列にする。両方が同じにならないと、DEV で server と client の描画が食い違う。message が
  // 文字列でない Error も、直列化できる文字列にして運ぶ
  it.each([
    ["message が空のサブクラス", () => new TypeError("")],
    ["message が undefined", () => errorWithMessage(undefined)],
    ["message が文字列でない", () => errorWithMessage({ code: 1 })],
    ["name と message が空", () => Object.assign(new Error(""), { name: "" })],
    ["message の読み取りが throw する", errorWithThrowingMessage],
  ])("DEV では、%s の Error を server の画面と同じ文字列で client に復元する", (_label, create) => {
    vi.stubEnv("DEV", true);
    // 文字列にできない値の warn は thrownValueMessage の仕様で、ここでは測らない
    using _warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const original = create();

    const serialized = serverErrorAdapter.toSerializable(original);
    const restored = serverErrorAdapter.fromSerializable(serialized);

    expect(typeof serialized.message).toBe("string");
    expect(thrownValueMessage(restored)).toBe(thrownValueMessage(original));
  });
});

/** message を任意の値で持つ Error。ライブラリが message に文字列以外を代入した例外を作る */
function errorWithMessage(message: unknown): Error {
  const error = new Error("取得に失敗しました");
  Object.defineProperty(error, "message", { value: message });
  return error;
}

/** message の読み取りが throw する Error */
function errorWithThrowingMessage(): Error {
  const error = new Error("取得に失敗しました");
  Object.defineProperty(error, "message", {
    get() {
      throw new Error("message を読めない");
    },
  });
  return error;
}
