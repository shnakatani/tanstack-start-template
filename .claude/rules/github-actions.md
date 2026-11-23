---
paths:
  - ".github/workflows/**"
  - ".github/zizmor.yml"
  - "**/action.yml"
  - "**/action.yaml"
---

# GitHub Actions の workflow

## action の固定 (`.github/workflows/actions.lock`)

- step の `uses:` は `@vX.Y.Z` で書き、`@<SHA> # vX.Y.Z` に戻さない。commit は `actions.lock` が記録する (ADR-0006)
- workflow を足したとき、`uses:` を足す・変える・消したときは、リポジトリのルートで `gh actions-lock` を打ち、workflow と `actions.lock` を同じ commit に入れる。打ち忘れると `actions-lock` の job が落ちる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- 拡張は `gh extension install github/gh-actions-lock --pin <版>` で入れ、`<版>` は `.github/workflows/actions-lock.yml` の `--pin` にそろえる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- 別のリポジトリの reusable workflow の呼び出し (`jobs.<job_id>.uses`) と `action.yml` の `uses:` は `@<SHA> # vX.Y.Z` で、container image は `@sha256:<digest>` で書く。lockfile はこれらを記録しない (ADR-0006)
- `actions.lock` を手で書き換えず、消さない。壊したら `git checkout origin/main -- .github/workflows/actions.lock` で戻してから `gh actions-lock` を打つ。消して作り直すと、付け替えられた tag も警告なしに受け入れる (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
- `--accept-moved` を CI と bot の中で打たない。動いた tag は上流の履歴を確かめてから `gh actions-lock --relock` で進める (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)

## zizmor

- zizmor が lockfile を読んで `unpinned-uses` を出さなくても、`uses:` が lockfile にあることは確かめていない。lockfile の検査は `gh actions-lock --verify` に任せる (ADR-0006)
- 新しい audit で既存の workflow が落ちたら、その PR の中で直すか、`.github/zizmor.yml` で理由を書いて無効にする (`docs/guides/dependencies-and-toolchain.md`「workflow に action を足す」)
