import { describe, expect, it } from "vite-plus/test";

import { requireEnv } from "./require-env";

const HINT = "Set it in .mise.toml [env].";

describe("requireEnv", () => {
  it("値があればそのまま返す", () => {
    expect(requireEnv("DB_FILE_NAME", ".data/dev.sqlite", HINT)).toBe(".data/dev.sqlite");
  });

  it("未設定なら変数名を含めて throw する", () => {
    expect(() => requireEnv("DB_FILE_NAME", undefined, HINT)).toThrow(/DB_FILE_NAME/);
  });

  // 空文字は「設定した」ように見えて値を持たない。undefined と同じく通さない
  it("空文字も throw する", () => {
    expect(() => requireEnv("DB_FILE_NAME", "", HINT)).toThrow(/DB_FILE_NAME/);
  });

  // 直し方が分からないと、呼び出し側は環境変数を手で export して回避しがち
  it("throw する文言に呼び出し側の hint を含める", () => {
    expect(() => requireEnv("DB_FILE_NAME", undefined, HINT)).toThrow(/\.mise\.toml/);
  });

  // hint を空で渡せると、直し方の無いエラーが素通りして上の検査が意味を失う
  it("hint が空なら値の有無によらず throw する", () => {
    expect(() => requireEnv("DB_FILE_NAME", undefined, "")).toThrow(/without a hint/);
    expect(() => requireEnv("DB_FILE_NAME", "value", "")).toThrow(/without a hint/);
  });
});
