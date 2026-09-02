import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { REPO_ROOT } from "../../lib/repo-root";

/**
 * docs/registry-baseline/ に生成時 baseline がそろっていることを機械強制する。
 *
 * ADR-0006 の 3-way 判別 (意図的乖離 = baseline とローカルの diff / 上流 drift = baseline と
 * 最新 CLI 出力の diff) は baseline の存在が前提で、baseline を欠いたコンポーネントだけ
 * 判別手段が 2-way へ静かに退化する。型検査もビルドも docs/ 配下の欠落を検出しないため、
 * 取得し忘れをここで failure にする。
 */

const BASELINE_DIR = join(REPO_ROOT, "docs", "registry-baseline");
const UI_DIR = join(REPO_ROOT, "src", "components", "ui");

/** src/components/ui/ の外へ生成される registry 生成物 (baseline のファイル名 → リポジトリ相対のローカル実体) */
const EXTERNAL_REGISTRY_FILES: Record<string, string> = {
  // sidebar の依存として CLI が出力する hook
  "use-mobile.ts": "src/hooks/use-mobile.ts",
};

/** ui 直下に置かれる、コンポーネントでないディレクトリ */
const UI_NON_COMPONENT_DIRS = new Set(["__screenshots__"]);

function isComponentFile(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts");
}

function uiComponentFiles(): string[] {
  return readdirSync(UI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isComponentFile(entry.name))
    .map((entry) => entry.name);
}

function baselineFiles(): string[] {
  return readdirSync(BASELINE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isComponentFile(entry.name))
    .map((entry) => entry.name);
}

describe("registry baseline の網羅", () => {
  it("走査対象が解決できている (パスずれ・rename で空検証に退化しない)", () => {
    expect(uiComponentFiles().length).toBeGreaterThan(0);
    expect(baselineFiles().length).toBeGreaterThan(0);
  });

  it("src/components/ui/ の全コンポーネントに baseline がある", () => {
    const missing = uiComponentFiles().filter((name) => !existsSync(join(BASELINE_DIR, name)));
    expect(missing).toEqual([]);
  });

  it("ui の外へ生成される registry 生成物にも baseline がある", () => {
    const missing = Object.keys(EXTERNAL_REGISTRY_FILES).filter(
      (name) => !existsSync(join(BASELINE_DIR, name)),
    );
    expect(missing).toEqual([]);
  });

  it("baseline は全て対応するローカル実体を持つ (削除済みコンポーネントの残骸を検出)", () => {
    const dangling = baselineFiles().filter((name) => {
      const externalPath = EXTERNAL_REGISTRY_FILES[name];
      return externalPath === undefined
        ? !existsSync(join(UI_DIR, name))
        : !existsSync(join(REPO_ROOT, externalPath));
    });
    expect(dangling).toEqual([]);
  });

  // 走査は ui 直下のみ。ネストしたコンポーネントが静かに検査対象から外れるのを防ぐ
  it("ui 直下に想定外のサブディレクトリが無い", () => {
    const unexpected = readdirSync(UI_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !UI_NON_COMPONENT_DIRS.has(entry.name))
      .map((entry) => entry.name);
    expect(unexpected).toEqual([]);
  });
});
