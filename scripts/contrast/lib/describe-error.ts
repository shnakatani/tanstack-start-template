/**
 * `cause` を辿って原因の連鎖を 1 行にする。
 *
 * 利用者へ出すのは原因の連鎖だけにする。スタックの内部フレームは読ませる情報ではない。
 * `measurePair` と `layerOf` は `cause` に元の例外を入れるので、辿って全部出す。
 *
 * 深さを切るのは `cause` が循環したときに止まらなくなるためである。10 段もあれば原因は
 * 読み取れる
 */
export function describeError(error: unknown): string {
  const messages: string[] = [];
  let current = error;
  while (current instanceof Error && messages.length < 10) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages.length > 0 ? messages.join(" ← ") : String(error);
}
