/**
 * アプリのコードと同じディレクトリに置くが、アプリのコードではないファイルの種別。
 * `<名前>.<種別>.ts` / `.tsx` の形で置く (directory-structure.md「テストとスクリプトの配置」)。
 *
 * この一覧が唯一の定義で、lint の適用外 (`vite.config.ts`)、coverage の除外
 * (`vitest.config.ts`)、registry baseline の突き合わせ (`registry-baseline.test.ts`) が
 * ここから導出される。種別を足すときにどれか 1 つを書き忘れる事故が起きないようにするのが
 * 目的なので、導出先で改めて字面を並べ直さない。
 *
 * `lint-config.test.ts` は lint の解決結果と突き合わせる期待値を手書きで持つ。そちらを
 * ここから導出すると入力どうしの比較になり検査が常に通るので、付随ファイルの分を差し引く
 * 用途にだけこの定義を使う。
 */
export const COMPANION_KINDS = ["test", "test-helpers", "story-helpers", "stories"] as const;

const EXTENSIONS = ["ts", "tsx"] as const;

/**
 * 付随ファイルに当たる glob。`prefix` は呼ぶ側の基準ディレクトリで決まり、`/` で終える
 * (lint は `**\/`、coverage は `src/**\/`)。終えないと `src*.test.ts` のような glob になる。
 */
export function companionGlobs(prefix: string): string[] {
  return COMPANION_KINDS.flatMap((kind) =>
    EXTENSIONS.map((extension) => `${prefix}*.${kind}.${extension}`),
  );
}

/**
 * ファイル名が付随ファイルかを判定する。判定する集合は `companionGlobs` と同じ。
 */
export function isCompanionFile(fileName: string): boolean {
  return COMPANION_KINDS.some((kind) =>
    EXTENSIONS.some((extension) => fileName.endsWith(`.${kind}.${extension}`)),
  );
}
