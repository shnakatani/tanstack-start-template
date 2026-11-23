/**
 * drizzle-kit が migration を書き出し (drizzle.config.ts の `out`)、migrateDb が読むフォルダ。
 * 片方だけ変えると、テストが古い migration を当てたまま通る。相対パスは cwd を基準に解決される。
 * テストが一時ディレクトリへ差し替えるので、literal 型に固めない (docs/guides/testing/user-interactions.md「debounce のある入力をテストする」と同じ理由)
 */
export const MIGRATIONS_FOLDER: string = "./drizzle";
