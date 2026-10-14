import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { ja } from "date-fns/locale/ja";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Toaster } from "@/components/ui/toast";
import { createNote } from "@/features/notes/functions";
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_FIELD_LABELS,
  NOTE_TITLE_MAX_LENGTH,
} from "@/features/notes/schema";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { createTestRouter } from "@/test/app/create-test-router";
import { deferMock } from "@/test/app/defer-mock";
import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";
import {
  expectDialogOpen,
  expectEmptyTextboxes,
  expectText,
} from "@/test/assert/screen-assertions";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

import { NoteCreateDialog } from "./note-create-dialog";
import {
  bodyTextbox,
  dueDateTrigger,
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./note-form.test-helpers";

/**
 * 追加の route の component が描くのと同じく、追加の URL で開いた状態で描く。閉じると一覧の URL へ移り、
 * `pathname` が変わる。一覧と、閉じたときの focus は ../new.test.tsx が持つ
 */
async function renderDialog() {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const router = createTestRouter("/notes/new", () => <NoteCreateDialog />, { routeDialog: true });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  await expect.element(titleTextbox(screen)).toBeInTheDocument();
  return { screen, invalidateSpy, queryClient, pathname: () => router.state.location.pathname };
}

describe("NoteCreateDialog", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // curateMutationErrorMessage が raw error を warn に残す。失敗系テストの出力を汚さない
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("見出しと、空のタイトルと本文の入力で開く", async () => {
    const { screen } = await renderDialog();

    await expect.element(screen.getByRole("heading", { name: "メモを追加" })).toBeInTheDocument();
    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it("開いた直後のフォーカスが先頭の入力にある", async () => {
    // autoFocus を渡さず base-ui の既定 (ポップアップ内の最初の tabbable) に委ねている。
    // 途中に tabbable な要素が挟まると先頭入力から外れるため、位置を固定する
    const { screen } = await renderDialog();

    await expect.element(titleTextbox(screen)).toHaveFocus();
  });

  it("空のまま保存すると日本語の必須メッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();

    await saveButton(screen).click();

    await expectText(screen, `${NOTE_FIELD_LABELS.title}を入力してください`);
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("上限超過のタイトルで保存すると文字数上限のメッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("あ".repeat(NOTE_TITLE_MAX_LENGTH + 1));

    await saveButton(screen).click();

    await expectText(
      screen,
      `${NOTE_FIELD_LABELS.title}は ${NOTE_TITLE_MAX_LENGTH} 文字以内で入力してください`,
    );
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("初回 submit 前はタイトルを空にしてもエラーが出ない (dynamic validation)", async () => {
    const { screen } = await renderDialog();

    await titleTextbox(screen).fill("あ");
    await titleTextbox(screen).fill("");

    // 肯定 anchor。入力が空になった状態を固定してからエラーの不在を見る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expect.element(titleTextbox(screen)).toHaveValue("");
    await expectAbsent(
      screen.getByText(`${NOTE_FIELD_LABELS.title}を入力してください`, { exact: false }),
    );
  });

  it("入力して保存すると createNote が前後空白を除いた値で呼ばれる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("  買い物リスト  ");
    await bodyTextbox(screen).fill("牛乳とパン");

    await saveButton(screen).click();

    await expect
      .poll(() => vi.mocked(createNote))
      .toHaveBeenCalledExactlyOnceWith({
        data: { title: "買い物リスト", body: "牛乳とパン", dueDate: null },
      });
  });

  it("上限の長さの本文も、本文の欄は横にも縦にもはみ出さず、ダイアログの本文を縦に送ると末尾まで見える", async () => {
    const { screen } = await renderDialog();
    const body = bodyTextbox(screen);
    await body.fill(
      "牛乳とパンを買う。".repeat(NOTE_BODY_MAX_LENGTH).slice(0, NOTE_BODY_MAX_LENGTH),
    );

    await expect
      .poll(() => {
        const element = body.element();
        return {
          horizontal: element.scrollWidth - element.clientWidth,
          vertical: element.scrollHeight - element.clientHeight,
        };
      })
      .toEqual({ horizontal: 0, vertical: 0 });
    const scrollBody = screen.getByRole("dialog").getBySlot("dialog-scroll-body");
    await expect.element(scrollBody).toHaveAttribute("data-has-overflow-y");

    const viewport = scrollBody.getBySlot("scroll-area-viewport").element();
    viewport.scrollTop = viewport.scrollHeight;
    await expect
      .poll(
        () =>
          body.element().getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom,
      )
      .toBe(true);
  });

  it("本文の欄で Enter を押すと送信せずに改行が入り、保存すると改行を保った本文が送られる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");
    await bodyTextbox(screen).click();

    await userEvent.keyboard("牛乳{Enter}パン");

    await expect.element(bodyTextbox(screen)).toHaveValue("牛乳\nパン");
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();

    await saveButton(screen).click();

    await expect
      .poll(() => vi.mocked(createNote))
      .toHaveBeenCalledExactlyOnceWith({
        data: { title: "買い物リスト", body: "牛乳\nパン", dueDate: null },
      });
  });

  it("期日を選んで保存すると createNote に YYYY-MM-DD の期日が渡る", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    // 値が無いとき Calendar は今日の月を開く。その月の 15 日を選ぶ。月末の 0 時をまたぐ
    // 実行では月がずれるが、その窓は無視できる
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), 15);
    const expectedDueDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-15`;
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");

    await expect
      .element(dueDateTrigger(screen))
      .toHaveAccessibleName(`${NOTE_FIELD_LABELS.dueDate} ${NOTE_FIELD_LABELS.dueDate}なし`);
    await dueDateTrigger(screen).click();
    // 今日が 15 日なら名前の先頭に「今日、」が付くので、前方一致にしない
    await screen
      .getByRole("button", { name: new RegExp(format(target, "PPPP", { locale: ja })) })
      .click();
    await expect
      .element(dueDateTrigger(screen))
      .toHaveAccessibleName(
        `${NOTE_FIELD_LABELS.dueDate} ${format(target, "PPP", { locale: ja })}`,
      );
    // Escape は開いている Popover だけを閉じ、外側のダイアログは開いたまま残る
    await userEvent.keyboard("{Escape}");
    await expectRemoved(screen.getByRole("grid"));
    await expectDialogOpen(screen, "dialog");
    await saveButton(screen).click();

    await expect
      .poll(() => vi.mocked(createNote))
      .toHaveBeenCalledExactlyOnceWith({
        data: { title: "買い物リスト", body: "", dueDate: expectedDueDate },
      });
  });

  it("保存に成功すると notes クエリを invalidate し、応答の時点でダイアログを閉じて route を離れる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen, invalidateSpy, pathname } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    await expectNoteDialogClosed(screen);
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
    await expect.poll(pathname).toBe("/notes");
  });

  it("キャンセルで閉じると route を離れる", async () => {
    const { screen, pathname } = await renderDialog();
    await titleTextbox(screen).fill("一時入力");

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expectNoteDialogClosed(screen);
    await expect.poll(pathname).toBe("/notes");
  });

  it("保存に失敗すると固定文言を toast に出し、server の raw message は表示しない", async () => {
    const rawMessage = "ノートを作成しましたが id を取得できませんでした";
    vi.mocked(createNote).mockRejectedValue(new Error(rawMessage));
    const { screen, pathname } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    // 直前の expectText が肯定 anchor。無いと expectAbsent は無条件に通る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage, { exact: false }));
    // 失敗時はダイアログを開いたまま保ち、入力をやり直せるようにする
    await expect.element(titleTextbox(screen)).toHaveValue("買い物リスト");
    expect(pathname()).toBe("/notes/new");
  });

  it("createNote の応答でダイアログが閉じ、一覧の再取得の完了は待たない", async () => {
    // 完了点「サーバー応答」: 閉じるのは応答時点で、再取得の完了は待たない (ADR-0017)。
    // 即 resolve だと応答前の窓が観測できない
    const invalidate = Promise.withResolvers<undefined>();
    const create = deferMock(createNote);
    const { screen, invalidateSpy, queryClient } = await renderDialog();
    // renderDialog が spy を張った queryClient と同じインスタンスを Provider が持つので、
    // onSuccess の invalidateQueries にこの差し替えが効く
    invalidateSpy.mockImplementation(() => invalidate.promise);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    // 応答前は pending 表示のまま開いている
    await expect.element(saveButton(screen)).toBeDisabled();
    await expectDialogOpen(screen, "dialog");

    create.resolve({ id: 1 });

    // 応答で閉じる。invalidateQueries は未決着
    await expectNoteDialogClosed(screen);
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });

    invalidate.resolve(undefined);
    // 完了の通知は onSuccess の中で出る。mutation は onSuccess の決着まで進行中に数えられるので、
    // 0 になるまで待ってから終える。待たないと、通知が次のテストの履歴に入りうる
    await expect.poll(() => queryClient.isMutating()).toBe(0);
  });

  it("保存の開始と完了を announcer が通知し、完了には保存した見出しを対象名に載せる", async () => {
    // ダイアログの close も一覧の行の増加も読み上げに出ないので、両端を polite の region で伝える。
    // 追加は再取得を待つ間に開き直して保存でき並行しうるので、完了の文言に対象名を載せる (ADR-0026)
    const create = deferMock(createNote);
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    await expectAnnouncements(["保存しています"]);
    // 完了は createNote の決着より前に出さない。上の expectAnnouncements が開始だけに一致した時点で見ている

    create.resolve({ id: 1 });

    await expectAnnouncements(["保存しています", "『買い物リスト』を保存しました"]);
  });

  it("検証に失敗したときは開始の通知を出さない", async () => {
    // 開始の announce は検証を通った後に置く。空のまま押しても「保存しています」は出ない
    const { screen } = await renderDialog();

    await saveButton(screen).click();

    await expectText(screen, `${NOTE_FIELD_LABELS.title}を入力してください`);
    expect(readAnnouncements()).toEqual([]);
  });

  it("保存の応答前はキャンセルできず Escape でも閉じない", async () => {
    // 完了点「サーバー応答」: 応答の前に閉じると route ごと unmount し、保存に失敗したときに入力が残らない
    // (ADR-0017)。pending の間は利用者の close を止める
    const create = deferMock(createNote);
    const { screen, pathname } = await renderDialog();
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();
    await expect.element(saveButton(screen)).toBeDisabled();

    // キャンセルは押せない。Escape は Base UI が閉じようとするのを onOpenChange で止める
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");

    await expectDialogOpen(screen, "dialog");
    await expect.element(titleTextbox(screen)).toHaveValue("買い物リスト");
    expect(pathname()).toBe("/notes/new");

    create.resolve({ id: 1 });

    // 応答での close は止めない
    await expectNoteDialogClosed(screen);
    await expect.poll(pathname).toBe("/notes");
  });
});
