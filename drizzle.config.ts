import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { defineConfig } from "drizzle-kit";

import { requireEnv } from "./src/lib/require-env";

// fail-closed: 未設定のまま migration を生成/適用すると意図しないパスに接続しかねない
const dbFileName = requireEnv(
  "DB_FILE_NAME",
  process.env.DB_FILE_NAME,
  "Configure it in .mise.toml [env] or the shell.",
);

// drizzle-kit は dbCredentials.url から自前で sqlite を開くため、src/server/db.ts の
// createDb を通らない。置き場所 (.data/) が gitignore 対象で新規クローンには存在しないため、
// ここで作らないと `mise run db:migrate` が
// "Cannot open database because the directory does not exist" で落ちる。
// db.ts 側と同じ fail-safe を CLI 経路にも与える (:memory: はディレクトリを持たない)
if (dbFileName !== ":memory:") {
  mkdirSync(dirname(dbFileName), { recursive: true });
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbFileName,
  },
});
