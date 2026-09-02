import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { REPO_ROOT } from "../../lib/repo-root";

/**
 * docs/decisions/README.md の索引と ADR ファイルの整合を機械強制する
 * (README 規約「作成後はこの README の一覧へ 1 行追記する」の実効化)。
 */

const DECISIONS_DIR = resolve(REPO_ROOT, "docs", "decisions");

// 5 つの検査が同じディレクトリの同じ内容を見るため、列挙と読み込みは 1 回にまとめて共有する
// (テストごとに読み直すと、実行の途中でファイルが変わったとき検査ごとに別の実体を見る)
const ADR_FILES = readdirSync(DECISIONS_DIR).filter((name) => /^\d{4}-.+\.md$/.test(name));
const ADR_CONTENTS = new Map(
  ADR_FILES.map((file) => [file, readFileSync(join(DECISIONS_DIR, file), "utf8")]),
);
const README = readFileSync(join(DECISIONS_DIR, "README.md"), "utf8");

/** 共有マップからの取り出し。ADR_FILES 由来のキーしか渡さないので欠落は設定ミス */
function adrContent(file: string): string {
  const content = ADR_CONTENTS.get(file);
  if (content === undefined) {
    throw new Error(`[adr-index] 読み込み済みでない ADR を参照しました: ${file}`);
  }
  return content;
}

describe("ADR 索引の整合性", () => {
  it("走査対象が解決できている (パスずれ・rename で空検証に退化しない)", () => {
    // 下の 4 件はいずれも ADR_FILES を filter して空配列と比べる。列挙が空になると
    // 全部が無条件に通る。Superseded 系の 3 件は該当 ADR が無い間つねに空なので、
    // 退化との区別がここでしか付かない
    expect(ADR_FILES.length).toBeGreaterThan(0);
  });

  it("全 ADR ファイルが README の一覧からリンクされている", () => {
    const missing = ADR_FILES.filter((file) => !README.includes(`](${file})`));
    expect(missing).toEqual([]);
  });

  it("README がリンクする ADR ファイルは全て実在する", () => {
    const files = new Set(ADR_FILES);
    const linked = Array.from(README.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g), (m) => m[1]).filter(
      (name): name is string => name !== undefined,
    );
    expect(linked.length).toBeGreaterThan(0);
    const dangling = linked.filter((name) => !files.has(name));
    expect(dangling).toEqual([]);
  });

  it("本文 Status が Superseded の ADR は README の行にも Superseded が反映されている", () => {
    const offenders: string[] = [];
    for (const file of ADR_FILES) {
      const status = adrContent(file).match(/^- Status: (\S+)/m)?.[1];
      if (status === "Superseded") {
        const row = README.split("\n").find((line) => line.includes(`](${file})`));
        if (row && !row.includes("Superseded")) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Status: Superseded の ADR は Superseded-by リンクを持つ", () => {
    const offenders = ADR_FILES.filter((file) => {
      const content = adrContent(file);
      return (
        /^- Status: Superseded/m.test(content) && !/^- Superseded-by: ADR-\d{4}/m.test(content)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("Supersedes / Superseded-by が相互リンクになっている", () => {
    const byNumber = new Map(ADR_FILES.map((file) => [file.slice(0, 4), file]));
    const broken: string[] = [];
    for (const file of ADR_FILES) {
      const selfNumber = file.slice(0, 4);
      const pairs: Array<[RegExp, string]> = [
        [/^- Supersedes: ADR-(\d{4})/m, `- Superseded-by: ADR-${selfNumber}`],
        [/^- Superseded-by: ADR-(\d{4})/m, `- Supersedes: ADR-${selfNumber}`],
      ];
      for (const [pattern, expectedBackLink] of pairs) {
        const target = adrContent(file).match(pattern)?.[1];
        if (!target) continue;
        const targetFile = byNumber.get(target);
        if (!targetFile) {
          broken.push(`${file}: 参照先 ADR-${target} が存在しない`);
        } else if (!adrContent(targetFile).includes(expectedBackLink)) {
          broken.push(`${file}: ADR-${target} 側に逆リンクがない`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
