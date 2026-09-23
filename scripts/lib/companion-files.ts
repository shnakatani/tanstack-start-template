/**
 * アプリのコードと同じディレクトリに置くが、アプリのコードではないファイルの種別。
 * `<名前>.<種別>.ts` / `.tsx` の形で置く。
 *
 * この一覧が唯一の定義で、lint の適用外と story への適用範囲 (`vite.config.ts`)、coverage の
 * 除外 (`vitest.config.ts`)、registry baseline の突き合わせ (`registry-baseline.test.ts`)、
 * route ファイル判定のパターン (`companionFilePattern`) が ここから導出される。種別を足すときにどれか 1 つを書き忘れる事故が起きないようにするのが
 * 目的なので、導出先で改めて字面を並べ直さない。
 *
 * `lint-config.test.ts` は lint の解決結果と突き合わせる期待値を手書きで持つ。そちらを
 * ここから導出すると入力どうしの比較になり検査が常に通るので、付随ファイルの分を差し引く
 * 用途にだけこの定義を使う。
 */
export const COMPANION_KINDS = ["test", "test-helpers", "story-helpers", "stories"] as const;

const EXTENSIONS = ["ts", "tsx"] as const;

/**
 * 種別を絞った付随ファイルの glob。`prefix` の約束は {@link companionGlobs} と同じ。
 * 種別も拡張子も {@link COMPANION_KINDS} と同じ定義から引くので、字面を並べ直さない。
 */
function companionGlobsOfKinds(prefix: string, kinds: readonly (typeof COMPANION_KINDS)[number][]) {
  return kinds.flatMap((kind) => EXTENSIONS.map((extension) => `${prefix}*.${kind}.${extension}`));
}

/**
 * 付随ファイルに当たる glob。`prefix` は呼ぶ側の基準ディレクトリで決まり、`/` で終える
 * (lint は `**\/`、coverage は `src/**\/`)。終えないと `src*.test.ts` のような glob になる。
 */
export function companionGlobs(prefix: string): string[] {
  return companionGlobsOfKinds(prefix, COMPANION_KINDS);
}

/**
 * story のコードに当たる種別。`storybook/test` を import してよい側で、testing-library の
 * ルールを当てる範囲でもある。`satisfies` が {@link COMPANION_KINDS} の外の綴りを型で止める。
 */
const STORY_KINDS = [
  "stories",
  "story-helpers",
] as const satisfies readonly (typeof COMPANION_KINDS)[number][];

/**
 * story のコードに当たる glob。lint の適用範囲を story へ絞るときに使う。
 * `.stories.ts` を置いても、play を `*.story-helpers.ts` へ切り出しても外れない。
 */
export function storyGlobs(prefix: string): string[] {
  return companionGlobsOfKinds(prefix, STORY_KINDS);
}

/**
 * テスト専用の helper に当たる種別。locator を持ちうる側で、ブラウザテストの規範 (ADR-0043) を
 * 当てる範囲でもある。`satisfies` が {@link COMPANION_KINDS} の外の綴りを型で止める。
 */
const TEST_HELPER_KINDS = [
  "test-helpers",
] as const satisfies readonly (typeof COMPANION_KINDS)[number][];

/**
 * テスト専用 helper の glob。lint の適用範囲をブラウザテストとその helper へ絞るときに使う。
 * helper へ locator を切り出してもルールが外れない。
 */
export function testHelperGlobs(prefix: string): string[] {
  return companionGlobsOfKinds(prefix, TEST_HELPER_KINDS);
}

/**
 * ファイル名が付随ファイルかを判定する。判定する集合は `companionGlobs` と同じ。
 */
export function isCompanionFile(fileName: string): boolean {
  return COMPANION_KINDS.some((kind) =>
    EXTENSIONS.some((extension) => fileName.endsWith(`.${kind}.${extension}`)),
  );
}

/**
 * 付随ファイルに当たるファイル名の正規表現。TanStack Router の `routeFileIgnorePattern` の
 * ように、glob ではなくパターン文字列を要求する消費者へ渡す。
 */
export function companionFilePattern(): string {
  return `\\.(${COMPANION_KINDS.join("|")})\\.tsx?$`;
}

/**
 * ブラウザテストの glob。`vitest.browser.config.ts` の `include` と、`vite.config.ts` の
 * browser-test ルールの適用先が同じ集合を指す (ADR-0043)。片方だけ変えると lint の適用先が
 * 黙って browser project から外れる
 */
export const BROWSER_TEST_GLOB = "src/**/*.test.tsx";
