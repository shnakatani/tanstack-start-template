import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";

import { NOTE_SEARCH_LABEL } from "../-lib/note-search";
import { NoteSearchField } from "./note-search-field";

describe("NoteSearchField", () => {
  it("入力で onValueChange へ現在値を渡す", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <NoteSearchField value="" onValueChange={onValueChange} onSubmit={() => {}} />,
    );

    await screen.getByRole("searchbox", { name: NOTE_SEARCH_LABEL }).fill("りんご");

    expect(onValueChange).toHaveBeenLastCalledWith("りんご");
  });

  it("入力欄は schema と同じ上限を持つ", async () => {
    const screen = await render(
      <NoteSearchField value="" onValueChange={() => {}} onSubmit={() => {}} />,
    );

    await expect
      .element(screen.getByRole("searchbox", { name: NOTE_SEARCH_LABEL }))
      .toHaveAttribute("maxlength", String(NOTE_QUERY_MAX_LENGTH));
  });

  it("Enter で onSubmit を 1 回呼ぶ", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <NoteSearchField value="りんご" onValueChange={() => {}} onSubmit={onSubmit} />,
    );

    await screen.getByRole("searchbox", { name: NOTE_SEARCH_LABEL }).click();
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

  it("form は search landmark を持つ", async () => {
    const screen = await render(
      <NoteSearchField value="" onValueChange={() => {}} onSubmit={() => {}} />,
    );

    await expect.element(screen.getByRole("search")).toBeInTheDocument();
  });
});
