import type { Screen } from "@/test/page-helpers";

import { NOTE_SEARCH_LABEL } from "../-lib/note-search";

/** 検索欄。部品 / ページ / route のテストが同じ locator を使う (ラベル変更で片方だけ落ちない)。 */
export function noteSearchbox(screen: Screen) {
  return screen.getByRole("searchbox", { name: NOTE_SEARCH_LABEL });
}
