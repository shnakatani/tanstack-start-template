/**
 * ビルド設定が要求する環境変数を fail-closed で受け取る。
 *
 * 未設定のまま先へ進むと、値の欠落は「既定のパスへ silent に接続する」ような静かな形でしか
 * 現れず、後段まで気付けない。読み出しの時点で止め、直し方を文言に含める。
 *
 * 環境ごとに値が変わらないものは環境変数にせず、モジュール定数にする (実例: `app-name.ts`)。
 *
 * @param name 環境変数名。エラー文言へそのまま埋める
 * @param value `process.env` から読んだ値
 * @param hint 直し方。呼び出し側ごとに違うので受け取る
 */
export function requireEnv(name: string, value: string | undefined, hint: string): string {
  if (!hint) {
    // 直し方の無いエラーは、呼び出し側が環境変数を手で export して回避する方向へ誘導する
    throw new Error(`requireEnv(${name}) was called without a hint.`);
  }
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}
