#!/usr/bin/env bash
# dev server (`vp dev --port`) と Storybook (`storybook dev --port`) の port を
# worktree ごとに導出する。
#
#   main checkout    → <base>
#   linked worktree  → <base>+1 から <base>+999 の決定的な値（worktree 名のハッシュから算出）
#
# 複数 worktree で同時起動すると base の port が衝突するため、
# git-dir と git-common-dir の一致判定で main / linked worktree を判定する。
# ハッシュ由来のため別名 worktree 同士が同じ port に衝突する可能性はあるが
# 許容する（衝突しても起動時に気づける。serve は `--strictPort`、
# storybook は `--exact-port` で、使用中の port なら終了する。
# 厳密な一意性は不要なため）。
# git 情報が取れない場合は base にフォールバックする — port 分離が
# 効かないだけでアプリは従来どおり動く（fail-safe）。ただし観測可能にするため
# stderr に警告を残す。
# 注意: 複数の base を使うときは 1000 以上離すこと。近いと範囲が重なる
# （現行は dev server 3000 と Storybook 6006）。
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
# base 相対にする。base ごとに範囲が分かれるので、同じ worktree で dev server と
# Storybook を同時に起動しても衝突しない
offset=$((hash % 999 + 1))

# ブラウザは bad port への接続を拒む (ERR_UNSAFE_PORT)。server は起動するので
# `--strictPort` / `--exact-port` では気づけない。範囲の中で決定的に次の port へ進める。
# 表は WHATWG Fetch「Port blocking」(https://fetch.spec.whatwg.org/#port-blocking) の
# bad port の表を、2026-09-21 の版 (whatwg/fetch の 357bd98) から写した
bad_ports=" 0 1 7 9 11 13 15 17 19 20 21 22 23 25 37 42 43 53 69 77 79 87 95 101 102 103 104 \
109 110 111 113 115 117 119 123 135 137 139 143 161 179 389 427 465 512 513 514 515 526 530 \
531 532 540 548 554 556 563 587 601 636 989 990 993 995 1719 1720 1723 2049 3659 4045 4190 \
5060 5061 6000 6566 6665 6666 6667 6668 6669 6679 6697 10080 "
while [[ "${bad_ports}" == *" $((base + offset)) "* ]]; do
  offset=$((offset % 999 + 1))
done

echo "$((base + offset))"
