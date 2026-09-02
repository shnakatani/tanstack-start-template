---
---

# PR ルール

書き方そのものは `doc-hygiene.md` に従う。ここは PR 本文にしかない制約を持つ。

## description は必ず書く

PR を作成する場合、`--body ""` や `--fill` のみで description を省略しない。最低限 `## Summary` に変更内容を箇条書きで記載する。「docs だけ」「軽微な変更」は省略の理由にならない。

## テスト件数は実測してから書く

PR description に `+N case` と書く前にファイル単位で grep:

```bash
grep -c "^  test\|^  it(" src/path/to/new.test.ts
```

複数ファイル合算なら `vp test run` の出力末尾を写す。

## レビュー指摘修正コミットの命名

```
chore: PR #N レビュー指摘 X 件を本対応
```

実装コミットと分離する。分離しないと、指摘の対応内容が実装差分に埋もれて再レビューで追えなくなる。

## 副次挙動の差分は PR description に明記

sort 順序変更 / フォーマット変更 / enum 追加削除 等、主目的以外に挙動が変わる箇所は `## Summary` 内に明記する。

## PR description / commit に含めない

- `[Image #N]` などチャット内画像参照
- 「本 PR」「今回の」等の指示語 (半年後に通じない)
