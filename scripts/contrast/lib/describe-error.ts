/**
 * `cause` を辿って原因の連鎖を 1 行にする。
 *
 * 利用者へ出すのは原因の連鎖だけにする。スタックの内部フレームは読ませる情報ではない。
 * `layerOf` が colorjs.io の例外を `cause` に入れるので、辿って全部出す。
 *
 * 深さを切るのは `cause` が循環したときに止まらなくなるためである。10 段もあれば原因は
 * 読み取れる。
 *
 * 切ったことは出力へ出す。落ちるのは最奥、つまり根本原因の側である。印が無いと 10 段
 * ちょうどの連鎖と見分けが付かず、いちばん知りたい行が消えたことに気づけない
 */
export function describeError(error: unknown): string {
  const messages: string[] = [];
  let current = error;
  while (current instanceof Error && messages.length < 10) {
    messages.push(current.message);
    current = current.cause;
  }
  if (messages.length === 0) {
    return String(error);
  }
  return current instanceof Error ? `${messages.join(" ← ")} ← (以下略)` : messages.join(" ← ");
}
