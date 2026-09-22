import { SearchIcon } from "lucide-react";
import type { SubmitEvent } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { NOTE_SEARCH_LABEL } from "../-lib/note-search";

/**
 * 一覧の検索欄。値は親が持つ (制御コンポーネント。入力値は緊急更新のまま、ADR-0014)。
 * URL への確定は submit (Enter / 検索ボタン) で親が行う。`type="search"` で role は searchbox。
 * landmark は `<form role="search">` で作る。jsx-a11y は `<search>` 要素を勧めるが、vitest 同梱の locator
 * engine (`@vitest/browser` の role 表) が `<search>` を role に写さず `getByRole("search")` で引けない
 * (2026-09-23。Playwright 本体の表は写す)。engine が追いついたら要素へ戻す (ADR-0033)。
 */
export function NoteSearchField({
  value,
  onValueChange,
  onSubmit,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <search> は vitest の locator engine が role に写さない (上の JSDoc)
    <form role="search" onSubmit={handleSubmit}>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label={NOTE_SEARCH_LABEL}
          placeholder={NOTE_SEARCH_LABEL}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit">検索</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
