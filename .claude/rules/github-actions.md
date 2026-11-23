---
paths:
  - ".github/workflows/**"
  - ".github/zizmor.yml"
  - "**/action.yml"
  - "**/action.yaml"
---

# GitHub Actions の workflow

## action の固定 (`.github/workflows/actions.lock`)

- step の `uses:` は `@vX.Y.Z` で書き、`@<SHA>` で書かない。commit は `actions.lock` が記録する (ADR-0006)
- workflow を足したとき、`uses:` を足す・変える・消したときは、リポジトリのルートで `gh actions-lock` を打ち、workflow と `actions.lock` を同じ commit に入れる。打ち忘れると、その action を使う workflow が job を始めずに `startup_failure` で止まる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- どの workflow も job を始めずに `startup_failure` で止まったら、手元で `gh actions-lock --verify` を打ち、`Not pinned` の action を確かめる。`actions-lock` の job 自身も止まるので、CI のログには出ない (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- 拡張は `gh extension install github/gh-actions-lock --pin <版>` で入れ、`<版>` は `.github/workflows/actions-lock.yml` の `--pin` にそろえる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- 別のリポジトリの reusable workflow の呼び出し (`jobs.<job_id>.uses`) は `@<SHA> # vX.Y.Z` で、container image は `@sha256:<digest>` で書く。lockfile はこれらを記録しない (ADR-0006)
- このリポジトリの composite action は workflow から `uses: $/<path>` で呼び、`./<path>` で呼ばない。ほかの action を使う composite action を `./` で呼ぶと `gh actions-lock` が `local-action` で止まる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- `action.yml` の中の `uses:` は `@<SHA> # vX.Y.Z` で書く。ほかのリポジトリがこの action を使うと、こちらの lockfile が効かない (ADR-0006)
- `actions.lock` を手で書き換えず、消さない。壊したら `git checkout origin/main -- .github/workflows/actions.lock` で戻してから `gh actions-lock` を打つ。消して作り直すと、付け替えられた tag も警告なしに受け入れる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- `--verify` の `tag-commit-mismatch` は、上流の 2 つの commit の間の変更を確かめてから `gh actions-lock --relock` で直す (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- `unreachable-pin` は、上流の履歴と release notes を確かめてから手元で `gh actions-lock --accept-moved` で直す。`--accept-moved` を CI と bot の中で打たない (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)

## zizmor

- 新しい audit で既存の workflow が落ちたら、その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
