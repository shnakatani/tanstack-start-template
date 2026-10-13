/**
 * `mise run db:seed` の実行口。ドメインの見本を DB_FILE_NAME の DB へ入れ直す
 * (`docs/guides/database.md`「見本のデータを入れる」)。
 * `scripts/db/` は開発の道具が製品のテーブル定義と接続を import する向きで、製品のコードは `scripts/` を import しない
 */
import { createDb } from "@/server/db";

import { NOTE_SEEDS, seedNotes } from "./lib/notes-seed.ts";

const db = createDb();
seedNotes(db);
console.log(
  `[db:seed] ${db.$client.name} の notes の行を消し、見本の ${NOTE_SEEDS.length} 件を入れ直した`,
);
db.$client.close();
