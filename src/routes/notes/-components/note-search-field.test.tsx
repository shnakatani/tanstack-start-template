import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";

import { NoteSearchField } from "./note-search-field";
import { noteSearchbox } from "./note-search-field.test-helpers";

describe("NoteSearchField", () => {
  it("入力で onValueChange へ現在値を渡す", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <NoteSearchField value="" onValueChange={onValueChange} onSubmit={() => {}} />,
    );

    await noteSearchbox(screen).fill("りんご");

    expect(onValueChange).toHaveBeenLastCalledWith("りんご");
  });

  it("入力欄は schema と同じ上限を持つ", async () => {
    const screen = await render(
      <NoteSearchField value="" onValueChange={() => {}} onSubmit={() => {}} />,
    );

    await expect
      .element(noteSearchbox(screen))
      .toHaveAttribute("maxlength", String(NOTE_QUERY_MAX_LENGTH));
  });

  it("Enter で onSubmit を 1 回呼ぶ", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <NoteSearchField value="りんご" onValueChange={() => {}} onSubmit={onSubmit} />,
    );

    await noteSearchbox(screen).click();
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("検索ボタンでも onSubmit を呼ぶ", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <NoteSearchField value="りんご" onValueChange={() => {}} onSubmit={onSubmit} />,
    );

    await screen.getByRole("button", { name: "検索" }).click();

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("landmark は <search> 要素で組む", async () => {
    const screen = await render(
      <NoteSearchField value="" onValueChange={() => {}} onSubmit={() => {}} />,
    );

    // vitest 同梱の locator engine は <search> を role に写さないので (2026-09-23)、要素名で見る
    await expect.poll(() => screen.getBySlot("note-search").element().tagName).toBe("SEARCH");
  });
});
