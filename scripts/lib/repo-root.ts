import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * リポジトリルートの絶対パス。scripts 配下の検査が対象ファイルを引くための基準。
 *
 * 検査ごとに `resolve(__dirname, "..", "..", "..")` を書くと、階層の数がファイルの置き場所に
 * 依存する。検査を 1 階層動かしたときに登り数を直し忘れると、実在する別ディレクトリを走査して
 * 「対象 0 件で緑」になりうる (存在しないパスなら落ちるので、危ないのは実在する側)。
 */
const currentDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(currentDir, "..", "..");
