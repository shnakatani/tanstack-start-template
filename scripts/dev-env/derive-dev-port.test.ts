import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { cleanupTempDirs, createTempDir, git, initTempRepo } from "./git-test-utils";

/**
 * 複数 worktree で dev server と Storybook を同時起動する際の base の port の衝突を
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

  // base ごとに範囲が分かれないと、同じ worktree で dev server と Storybook が衝突する
  it("linked worktree の port は base 相対で、base が違えば別の値になる", () => {
    const repo = initTempRepo("ddp-repo-base-");
    const worktree = addWorktree(repo, "feat-base");

    const forDev = Number(runScript(worktree, [BASE]).stdout);
    const forStorybook = Number(runScript(worktree, ["6006"]).stdout);

    expect(forDev).toBeGreaterThanOrEqual(MIN_PORT);
    expect(forDev).toBeLessThanOrEqual(MAX_PORT);
    expect(forStorybook).toBeGreaterThanOrEqual(6007);
    expect(forStorybook).toBeLessThanOrEqual(7005);
    expect(forStorybook).not.toBe(forDev);
  });

  // bad port はブラウザが接続を拒む (ERR_UNSAFE_PORT)。server は起動するので --strictPort でも気づけない
  it("ハッシュが bad port に当たったら、次の bad port でない port を返す", () => {
    const repo = initTempRepo("ddp-repo-bad-");
    // cksum("wt-142") % 999 = 658
    const worktree = addWorktree(repo, "wt-142");

    // 3000 + 658 + 1 = 3659 (bad port) → 3660
    expect(runScript(worktree, [BASE]).stdout).toBe("3660");
    // 6006 + 658 + 1 = 6665、6665-6669 が続けて bad port → 6670
    expect(runScript(worktree, ["6006"]).stdout).toBe("6670");
  });

  it("bad port を避けて範囲の上端を越えるときは、範囲の下端へ戻る", () => {
    const repo = initTempRepo("ddp-repo-wrap-");
    // cksum("wt-1229") % 999 = 998
    const worktree = addWorktree(repo, "wt-1229");

    // 2660 + 998 + 1 = 3659 (bad port、範囲 2661-3659 の上端) → 2661
    expect(runScript(worktree, ["2660"]).stdout).toBe("2661");
  });

  it("bad port が範囲の上端の 1 つ手前なら、下端へ戻らず上端を返す", () => {
    const repo = initTempRepo("ddp-repo-cap-");
    // cksum("wt-1518") % 999 = 997
    const worktree = addWorktree(repo, "wt-1518");

    // 2661 + 997 + 1 = 3659 (bad port、範囲 2662-3660 の上端の 1 つ手前) → 3660 (上端)
    expect(runScript(worktree, ["2661"]).stdout).toBe("3660");
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
