import { SearchIcon } from "lucide-react";
import type { SubmitEvent } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";

import { NOTE_SEARCH_LABEL } from "../-lib/note-search";

/**
 * 一覧の検索欄。値は親が持つ (制御コンポーネント。入力値は緊急更新のまま、ADR-0015)。
 * URL への確定は submit (Enter / 検索ボタン) で親が行う。`type="search"` で role は searchbox、
 * landmark は `<search>` 要素。
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
    <search data-slot="note-search">
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={NOTE_SEARCH_LABEL}
            placeholder={NOTE_SEARCH_LABEL}
            // schema と同じ上限。超えた分は schema が切り詰めるので、ここは打てる長さを揃えるだけ (ADR-0019)
            maxLength={NOTE_QUERY_MAX_LENGTH}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit">検索</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </search>
  );
}
