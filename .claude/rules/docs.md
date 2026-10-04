---
paths:
  - "docs/**/*.md"
  - ".claude/rules/**"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "README.md"
  - "TEMPLATE_SETUP.md"
---

# ドキュメント作法

## 置き場所

- 部品をまたぐ作法の規範と説明と手順は `docs/guides/`、決定とその比較は `docs/decisions/` (作法の選び方の比較はガイドの explanation)、Claude が作業中に読む規範の写しは `.claude/rules/` と `AGENTS.md`、1 つの部品に閉じた注意は docstring、いつ何を変えたかは git 履歴が持つ。ADR の枠内の改訂と置き換えは ADR 自身にも `Revised` / `Superseded` で残す (ADR-0001 / ADR-0000)
- コーディング規約の本体は、ADR の決定そのものなら ADR、それ以外はガイドの how-to に書き、rules と AGENTS.md にはその写しを置く。rules にしか無い規約は rules を読まないエージェントに届かず、写しにしか無い規約は人の開発に届かない (ADR-0001)
- 本体と写しが食い違ったら本体を正とし、規範を変えるときは本体を先に直す。写しから直すと本体が古いまま残る (ADR-0001)
- ライブラリが関わる規範は、本体に公式の該当箇所を引く。引かないと、規範が公式どおりかを確かめられない (ADR-0001)
- 公式から外れる書き方と、公式の複数の手段から 1 つを選ぶ書き方は、本体に理由を書く。理由が無いと、外れたのが判断か誤りか区別できない (ADR-0001)
- Claude Code のツール・skill・MCP の使い方だけを決める規範は、rules か AGENTS.md にだけ置いてよい。ガイドに置いても、人の開発には効かない (ADR-0001)
- ADR にするのは構造・主要な品質特性・戻しにくさに効く選択だけにする。決定から派生した手順や規範の表は、ADR ではなくガイドに置く (ADR-0001)
- 書くか削るかは、消したら読み手が誤った選択をするかで決める (`docs/guides/writing-docs.md`「書くか削るかを決める」)
- `CLAUDE.md` は `AGENTS.md` への symlink。編集先は `AGENTS.md` (`docs/guides/writing-docs.md`「AGENTS.md を書く」)
- rules は根拠として ADR かガイドの節を指す。ADR とガイドとコードは rules を指さない。rules は利用者が書き換えるので、指すと参照先が消える。例外は rules の置き場所や書き方を主題にする ADR とガイドで、置き場所として rules に触れてよい (ADR-0001)

## 1 つのドキュメントの中

- チャット内の参照 (`[Image #N]`) を残さない。文章で言い換える (`docs/guides/writing-docs.md`「1 つの文書の中で書かないもの」)
- 指示語 (「本 PR」「今回の」) を残さない。PR 番号か日付か commit hash に置換する (`docs/guides/writing-docs.md`「1 つの文書の中で書かないもの」)
- 相対日付を書かない。`YYYY-MM-DD` へ変換する (`docs/guides/writing-docs.md`「1 つの文書の中で書かないもの」)
- 追加一方にしない。編集のたびに統合と削除も検討する (`docs/guides/writing-docs.md`「1 つの文書の中で書かないもの」)

## 数値

- このリポジトリのコードや作業で動く数値 (違反件数、該当箇所数) は書かず、測り方だけ残す。書くと作業のたびに古くなる (ADR-0001)
- 外部の一時点の観測 (上流ツールの挙動、計測環境) には日付とバージョンを添える。後で変わったとき観測時点が分かる (ADR-0001)
- 判断の根拠を兼ねる数値は日付を添えて書き、後から消さない。消すと論証が成立しなくなる (ADR-0001)
- rules には実測値の詳細を書かず、根拠の実測は ADR かガイドへ置く。AGENTS.md には判断を決める閾値だけを書く (ADR-0001)

## ドキュメントの間

