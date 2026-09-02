#!/usr/bin/env bash
# dev server (`vp dev --port`) の port を worktree ごとに導出する。
#
#   main checkout    → <base>                （従来どおり 3000 固定）
#   linked worktree  → 3001-3999 の決定的な値（worktree 名のハッシュから算出）
#
# 複数 worktree で dev server を同時起動すると port 3000 が衝突するため、
# git-dir と git-common-dir の一致判定で main / linked worktree を判定する。
# ハッシュ由来のため別名 worktree 同士が同じ port に衝突する可能性はあるが
# 許容する（衝突時は起動時の「ポート使用中」エラーで気づける。厳密な一意性は
# 不要なため）。
# git 情報が取れない場合は base にフォールバックする — port 分離が
# 効かないだけでアプリは従来どおり動く（fail-safe）。ただし観測可能にするため
# stderr に警告を残す。
# 注意: base は worktree 導出範囲 (3001-3999) の外に置くこと。範囲内の base を
# 渡すと main と worktree の port が衝突し得る（現行 base は 3000 で範囲外）。
set -u

base="${1:-3000}"

fallback() {
  echo "[derive-dev-port] $1 のため base にフォールバック: ${base}" >&2
  echo "${base}"
  exit 0
}

git_dir=$(git rev-parse --git-dir 2>/dev/null) || fallback "git repo 外"
git_common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || fallback "git-common-dir 解決失敗"

# 相対パスで返ることがあるため物理パスに正規化してから比較する
git_dir=$(cd "${git_dir}" 2>/dev/null && pwd -P) || fallback "git-dir 解決失敗"
git_common_dir=$(cd "${git_common_dir}" 2>/dev/null && pwd -P) || fallback "git-common-dir 解決失敗"

if [ "${git_dir}" = "${git_common_dir}" ]; then
  # main checkout
  echo "${base}"
  exit 0
fi

toplevel=$(git rev-parse --show-toplevel 2>/dev/null) || fallback "toplevel 解決失敗"

name=$(basename "${toplevel}")
if [ -z "${name}" ]; then
  fallback "worktree 名の取得結果が空"
fi

hash=$(printf '%s' "${name}" | cksum | cut -d' ' -f1)
port=$((hash % 999 + 3001))

echo "${port}"
