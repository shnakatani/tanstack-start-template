# 検査スクリプトの置き方

整合検査・成果物の検査・ソース検査を足すときの置き方と、その理由を持つ。

| 決定                                                       | ADR      |
| ---------------------------------------------------------- | -------- |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない | ADR-0014 |

## explanation

### 検査スクリプトを分けて置く理由

整合検査・成果物の検査・ソース検査は、アプリのコードが 1 行も変わらなくても落ちうる。「片方を直して片方を忘れた」を捕まえるための検査だからである。置き方は次の 2 つで決まる。

- `src/` 全体へ当てるソース検査を作るなら、`scripts/checks/source/` と `checks-source` project を対で作る。先に lint (必要なら `jsPlugins`) で表せないかを見る
- 判定を `scripts/lib/` の純粋関数へ分け、単体テストを別に持つ。判定と適用を同じファイルに書くと、判定の境界条件を試すために `src/` を壊す必要が出る。実例は、実行側の `scripts/checks/runtime/security-headers.ts` と判定の `scripts/lib/response-headers.ts`
- 落ちたときに判断が要る検査だけを作る。判断が要るとは、設定を直すか期待値へ足すかを選ぶことを指す。実例は `scripts/checks/integrity/lint-config.test.ts` の緩和の適用先とルールの検査 (広げたのが意図なら期待値へ足し、誤りなら設定を直す) と、`scripts/checks/integrity/registry-baseline.test.ts` の 3-way の判別である。期待値の書き換えしか選択肢が無い検査は、上流の更新のたびに鳴って判断を鈍らせる (ADR-0014 が bail out の一覧を固定しない理由と同じ)
