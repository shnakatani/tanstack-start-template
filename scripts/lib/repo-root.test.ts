import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { REPO_ROOT } from "./repo-root";

describe("REPO_ROOT", () => {
  // 「package.json がある」だけでは node_modules 配下のパッケージでも成立する。
  // このリポジトリのルートにしか同居しない組み合わせで固定する
  it("このリポジトリのルートを指す", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "vite.config.ts"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "src", "router.tsx"))).toBe(true);
  });

  it("絶対パスを返す", () => {
    expect(REPO_ROOT.startsWith("/")).toBe(true);
  });
});
