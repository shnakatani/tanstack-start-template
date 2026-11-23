import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { defineConfig } from "drizzle-kit";

import { requireEnv } from "./src/lib/require-env";
import { MIGRATIONS_FOLDER } from "./src/server/db/migrations-folder";

// fail-closed: 未設定のまま migration を生成/適用すると意図しないパスに接続しかねない
const dbFileName = requireEnv(
  "DB_FILE_NAME",
  process.env.DB_FILE_NAME,
  "In development, load mise's env (a shell with the mise hook, or `mise x -- vp run <task>`). Elsewhere, set DB_FILE_NAME to an absolute path.",
);

// migration を当てて DB のファイルを作るのは `vp run db:migrate` (scripts/db/migrate.ts) で、drizzle-kit migrate は
// 使わない (ADR-0050)。drizzle-kit のうち DB を開くコマンド (studio など) も better-sqlite3 で開き、ディレクトリが
// 無いと落ちる。置き場所の .data/ は新規クローンに無いので、ここでディレクトリを作る (:memory: はディレクトリを持たない)
if (dbFileName !== ":memory:") {
  mkdirSync(dirname(dbFileName), { recursive: true });
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: MIGRATIONS_FOLDER,
  dbCredentials: {
    url: dbFileName,
  },
});