- リポジトリ内の他ドキュメントの文言を引用しない。文書の番号や見出しで指す。引用元が書き換わると引用が宙に浮く (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- ADR は `ADR-NNNN` で指す。スラッグが変わっても番号は変わらないので、参照が保たれる (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- rules の見出し語で指すのは rules の中と AGENTS.md に限る。ADR とガイドとコードは rules を指さない (例外は「置き場所」の節。ADR-0001)
- ガイドの節は `docs/guides/<file>.md「<見出し>」` の形で指す。見出しを変えたら `git grep` で指している側も直す (ADR-0001)
- ADR への markdown リンクは `docs/decisions/README.md` の一覧と `Superseded-by` の補助リンクだけに張る。リンクはファイル名を持つので、改名で切れる (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- 項目の序数 (「例外 4」) では指さない。序数は編集でずれ、ずれても静かに壊れる (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- rules の見出し語を変えるときは `grep -rn "<旧見出し語>" .claude/rules/ AGENTS.md` で参照側も直す (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- 決定を別の文書へ移すとき、移した先が覆した内容を自分の言葉で持つ。旧側の書き換えだけでは根拠が git 履歴にしか残らない (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- 陳腐化したポインタは注記を足さず、文ごと削除する (`docs/guides/writing-docs.md`「ほかの文書を指す」)
- 同じ結論の記述が複数の文書にあるのは許す。禁じるのは、片方だけを読んだ人が反対の結論に至る書き方 (ADR-0001)
- `docs/superpowers/` の spec と plan は作業のための文書で、作業が終わったら書き換えない。決定は ADR、規範はガイドに書く (`docs/guides/writing-docs.md`「作業の文書を扱う」)

## ADR

- Decision には検討した選択肢の比較表 (候補 / 評価軸 / 採否) と却下理由を必ず含める。無いと、何と比べて選んだかが残らない (`docs/guides/writing-docs.md`「ADR を書く」)

## ガイド

- 1 本に 1 主題を置き、2 つ目の主題が混ざったら別のファイルに分ける (`docs/guides/writing-docs.md`「ガイドを書く」)
- ファイル名は主題の英語名を小文字と dash にする (`lists-and-search.md`)。大文字小文字だけが違う名前は大文字小文字を区別しないファイルシステムで同じファイルとみなされ、ASCII 以外の文字は macOS が分解した形で名前に残りうる (`docs/guides/writing-docs.md`「ガイドを書く」)
- 1 つの主題の中で小主題が増えたら、主題名のディレクトリを作り、小主題ごとに 1 本ずつ置く (`docs/guides/writing-docs.md`「ガイドを書く」)
- `docs/guides/README.md` を除くどのファイルにも `## how-to` と `## explanation` を両方置き、別のファイルに分けない (`docs/guides/writing-docs.md`「ガイドを書く」)
- ガイドを足す・分ける・改名したら、`docs/guides/README.md` の一覧を直す (`docs/guides/writing-docs.md`「ガイドを書く」)
- how-to の節には規範、手順、落とし穴への対処と、規範から読み取れない事情があり消すと誤るときはその理由を書き、その形を選んだ理由 (案の比較、出典の解説) は explanation に書く (`docs/guides/writing-docs.md`「ガイドを書く」)
- 主題に関わる ADR を冒頭に「決定 / ADR」の表で並べ、関わる ADR が無いガイドには表を置かない (`docs/guides/writing-docs.md`「ガイドを書く」)
- 冒頭の表の決定の列には、ADR の 1 行目の `ADR-NNNN: ` の後ろの題をそのまま写す (`docs/guides/writing-docs.md`「ガイドを書く」)
- このリポジトリの実装はファイルパスで指し、抜き書きして貼らない。組み方を示す短い例 (`…` で省いた骨組みや、最小のテスト) と、測り方のコマンドやスクリプトは書いてよい。抜き書きは実装が変わっても変わらず、食い違ってもガイドの側では気付けない (`docs/guides/writing-docs.md`「ガイドを書く」)
- このリポジトリのファイルの行番号を書かない。上流のコードは commit SHA に固定した permalink で指してよい。行番号は編集でずれ、ずれても気付けない (`docs/guides/writing-docs.md`「ガイドを書く」)
- ADR の決定は言い換えず `ADR-NNNN` で指す。ADR に関わる内容としてガイドが書くのは、決定に沿って組む手順と、決定の前提になる仕組みの説明にする。決定を要約すると、ADR を書き換えたときに要約が古い決定を言い続ける (`docs/guides/writing-docs.md`「ガイドを書く」)
- 以前の手順と変えた理由は書かず、コードと決定が変わったらその場で書き換える。経緯は git 履歴が持つ。新しい版を足していくと、古い手順が現在の手順と並び、どれに従うかを読み手が判別することになる (`docs/guides/writing-docs.md`「ガイドを書く」)
- 本文は出典を名前の参照リンク (`[Vitest docs「Test Annotations」][]`) で挙げて URL を書かず、URL はファイル末尾の `## 出典` のリンクの定義 (`[名前]: URL`) に置く (`docs/guides/writing-docs.md`「ガイドを書く」)
- 同じ出典に言及するたびにリンクにする。最初の言及だけをリンクにすると、後の節だけを開いた読み手は出典を開けない (`docs/guides/writing-docs.md`「ガイドを書く」)
- リンクの文字列と定義の名前を同じ文字列にし、`gh api markdown -f mode=gfm -f text="$(cat <file>)"` の出力でコードの外に `][]` が残らないことを見る。名前が定義に当たらないとリンクにならず、括弧のまま表示される (`docs/guides/writing-docs.md`「ガイドを書く」)
- `## 出典` の直下に、本文の出典の名前がリンクになっていることと、名前と URL の対応がリンクの定義にあることを書き、固定した版や観測した日はその後ろに続ける。リンクの定義は描画されないので、導入が無いと描画した画面に見出しだけが残る (`docs/guides/writing-docs.md`「ガイドを書く」)
- 本文から引かずに読んだ出典は、`## 出典` の中で補足つきの参照リンクの一覧にする。定義だけを置くと描画されず、何のために読んだかも残らない (`docs/guides/writing-docs.md`「ガイドを書く」)
- ADR からガイドへ作法を移したら、作法の選び方で比較した案と却下の理由を explanation に残す (`docs/guides/writing-docs.md`「ガイドを書く」)
- ガイドの手順が指すファイルを rename したら、`git grep -n '<旧パス>' docs/guides` で直す。パスの参照は機械で検査しないので、古いパスが残っても気付けない (`docs/guides/writing-docs.md`「ガイドを書く」)

## rules の 1 項目

- 書くのは規範 (禁止には正解を対で) と出典キー 1 つ (本体の ADR 番号かガイドの節。Claude Code のツール・skill・MCP の使い方だけを決める規範は上流の docs)。理由は、規範から読み取れない事情があり消すと誤るときだけ 1 文で添え、規範を裏返しただけの理由は書かない。選択肢の順序と静かに壊れる落とし穴も規範に含む (ADR-0002)
- 実測値の詳細、選択肢の比較と却下理由、改訂履歴、出典の解説、作法の説明は書かない。決定の比較は ADR、作法の説明と作法の選び方の比較はガイドが持つ (ADR-0002)
- ガイドを `@` で import せず、「読む」とも書かない。import は `paths` があっても起動時に常時読み込まれ、案内は読まれない。rules も規範を自分で持つ (ADR-0003)
- lint・型検査・build が止めるものは書かない。書くのは lint が案内しない直し方だけ。違反は止まった時点でメッセージが示す (ADR-0002)
- 見出しでまとめ、1 項目 (箇条書き 1 つ、表の 1 セル) に 1 規範を置く。長くなったら根拠が混ざっている兆候なので、規範 1 行と出典キーに畳む (ADR-0002)

## AGENTS.md

- 手書きの行は 50 行以下を目標、100 行を上限にする。ツールが書き戻すマーカー区間 (`<!--VITE PLUS START-->` 〜 `END` 等) は数えない (`docs/guides/writing-docs.md`「AGENTS.md を書く」)
- 超えそうなら `paths` 付きで `.claude/rules/` へ分ける。Bash で打つだけの操作の規範の写しは AGENTS.md に残す。`paths` の rules は一致するファイルを読んだときにしか読み込まれない (ADR-0003)
