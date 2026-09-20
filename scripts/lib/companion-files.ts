/**
 * アプリのコードと同じディレクトリに置くが、アプリのコードではないファイルの種別。
 * `<名前>.<種別>.ts` / `.tsx` の形で置く (directory-structure.md「テストとスクリプトの配置」)。
 *
 * この一覧が唯一の定義で、lint の適用外・coverage の除外・registry baseline の突き合わせ
 * 対象の 3 つがここから導出される。種別を足すときにどれか 1 つを書き忘れる事故が起きない
 * ようにするのが目的なので、導出先で改めて字面を並べ直さない。
 *
 * `scripts/checks/integrity/lint-config.test.ts` は例外で、lint の解決結果と突き合わせる
 * 期待値を手書きで持つ。そちらをここから導出すると入力どうしの比較になり、検査が常に通る。
 */
export const COMPANION_KINDS = ["test", "test-helpers", "story-helpers", "stories"] as const;

const EXTENSIONS = ["ts", "tsx"] as const;

/**
 * 付随ファイルに当たる glob。`prefix` は呼ぶ側の基準ディレクトリで決まる
 * (lint は `**\/`、coverage は `src/**\/`)。
 */
export function companionGlobs(prefix: string): string[] {
  return COMPANION_KINDS.flatMap((kind) =>
    EXTENSIONS.map((extension) => `${prefix}*.${kind}.${extension}`),
  );
}

/**
 * ファイル名が付随ファイルかを判定する。`<名前>.<種別>.<拡張子>` の形だけを認め、
 * 名前の部分が空のもの (`test.ts`) は対象外にする。
 */
export function isCompanionFile(fileName: string): boolean {
  return COMPANION_KINDS.some((kind) =>
    EXTENSIONS.some((extension) => {
      const suffix = `.${kind}.${extension}`;
      return fileName.length > suffix.length && fileName.endsWith(suffix);
    }),
  );
}
