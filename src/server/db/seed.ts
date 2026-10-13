/**
 * `mise run db:seed` の実行口。ドメインの見本を DB_FILE_NAME の DB へ入れ直す
 * (`docs/guides/database.md`「見本のデータを入れる」)。アプリのコードから import しない
 */
import { NOTE_SEEDS, seedNotes } from "@/features/notes/seed.server";

import { createDb } from "./index";

const db = createDb();
seedNotes(db);
console.log(
  `[db:seed] ${db.$client.name} の notes の行を消し、見本の ${NOTE_SEEDS.length} 件を入れ直した`,
);
db.$client.close();
