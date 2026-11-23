/**
 * drizzle-kit が migration を書き出し (drizzle.config.ts の `out`)、migrateDb が読むフォルダ。
 * 片方だけ変えると、テストが古い migration を当てたまま通る。相対パスは cwd を基準に解決される。
 */
export const MIGRATIONS_FOLDER = "./drizzle";
