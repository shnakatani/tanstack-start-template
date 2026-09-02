import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { cleanupTempDirs, createTempDir, git, initTempRepo } from "./git-test-utils";

/**
 * 複数 worktree で dev server (`vp dev --port`) を同時起動する際の port 3000 固定衝突を
 * 避けるための scripts/dev-env/derive-dev-port.sh の仕様を機械強制する。main / linked
 * worktree の判定は git-dir / git-common-dir 一致判定を使う。
 */

const SCRIPT = resolve(__dirname, "derive-dev-port.sh");
const BASE = "3000";
const MIN_PORT = 3001;
const MAX_PORT = 3999;

afterAll(cleanupTempDirs);

function runScript(
  cwd: string,
  args: string[] = [BASE],
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("bash", [SCRIPT, ...args], { cwd, encoding: "utf8" });
  return { stdout: result.stdout.trim(), stderr: result.stderr, status: result.status };
}

/** worktree 名を親から分けるため、mkdtemp したディレクトリの中へ worktree を作る */
function addWorktree(repo: string, name: string): string {
  const dir = join(createTempDir("ddp-wt-"), name);
  git(repo, "worktree", "add", dir, "-b", `branch-${name.toLowerCase()}`);
  return dir;
}

describe("derive-dev-port.sh", () => {
  /**
   * main checkout を前提にするケースが共有する repo。スクリプトは git の情報を読むだけで
   * repo を変えないため共有できる。**この repo へ worktree を足さない** —
   * 判定は git-dir と git-common-dir の一致で行うので、共有 repo の構成を変えると
   * 他のケースの前提まで動く。worktree が要るケースは自前の repo を作る。
   */
  let mainRepo: string;

  beforeAll(() => {
    mainRepo = initTempRepo("ddp-main-");
  });

  it("main checkout では base をそのまま返す", () => {
    const result = runScript(mainRepo);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(BASE);
  });

  it("linked worktree では 3001-3999 の値を返す", () => {
    const repo = initTempRepo("ddp-repo-");
    const worktree = addWorktree(repo, "feat-x");
    const result = runScript(worktree);
    expect(result.status).toBe(0);
    const port = Number(result.stdout);
    expect(port).toBeGreaterThanOrEqual(MIN_PORT);
    expect(port).toBeLessThanOrEqual(MAX_PORT);
  });

  it("同名 worktree は同じ port を返す (決定的)", () => {
    const repoA = initTempRepo("ddp-repo-a-");
    const worktreeA = addWorktree(repoA, "feat-same");
    const repoB = initTempRepo("ddp-repo-b-");
    const worktreeB = addWorktree(repoB, "feat-same");

    const resultA = runScript(worktreeA);
    const resultB = runScript(worktreeB);
    expect(resultA.status).toBe(0);
    expect(resultB.status).toBe(0);
    expect(resultA.stdout).toBe(resultB.stdout);
  });

  it("main checkout のサブディレクトリから実行しても base を返す", () => {
    const sub = join(mainRepo, "src");
    mkdirSync(sub, { recursive: true });
    const result = runScript(sub);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(BASE);
  });

  it("worktree のサブディレクトリから実行しても同じ値を返す", () => {
    const repo = initTempRepo("ddp-repo-");
    const worktree = addWorktree(repo, "feat-sub");
    const sub = join(worktree, "src");
    mkdirSync(sub, { recursive: true });
    const atRoot = runScript(worktree);
    const atSub = runScript(sub);
    expect(atRoot.status).toBe(0);
    expect(atSub.stdout).toBe(atRoot.stdout);
  });

  it("git repo 外では base にフォールバックし stderr に警告を残す", () => {
    const dir = createTempDir("ddp-nogit-");
    const result = spawnSync("bash", [SCRIPT, BASE], {
      cwd: dir,
      encoding: "utf8",
      // 親ディレクトリ (tmpdir) が偶然 git repo でも検出しないよう ceiling を切る
      env: { ...process.env, GIT_CEILING_DIRECTORIES: dir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(BASE);
    expect(result.stderr).toContain("フォールバック");
  });

  it("引数省略時も base の既定値 (3000) で動作する (fail-safe)", () => {
    const result = spawnSync("bash", [SCRIPT], { cwd: mainRepo, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(BASE);
  });
});
