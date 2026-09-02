import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * scripts/ 配下の git subprocess 呼び出しテスト共通の一時 git リポジトリ fixture。
 * createdDirs は module state のため、vitest 既定の per-file isolation が前提
 * (isolate:false でファイル間共有になる構成では cleanup タイミングに注意)。
 */

const createdDirs: string[] = [];

export function trackTempDir(dir: string): string {
  createdDirs.push(dir);
  return dir;
}

/**
 * 追跡付きの一時ディレクトリを作る。mkdtemp が作ったディレクトリ「そのもの」を追跡するため、
 * 中に更に子ディレクトリを作っても親が残らない。
 * `trackTempDir(join(mkdtempSync(...), name))` と書くと追跡対象が子だけになり、
 * cleanup 後も親が tmpdir へ溜まり続ける。
 */
export function createTempDir(prefix: string): string {
  return trackTempDir(mkdtempSync(join(tmpdir(), prefix)));
}

/** afterAll から呼ぶ。作成した一時ディレクトリを削除する */
export function cleanupTempDirs(): void {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
}

export function initTempRepo(prefix: string): string {
  const dir = createTempDir(prefix);
  git(dir, "init", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "test");
  writeFileSync(join(dir, "README.md"), "# test\n");
  git(dir, "add", ".");
  git(dir, "commit", "-m", "init");
  return dir;
}
