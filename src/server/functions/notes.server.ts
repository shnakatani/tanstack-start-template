import { desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { noteSchema } from "@/lib/notes-schema";
import type { Note, NoteId, NoteInput } from "@/lib/notes-schema";
import { createDb } from "@/server/db";
import { notes } from "@/server/db/schema";

export type NotesDb = ReturnType<typeof createDb>;

const noteListSchema = v.array(noteSchema);

/**
 * notes の読み書きを 1 つの DB 接続に束ねる。接続そのものではなく接続を返す関数を
 * 受け取るのは、テストが `:memory:` の接続を差し込めるようにするため
 * (module-level の接続を直接掴むと差し替え口が無くなる)。
 */
export function createNoteHandlers(getDb: () => NotesDb) {
  return {
    list: async (): Promise<Note[]> => {
      // createdAt はミリ秒精度で、同一ミリ秒の連続作成では順序が決まらない。
      // 単調増加する id を第 2 キーに置いて並びを決定的にする
      const rows = await getDb()
        .select()
        .from(notes)
        .orderBy(desc(notes.createdAt), desc(notes.id));

      // drizzle の行型は「そう入っているはず」という主張であって、実データがそれを満たす
      // 保証ではない。手書き SQL・別経路の書き込み・schema 変更前の残存行でずれ得るので、
      // 読み出し口で突き合わせる。通してしまうと壊れた行が UI まで無検査で流れる
      const parsed = v.safeParse(noteListSchema, rows);
      if (!parsed.success) {
        // 値そのものは載せない (client まで届くエラーに DB の中身を混ぜない)。
        // 位置 (<行番号>.<項目名>) と件数があれば、どの行のどの項目かは追える
        const paths = [...new Set(parsed.issues.map((issue) => v.getDotPath(issue) ?? "<root>"))];
        throw new Error(
          `notes の読み出しがスキーマ検証に失敗しました (${parsed.issues.length} 件): ${paths.join(", ")}`,
        );
      }
      return parsed.output;
    },

    create: async (data: NoteInput): Promise<{ id: number }> => {
      const [created] = await getDb().insert(notes).values(data).returning({ id: notes.id });
      if (!created) {
        // INSERT ... RETURNING が 0 行を返す経路は把握していない。id 不明のまま
        // 成功を返すと呼び出し側が作成済みの 1 件を追えなくなるため fail-closed にする。
        // 値そのものは載せない (list と同じく、client まで届くエラーに入力内容を混ぜない)
        throw new Error("ノートを作成しましたが id を取得できませんでした");
      }
      return created;
    },

    remove: async ({ id }: NoteId): Promise<void> => {
      const deleted = await getDb().delete(notes).where(eq(notes.id, id)).returning({
        id: notes.id,
      });
      if (deleted.length === 0) {
        // 0 件削除を成功として返すと、既に消えている / 別 DB を見ている等の
        // 取り違えが画面上は成功に見える
        throw new Error(`削除対象のノートが見つかりません: id=${id}`);
      }
    },
  };
}

let appDb: NotesDb | undefined;

/**
 * アプリ本体が使う接続。import 時ではなく初回呼び出し時に開くことで、
 * DB_FILE_NAME を必要としない経路 (テストや client build のモジュール解決) を巻き込まない。
 * migration の適用は `mise run db:migrate` が担い、接続時には行わない。
 */
function appDbConnection(): NotesDb {
  appDb ??= createDb();
  return appDb;
}

const handlers = createNoteHandlers(appDbConnection);

export const listNotesHandler = handlers.list;
export const createNoteHandler = handlers.create;
export const removeNoteHandler = handlers.remove;
