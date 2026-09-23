# registry との付き合い方

shadcn registry の部品 (`src/components/ui/`) と `src/styles.css` を足す・取り直す・変えるときの手順と、その形にしている理由を持つ。

| 決定                                                                                                               | ADR      |
| ------------------------------------------------------------------------------------------------------------------ | -------- |
| registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る | ADR-0027 |
| セマンティックトークンの値は上流生成物を土台とし、乖離は WCAG の実測と palette の段で決める                        | ADR-0033 |

乖離の一覧は台帳 `docs/registry-deviations.md` が持つ。baseline は `docs/registry-baseline/` にある。

## how-to

### 部品を足す

`src/components/ui/` に部品を足したら、最初のコミットの前に次を済ませる。

1. `vp dlx shadcn@latest add <name>` で足す
2. 同じ部品の生成時 baseline を取る (次節のコマンド)。`--overwrite` で再生成したときも取り直す
3. baseline との差分が台帳と 1:1 であることを確かめる (「baseline と突き合わせる」)
4. 上流の形を保つための lint 違反だけを行単位で抑制し、台帳の「行単位の lint 抑制」へ記録する。`oxlint-disable` の `--` には、そのルールを抑制してよい理由を書く
5. story を書く。消費側からの import が 0 件でも書く (`docs/guides/storybook.md`「registry 部品を全件カタログにする理由」)

- コード側の理由コメントは、ADR と台帳だけでは実装者が誤る落とし穴に限る
- 使っていない部品を先に入れること (vendor preset) は許す。chore のコミットとして記録する

### baseline を取り直して取り込む

生成時 baseline は `docs/registry-baseline/<name>.tsx` に置く。上流の変化を取り込むときは、baseline を取り直して 3-way で当てる。

```bash
vp dlx -- shadcn@latest add <name...> --path docs/registry-baseline --overwrite -y
# CLI は registry が宣言する依存を package.json と lockfile へ足す。--path で baseline だけを
# 再生成するときも書き込むが、vendor した部品の契約なのでそのまま受け入れる (ADR-0027)
git diff package.json
# 先頭の "use client" が残っていたら削除する (下記の CLI のバグ)
vp fmt docs/registry-baseline --write
```

取り直した後の `git diff docs/registry-baseline` が上流の drift になる。取り込み方は部品ごとに分ける。

| 旧 baseline とローカルの差分  | 取り込み方                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 差分なし (意図的な乖離がゼロ) | 新しい baseline をローカルへコピーする                                                                          |
| 差分あり                      | `git merge-file <ローカル> <旧 baseline> <新 baseline>` で 3-way マージする。上書きすると台帳にある改変が消える |

旧 baseline は `git show HEAD:docs/registry-baseline/<name>.tsx` で取る。

