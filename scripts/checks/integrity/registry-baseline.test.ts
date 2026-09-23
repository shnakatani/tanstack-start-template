import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { isCompanionFile } from "../../lib/companion-files";
import { REPO_ROOT } from "../../lib/repo-root";

/**
 * docs/registry-baseline/ に生成時 baseline がそろっていることを機械強制する。
 *
 * ADR-0026 の 3-way 判別 (意図的乖離 = baseline とローカルの diff / 上流 drift = baseline と
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
  // init がテーマを書き込む stylesheet。トークンの乖離もこの baseline との差分で判別する (ADR-0034)
  "styles.css": "src/styles.css",
};

/** ui 直下に置かれる、コンポーネントでないディレクトリ */
const UI_NON_COMPONENT_DIRS = new Set(["__screenshots__"]);

/**
 * registry 由来でない付随ファイル (`scripts/lib/companion-files.ts`) は baseline を持たない。
 * `shadcn add` の出力に含まれないので、baseline と突き合わせる対象から外す
 */
function isComponentFile(name: string): boolean {
  if (!/\.tsx?$/.test(name) || name.endsWith(".d.ts")) return false;
  return !isCompanionFile(name);
}

function uiComponentFiles(): string[] {
  return readdirSync(UI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isComponentFile(entry.name))
    .map((entry) => entry.name);
}

/**
 * `git` の出力を、リポジトリ相対パスの集合として読む。
 *
 * `-z` を付ける。既定の git は非 ASCII や `"` を含む名前を八進エスケープで引用するため
 * (`core.quotepath`)、`readdirSync` が返す実名と一致しなくなる。一致しないと無視対象を
 * 差し引けず、gitignore 済みのファイルが孤児として報告される。
 */
function gitPaths(subcommand: string, ...rest: string[]): Set<string> {
  // -z はサブコマンドの直後。末尾へ置くと `--` より後ろに入って pathspec として解釈され、
  // 出力は引用されたままなのに例外も件数の変化も出ないので、効いていないことに気付けない
  const out = execFileSync("git", [subcommand, "-z", ...rest], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return new Set(out.split("\0").filter(Boolean).map(toComparablePath));
}

/**
 * git と `readdirSync` の出力を突き合わせられる形へ揃える。
 *
 * macOS の git は `core.precomposeunicode` (既定で true) により readdir が返す NFD を NFC へ
 * 直して出力するが、`readdirSync` は NFD のまま返す。揃えないと濁点や半濁点を分解した名前で
 * 集合の照合が外れ、gitignore 済みのファイルが孤児として報告される。`-z` が止めるのは引用だけで、
 * 正規化のずれはそのまま残る。
 */
function toComparablePath(path: string): string {
  return path.normalize("NFC");
}

/**
 * baseline ディレクトリのファイルを、ディレクトリからの相対パスで返す。
 *
 * 絞り込みをここへ書かない。除外をフィルタに持たせると、`EXTERNAL_REGISTRY_FILES` から
 * 1 件消したときに、そのファイルが走査対象からも外れて無言で緑になる。同じ定数が期待値と
 * フィルタを兼ねると入力どうしの比較になり検査が常に通る
 * (`scripts/lib/companion-files.ts` の同旨)。分類は呼び出し側が行い、どの分類にも落ちない
 * ものを失敗させる。
 *
 * 見るのは disk で、そこから gitignore 済みのものだけを引く。`.DS_Store` のような無視対象を
 * 未分類として落とすと、`git status` に出ない原因でテストが赤くなる。逆に `git ls-files` で
 * 追跡分だけを見ると、`git add` 前の綴り違いの baseline が走査から消えて無言で緑になる。
 * 再帰で読むので、サブディレクトリへ入れた孤児も相対パスとして出る。
 */
function baselineFiles(): string[] {
  const ignored = gitPaths(
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    BASELINE_DIR,
  );
  return (
    readdirSync(BASELINE_DIR, { withFileTypes: true, recursive: true })
      // symlink も拾う。isFile() だけだと走査から無言で消え、「どの分類にも落ちないものを
      // 失敗させる」が成立しなくなる
      .filter((entry) => entry.isFile() || entry.isSymbolicLink())
      .map((entry) => relative(BASELINE_DIR, join(entry.parentPath, entry.name)))
      .filter(
        (path) => !ignored.has(toComparablePath(relative(REPO_ROOT, join(BASELINE_DIR, path)))),
      )
  );
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
      if (externalPath !== undefined) return !existsSync(join(REPO_ROOT, externalPath));
      // ui のコンポーネントでも登録済みの外部生成物でもないものは、分類できない残骸として落とす。
      // サブディレクトリに入ったものは name に "/" を含むのでここで落ちる
      return name.includes("/") || !isComponentFile(name) || !existsSync(join(UI_DIR, name));
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
