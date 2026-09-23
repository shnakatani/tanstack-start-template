# ADR-0055: story は部品の隣に置き、registry 部品は全件カタログにする

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0022 (story を状態のカタログにする) / ADR-0049 (registry 統制、付随ファイルの扱い) / ADR-0020 (層) / ADR-0021 (className)

## Context

story を置く場所と、どの部品に story を書くかを決める。`.storybook/main.ts` の `stories` が拾う範囲と、registry の baseline 検査が見る範囲の両方に関わる。

## Decision

**story は部品と同じディレクトリに置き、`src/components/ui/` の registry 部品はすべてカタログ化する。**

`*.stories.tsx` は部品と同じディレクトリに置く。`src/components/ui/` に置いたものも `*.test.tsx` と同じ「registry 由来でない付随ファイル」として baseline 検査の対象外になる (ADR-0049)。

`src/components/ui/` の registry 部品はすべてカタログ化する。消費側からの import 件数で絞らない。

「import 0 件の部品には story を書かない」という基準は成立しない。理由は 3 つで、いずれも 2026-09-20 の実測による。

- **消費者の母数が捨てられる前提のもの。** `README.md` はデモアプリ (`src/features/notes/` と `src/routes/notes/`) の削除を利用者へ案内している。削除すると `empty` のように消費者が 0 件へ落ちる部品が出る。テンプレートの利用者にとって「テンプレート本体が今使っているか」はカタログの価値と無関係である
- **基準が推移的に閉じない。** `sheet` / `tooltip` は `sidebar` からのみ、`textarea` / `input-group` は `combobox` からのみ参照され、その参照元自体に消費者がいない。`ui/` の外で数えると 0 件になるが、素朴に数えると 1 件以上になる。同じ状態の部品が数え方だけで両側へ分かれる
- **検査の穴が残る。** story も test も持たない部品は axe が一度も当たらないまま利用者へ配られる。全件カタログ化すると light / dark の 2 テーマぶんの a11y 検査が全部品に掛かる

上流の `write-story` skill は「ALWAYS write a Storybook story for any component written」と書いており、この決定はその既定値に沿う。vendor した registry を対象外と読む余地はあるが、テンプレートは registry を配ることが役目なので対象に含める。

story を置けるのは `src/components/` 配下に限る。`.storybook/main.ts` の `stories` をそこへ絞っているためで、他へ置くと Storybook も vitest の project も拾わず、a11y 検査ごと無言で外れる。範囲を広げるかどうかは、`features/` や `routes/**/-components/` に story を書きたくなった時点で決める。

story は `no-restyle` / `require-static-classes` の適用外である。`vite.config.ts` の override が `src/components/{ui,action,parts}/**` を `excludeFiles` で外しており、story もそこに置くためである。部品へ `className` を直接渡しても lint は鳴らない (2026-09-20 実測)。渡してよい範囲は消費側と同じで、`no-restyle` の `allow: ["layout"]` に収まる class に限る。外見を上書きする class は部品側の variant にする (ADR-0021)。catalog は実際の使われ方を見せるものなので、消費側で書ける形を story で書けなくしない。lint が鳴らないぶんはレビューで見る。

CSF の meta は 1 ファイルに 1 つで、`component` もそこに紐づく。1 つのファイルが複数の部品を export するとき、まとめて書くと別の部品の meta 配下に並ぶ。単独で描画できる部品は story ファイルを分ける。

トークンの story は CSS 変数の値を見せる場所で、typography の階層のような class の規範は持たない。`styling.md` の表を story へ写すと片方だけが古くなる。markdown と code を突き合わせる機械検査は持っていない。

story は出荷される bundle に入らないため、`no-restricted-imports` の対象からも外す。

## Consequences

- `.stories.tsx` を registry のディレクトリに置くため、ADR-0049 の baseline 検査に除外が 1 種類増える
