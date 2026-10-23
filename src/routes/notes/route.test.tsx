import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  cellInColumn,
  columnHeaderWidths,
  expectDetailWithinTableContainer,
} from "@/components/parts/data-table.test-helpers";
import { sectionErrorAnnouncement } from "@/components/parts/section-error-boundary";
import { listNotes } from "@/features/notes/functions";
import { NOTE_FIELD_LABELS, NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";
import type { Note } from "@/features/notes/schema";
import { NOTE, OTHER_NOTE } from "@/features/notes/schema.test-helpers";
import { APP_NAME } from "@/lib/app-name";
import { createTestRouter } from "@/test/app/create-test-router";
import { deferMock } from "@/test/app/defer-mock";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";
import type { Screen } from "@/test/assert/screen-assertions";
import {
  MEDIUM_VIEWPORT,
  REFLOW_VIEWPORT,
  restoreDefaultViewport,
  setViewport,
} from "@/test/assert/viewport";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

// この画面に固有のテストの書き方 (route 全般の書き方は docs/guides/testing/real-router.md「route の wrapper をテストする」、debounce の打ち方と fake timers を
// 使わない理由は `docs/guides/testing/user-interactions.md`「debounce のある入力をテストする」):
// - 検索欄の landmark は `<search>` 要素で、部品のテストは要素名で見る。同梱の locator engine が
//   `search` role を `<search>` に写さない (2026-09-23 に実測)。`<form role="search">` にして
//   `getByRole("search")` で引く形は採らない。本番のマークアップをテストの欠落に合わせない
// - 同じ画面で `q` が別の値へ変わる経路は `router.navigate` で作る。確定は replace なので、memory history の
//   `back()` では前の `q` に戻れない
//
// debounce の待ちを広げる (理由は -components/notes-page.test.tsx の同じ vi.mock)。確定と戻るの直後は
// 編集の世代が URL と合わず debounce 済みの値を使わないので、広げても Enter と戻るの通知は即座に出る
vi.mock(import("./-lib/note-search"), async (importOriginal) => ({
  ...(await importOriginal()),
  NOTE_SEARCH_DEBOUNCE_MS: 1_500,
}));

import {
  noteBodyDetailRow,
  noteExpandTriggerName,
  noteRow,
} from "./-components/note-cells.test-helpers";
import { noteSearchbox } from "./-components/note-search-field.test-helpers";
import { noteColumns } from "./-lib/note-columns";
import { NOTES_RESULTS_ERROR_MESSAGE } from "./-lib/note-search";
import { NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";
import { Route as NotesRoute } from "./route";
import { renderRoute } from "./route.test-helpers";

/**
 * 中身が cell の幅を超えた cell を、列見出しと超えた px で返す。`truncate` で切り詰めた中身は
 * 内側の要素が隠すので、cell の `scrollWidth` に入らない
 */
function overflowingCells(screen: Screen) {
  const headers = screen
    .getByRole("columnheader")
    .elements()
    .map((header) => header.textContent);
  return screen
    .getByRole("cell")
    .elements()
    .flatMap((cell) => {
      const overflow = overflowOf(cell);
      if (overflow === 0) {
        return [];
      }
      if (!(cell instanceof HTMLTableCellElement)) {
        throw new Error(`cell のロールが td 以外に付いています: ${cell.outerHTML}`);
      }
      return [{ header: headers[cell.cellIndex], text: cell.textContent, overflow }];
    });
}

/** 要素の中身が要素の幅を超えた px。超えていなければ 0 */
function overflowOf(element: Element) {
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

/** 本文が列の幅で切れる 1 件。区切りの無い英字列は、折り返しが単語の途中で折ることも求める */
const LONG_BODY_NOTE: Note = {
  ...OTHER_NOTE,
  id: 4,
  title: "長い本文のメモ",
  body: `${"列の幅を超える長さの本文を書く。".repeat(6)}${"x".repeat(80)}`,
};

/**
 * route の定義と、wrapper (Route hooks と通知) の実 router での往復。
 * ページ本体の描画は -components/notes-page.test.tsx が持つ
 */
describe("/notes route", () => {
  beforeEach(() => {
    vi.mocked(listNotes).mockResolvedValue([]);
  });

  it("route に loader が定義され、pendingComponent で見出しの行と skeleton が表示される", async () => {
    expect(typeof NotesRoute.options.loader).toBe("function");

    const Pending = NotesRoute.options.pendingComponent!;
    // 見出しの行は route の staticData.pageName を読むので、描く route に同じ staticData を付ける
    const router = createTestRouter("/notes", () => <Pending />, NotesRoute.options.staticData);
    const screen = await render(<RouterProvider router={router} />);

    await expect
      .element(screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1 }))
      .toBeInTheDocument();
    await expect.element(screen.getByRole("cell", { name: "読み込み中" })).toBeInTheDocument();
    // skeleton は NOTE_COLUMNS の見出しを全部描く。列定義がそれと過不足なく同じ順に並ぶことをここで見る。
    // ずれるとロード完了時にレイアウトシフトが出る (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
    await expect
      .poll(() =>
        screen
          .getByRole("columnheader")
          .elements()
          .map((header) => header.textContent),
      )
      .toEqual(noteColumns.map((column) => column.header));
  });

  it("読み込み中の skeleton から本体に替わっても、列見出しの幅が変わらない", async () => {
    const fetching = deferMock(listNotes);
    const { screen } = await renderRoute("/notes", { pendingMs: 0 });
    await expect.element(screen.getByRole("cell", { name: "読み込み中" })).toBeInTheDocument();
    const widths = () => columnHeaderWidths(screen);
    const pending = widths();

    fetching.resolve([NOTE, OTHER_NOTE]);
    await expect.element(noteRow(screen, NOTE)).toBeInTheDocument();

    await expect.poll(widths).toEqual(pending);
  });

  // WCAG 1.4.4 は文字だけの拡大も範囲に入れ、200% で文字が隠れることを失敗に数える (F69)。列の幅が文字と
  // 一緒に広がらないと、1 行に保つ日時と操作の cell の中身が右隣の列へはみ出す (ADR-0042)。列の合計より狭い幅で見る
  describe("760px で root の文字サイズを 200% にした一覧", () => {
    afterEach(async () => {
      document.documentElement.style.fontSize = "";
      await restoreDefaultViewport();
    });

    it("cell の中身が cell からはみ出さない", async () => {
      await setViewport(MEDIUM_VIEWPORT);
      document.documentElement.style.fontSize = "32px";
      vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER_NOTE]);
      const { screen } = await renderRoute("/notes");
      await expect.element(noteRow(screen, NOTE)).toBeInTheDocument();
      await expect.element(noteRow(screen, OTHER_NOTE)).toBeInTheDocument();

      await expect.poll(() => overflowingCells(screen)).toEqual([]);
    });

    // 本文の列は切り詰める。WCAG 2.2 Understanding 1.4.4 は、全文を操作で得られ、得られることを切れていること
    // 以外の手段で示すなら切り詰めを許す (ADR-0042)。行を開くボタンで全文を出す (ADR-0043)
    it("切り詰めた本文は、行を開くと詳細の行に折り返して全文を出し、はみ出さない", async () => {
      await setViewport(MEDIUM_VIEWPORT);
      document.documentElement.style.fontSize = "32px";
      vi.mocked(listNotes).mockResolvedValue([LONG_BODY_NOTE, NOTE]);
      const { screen } = await renderRoute("/notes");
      const row = noteRow(screen, LONG_BODY_NOTE);
      await expect.element(row).toBeInTheDocument();
      const truncated = cellInColumn(screen, row, NOTE_FIELD_LABELS.body).getByText(
        LONG_BODY_NOTE.body,
      );
      await expect.poll(() => overflowOf(truncated.element())).toBeGreaterThan(0);

      await screen.getByRole("button", { name: noteExpandTriggerName(LONG_BODY_NOTE) }).click();

      const detail = noteBodyDetailRow(screen, LONG_BODY_NOTE);
      await expect.element(detail.getByRole("cell")).toHaveTextContent(LONG_BODY_NOTE.body);
      await expect.poll(() => overflowingCells(screen)).toEqual([]);
      // overflowingCells は cell の scrollWidth を見る。中身の要素が隠した分は数えないので、中身も見る
      const body = detail.getByText(LONG_BODY_NOTE.body);
      await expect.poll(() => overflowOf(body.element())).toBe(0);
    });
  });

  // WCAG 1.4.10 は表を 2 次元の配置の例外に入れるが、cell は例外に入れない (Understanding 1.4.10 の
  // Tabular data and grid-based UI)。詳細の行が表の幅で折り返すと、本文を 1 行ごとに横へ送らないと読めない (ADR-0043)
  describe("幅 320px の一覧", () => {
    afterEach(async () => {
      await restoreDefaultViewport();
    });

    it("行を開いた詳細の本文は、表を横に送っても器の見えている幅で折り返す", async () => {
      await setViewport(REFLOW_VIEWPORT);
      vi.mocked(listNotes).mockResolvedValue([LONG_BODY_NOTE, NOTE]);
      const { screen } = await renderRoute("/notes");
      await expect.element(noteRow(screen, LONG_BODY_NOTE)).toBeInTheDocument();

      await screen.getByRole("button", { name: noteExpandTriggerName(LONG_BODY_NOTE) }).click();

      const body = noteBodyDetailRow(screen, LONG_BODY_NOTE).getByText(LONG_BODY_NOTE.body);
      await expectDetailWithinTableContainer(body);
      await expect.poll(() => overflowOf(body.element())).toBe(0);
    });
  });

  it("title をページ名とアプリ名で組む", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    await renderRoute("/notes");

    await expect.poll(() => document.title).toBe(`${NOTES_PAGE_TITLE} — ${APP_NAME}`);
  });

  it("URL の q が loader と入力欄に届く", async () => {
    const { screen } = await renderRoute("/notes?q=abc");

    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // loader が取得した key を component が読むので 1 回。loaderDeps が無いと空の deps の取得が先に走る
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: "abc" } });
    // 初期表示は結果の入れ替わりではないので通知しない (spy が無ければ throw する helper)
    expect(readAnnouncements()).toEqual([]);
  });

  it("入力して Enter すると URL の q が確定する", async () => {
    const { screen, router } = await renderRoute("/notes");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.search).toEqual({ q: "xyz" });
    expect(router.state.location.href).toBe("/notes?q=xyz");
    // 検索は同じ画面の絞り込みなので履歴を積まない (replace)。push に変わると 2 になる
    expect(router.history.length).toBe(1);
    // 確定後の結果を通知する (debounce が明ける前の Enter でも落とさない。ADR-0027)
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);
    // 入力欄は作り直されず、フォーカスが残る (key={q} でページを作り直すと body へ落ちる)
    await expect.element(noteSearchbox(screen)).toHaveFocus();
  });

  it("確定した検索語の取得が失敗すると、検索欄の語を残したまま結果の部分にエラーを出す (loader の cause が stay)", async () => {
    vi.mocked(listNotes).mockImplementation(({ data }) =>
      data.q === "xyz" ? Promise.reject(new Error("取得の失敗")) : Promise.resolve([]),
    );
    const { screen, router } = await renderRoute("/notes");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }))
      .toBeVisible();
    await expect.element(noteSearchbox(screen)).toHaveValue("xyz");
    expect(router.state.location.search).toEqual({ q: "xyz" });
    // loader が待つと match が error になり、route の errorComponent がページごと置き換える
    expect(router.state.matches.map((match) => match.status)).toEqual(["success", "success"]);
    await expectAbsent(screen.getByRole("heading", { name: "エラーが発生しました" }));
  });

  it("打っただけで取得が失敗した語を、次の取得が成功する状態で Enter で確定すると、エラーが消えて結果が出る (URL の q だけが変わる再読み込み)", async () => {
    // "abc" の 1 回目だけ失敗する。空の q の最初の取得は成功させる
    let abcFetches = 0;
    vi.mocked(listNotes).mockImplementation(({ data }) => {
      if (data.q !== "abc") {
        return Promise.resolve([]);
      }
      abcFetches += 1;
      return abcFetches === 1
        ? Promise.reject(new Error("取得の失敗"))
        : Promise.resolve([{ ...NOTE, title: "確定後の結果" }]);
    });
    const { screen, router } = await renderRoute("/notes");

    // 打っただけでは URL は変わらず、debounce 後の語 (deferredQ) だけが変わって取得が失敗する
    await noteSearchbox(screen).fill("abc");
    await expect
      .element(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }))
      .toBeVisible();
    expect(router.state.location.search).toEqual({});

    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("確定後の結果", { exact: true })).toBeVisible();
    await expectAbsent(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }));
    // 区画の失敗の読み上げに続けて、回復した語の件数を読む。結果の部分が作り直されても、通知済みの語は引き継ぐ。
    // 件数まで待たずに終えると、遅れて届いた通知が次のテストの履歴に入る
    await expectAnnouncements([
      sectionErrorAnnouncement(NOTES_RESULTS_ERROR_MESSAGE),
      "『abc』に一致するメモは 1 件です",
    ]);
  });

  it("失敗した語から通知済みの語へ打ち戻すと、回復した結果の件数を読み上げる", async () => {
    vi.mocked(listNotes).mockImplementation(({ data }) =>
      data.q === "abcd" ? Promise.reject(new Error("取得の失敗")) : Promise.resolve([]),
    );
    const { screen } = await renderRoute("/notes");
    await noteSearchbox(screen).fill("abc");
    await expectAnnouncements(["『abc』に一致するメモは 0 件です"]);
    await noteSearchbox(screen).fill("abcd");
    await expect
      .element(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }))
      .toBeVisible();

    await noteSearchbox(screen).fill("abc");

    await expectRemoved(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }));
    // 失敗の読み上げが最後に伝えたことなので、戻った「abc」の件数はもう一度読む
    await expectAnnouncements([
      "『abc』に一致するメモは 0 件です",
      sectionErrorAnnouncement(NOTES_RESULTS_ERROR_MESSAGE),
      "『abc』に一致するメモは 0 件です",
    ]);
  });

  it.each(["/notes", "/notes?q=xyz"])(
    "一覧を開いたとき (%s) の取得の失敗は、route の errorComponent が受ける (loader の cause が enter)",
    async (location) => {
      vi.mocked(listNotes).mockRejectedValue(new Error("取得の失敗"));
      const { screen } = await renderRoute(location);

      await expect
        .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
        .toBeVisible();
      await expectAbsent(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }));
    },
  );

  it("一覧を開いたときの取得の失敗では、title に「エラー: 」を付ける", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    vi.mocked(listNotes).mockRejectedValue(new Error("取得の失敗"));
    const { screen } = await renderRoute("/notes");

    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました", level: 1 }))
      .toBeVisible();
    await expect.poll(() => document.title).toBe(`エラー: ${NOTES_PAGE_TITLE} — ${APP_NAME}`);
  });

  it("開いたときの失敗から再試行してまた失敗すると、検索欄を出したまま結果の部分にエラーを出す (再試行の再読み込みは stay)", async () => {
    vi.mocked(listNotes).mockRejectedValue(new Error("取得の失敗"));
    const { screen } = await renderRoute("/notes");
    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
      .toBeVisible();

    // RouteErrorContent の再試行は router.invalidate() を呼ぶ。同じ location の再読み込みなので cause は stay
    await screen.getByRole("button", { name: "再試行" }).click();

    await expect
      .element(screen.getByText(NOTES_RESULTS_ERROR_MESSAGE, { exact: true }))
      .toBeVisible();
    await expect.element(noteSearchbox(screen)).toBeVisible();
  });

  it("確定した後に URL の q が元の値へ戻っても、確定済みの編集は復活せず入力欄も一覧も q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    // xyz の結果の通知を待ってから戻る。待たずに戻ると、遅い環境では xyz の結果が決着する前に abc へ
    // 戻り、abc は通知済みとして扱う条件 (ref の初期値の URL の q) と同じなので、どちらの通知も出ない (ADR-0027)
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);

    // 途中入力を挟まずに、別の遷移 (Link や他画面からの戻る) で同じ値へ。編集を URL の値で紐付けると、
    // 同じ値に戻った瞬間に確定済みの編集が復活する
    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    await expectAnnouncements([
      "『xyz』に一致するメモは 0 件です",
      "『abc』に一致するメモは 0 件です",
    ]);
  });

  it("別の遷移で URL の q が変わると、入力欄の途中入力を捨ててその q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    // xyz の結果の通知を待ってから途中入力を打つ (理由は上のテスト)。待たないと、途中入力が xyz の
    // 世代に届く前の編集になり、「途中入力を捨てる」の前提も揃わない
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);
    await noteSearchbox(screen).fill("typed");

    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // 遷移で入れ替わった結果も通知する。同じ条件へ戻っても、直前に通知した条件と違えば出す
    await expectAnnouncements([
      "『xyz』に一致するメモは 0 件です",
      "『abc』に一致するメモは 0 件です",
    ]);
  });

  it("空白だけで Enter すると q は URL に残らない", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");

    await noteSearchbox(screen).fill("   ");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe("/notes");
  });

  it("上限を超える q は切り詰めて描き、エラーにしない (Router の search-params ガイドの fallback)", async () => {
    const capped = "a".repeat(NOTE_QUERY_MAX_LENGTH);
    const { screen } = await renderRoute(`/notes?q=${capped}a`);

    await expect.element(noteSearchbox(screen)).toHaveValue(capped);
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: capped } });
  });

  it("文字列以外の q (JSON パースで number になる) は既定の空文字に落とし、エラーにしない (Router の search-params ガイドの fallback)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { screen } = await renderRoute("/notes?q=123");

      await expect.element(noteSearchbox(screen)).toHaveValue("");
      expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: "" } });
      await expectAbsent(screen.getByRole("heading", { name: "エラーが発生しました" }));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("[notes]"), { rawInput: 123 });
    } finally {
      warn.mockRestore();
    }
  });
});
