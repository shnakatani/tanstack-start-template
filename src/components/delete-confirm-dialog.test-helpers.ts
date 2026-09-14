import type { Screen } from "@/test/page-helpers";

/** 確認ダイアログの確定ボタン。行のトリガー (「<名前>を削除」) と区別するため exact で取る。 */
export function confirmDeleteButton(screen: Screen) {
  return screen.getByRole("button", { name: "削除", exact: true });
}

/** `description` を渡さないときの本文。利用者に見える文言なので、ここで 1 箇所に固定する。 */
export function deleteConfirmDescription(name: string): string {
  return `「${name}」を削除しますか？この操作は取り消せません。`;
}