- `components.json` の `rsc: false` に基づく CLI の出力を基準にし、registry の生 JSON にある `"use client"` は戻さない。ただし CLI は複数の部品を 1 回で add すると `"use client"` を消し損ねることがある (shadcn-ui/ui#8991。2026-09-02 に 36 件を 1 回で add したとき 11 件に残った)。rsc の変換が `g` フラグ付きの正規表現を `.test()` で使い、`lastIndex` が呼び出しをまたいで持ち越されるためで、残る部品は add の順で入れ替わる

```
add popover              → popover: 除去される
add popover radio-group  → popover: 除去 / radio-group: 残存
add radio-group popover  → radio-group: 除去 / popover: 残存
```

- baseline はローカルと同じ整形規則に揃える (`vp fmt`)。意図的な乖離は `git diff` で見るので、揃えないと整形のノイズで埋まる。整形差分を畳むのは CLI の `--diff` だけで、`git diff` は畳まない
- baseline は lint と型検査の対象から外してある (`vite.config.ts` の `lint.ignorePatterns` と `tsconfig.json` の `exclude`)。上流のコードをそのまま保存する記録だからである
- baseline の取得漏れは `scripts/checks/integrity/registry-baseline.test.ts` が双方向で見つける

### baseline と突き合わせる

- 部品: `git diff --no-index docs/registry-baseline/<name>.tsx src/components/ui/<name>.tsx` の差分が、台帳の「コードの乖離」と 1:1 であることを確かめる
- `src/styles.css`: `git diff --no-index docs/registry-baseline/styles.css src/styles.css` の差分が、台帳の「`src/styles.css` の乖離」と 1:1 であることを確かめる。`shadcn add` は `styles.css` を出力しないので、作り直す手順は `docs/guides/styling-and-tokens.md`「トークンを作り直す」にある。上流が preset の値を変えたら、baseline を作り直してから突き合わせる
- `registry-baseline.test.ts` が見るのは baseline の有無だけで、台帳への行の足し忘れは鳴らない。とくに `src/styles.css` の足し忘れは、この突き合わせでしか見つからない
- 台帳の「registry の値を複製したファイル」は `--overwrite` では更新されない。行ごとの突き合わせの条件 (`tabs.tsx` の baseline が変わったとき、など) で見直す

### 乖離と drift の規模を測る

ローカルと最新 registry の 2-way (`shadcn add <name> --diff`) では、こちらの意図的な乖離と、生成後に上流が変わった差分を区別できない。両者の規模は次で測る。`--diff` は依存する部品も巻き込むので、比べるときはファイルの集合を揃える。

```bash
# 意図的な乖離 (baseline ↔ ローカル)
git diff --no-index docs/registry-baseline/<name>.tsx src/components/ui/<name>.tsx | grep -c '^@@'
# 2-way (ローカル ↔ 最新の upstream)
vp exec shadcn add <name> --diff | grep -c '^│ │ @@'
```

### 公式のノブを先に探す

registry の見た目を変えたいときは、打ち消しの class を積む前に、公式が用意した CSS 変数や prop のノブ (Card の `--card-spacing` と `CardAction`、ScrollArea の `scroll-area-focus-outline` など) を探す。ノブには次の落とし穴がある。

- `--card-spacing` を 0 にして inset ごと消さない。`-mx-(--card-spacing)` が 0 に解決されて、診断なしで効かなくなる。「見出し帯 + 全幅テーブル」は器を自前にする
- `scroll-area-focus-outline` (`src/styles.css`) は、Root が `overflow-hidden` を持つか Viewport に mask が乗るときに当てる。当てないと registry の focus ring が消える
- ScrollArea のバーと、そのぶんの余白は `ScrollArea` の Root が既定で持つ (台帳 `docs/registry-deviations.md` の scroll-area.tsx の行)。本文の末尾側の padding がバー幅を上回り、外側と端をそろえたいときだけ、消費側で `data-has-overflow-y:pr-0` を書く
- 背景を持つスクロール領域は、器と中身の両方へ背景を置く。器だけだと axe が背景を解決できず、中身だけだとバーの余白が地のまま残る (実例は `src/components/parts/code-block.tsx`)

## explanation

### 生成コードを直接変えてよい理由

shadcn の docs は「The top layer of your component code is open for modification」とし (https://ui.shadcn.com/docs の Open Code)、生成コードを直接変えること自体を公式の想定にしている。
統制するのは「してはいけない改変」ではなく、再生成と上流の追随を安全に回すために「何を変えたか」を残すことである。そのための記録が baseline と台帳で、変える前にまず公式の推奨に合わせ、実機で見てから判断する (ADR-0027「追加と削除の基準」)。

### 公式のノブを書き留める理由

shadcn の skill (`.claude/skills/shadcn/customization.md`「Customizing Components」) は、手段を built-in の variant → `className` → 新しい variant → wrapper の順で挙げ、CSS 変数のノブに触れない。skill だけを読むと打ち消しの class を積む方向へ進むので、確かめたノブを書き留めておく。
