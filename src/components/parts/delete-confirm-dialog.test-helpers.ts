import type { Screen } from "@/test/assert/screen-assertions";

/** 確認ダイアログの確定ボタン。locator の既定は完全一致なので、行のトリガー (「<名前>を削除」) には一致しない。 */
export function confirmDeleteButton(screen: Screen) {
  return screen.getByRole("button", { name: "削除" });
}

/** `description` を渡さないときの本文。利用者に見える文言なので、ここで 1 箇所に固定する。 */
export function deleteConfirmDescription(name: string): string {
  return `「${name}」を削除しますか？この操作は取り消せません。`;
}
