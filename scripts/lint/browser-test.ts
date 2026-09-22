import { definePlugin, defineRule, type ESTree, type SourceCode } from "vite-plus/lint/plugins";

/**
 * ブラウザテストの assert を守る oxlint の JS plugin。ルールごとに決定が別の ADR にあり、
 * どれがどの ADR かは各ルールの `meta.docs.description` が持つ。一覧は下の `definePlugin`。
 *
 * plugin の置き方 (`lint.jsPlugins` から読み、`vp lint` / `vp check` で走らせる) と、
 * 適用先 glob の決め方は ADR-0029 が全ルールぶん持つ。対象の限定は `vite.config.ts` の
 * `lint.overrides` にあり、`scripts/checks/integrity/lint-config.test.ts` が固定する。
 */

/** retry を持たない同期読み。DOM の確定前に評価されると、実装が正しくてもテストが落ちる */
const SYNC_READS = new Set(["element", "elements", "query", "all"]);

/**
 * コールバックを retry する呼び出し。その中の同期読みは毎回引き直されるので報告しない。
 * `element` を入れない。`expect.element(x.element())` は stale な要素を retry し続ける形で、
 * 本ルールが止めたい対象そのものになる
 */
const RETRYING_CALLBACK_CALLEES = new Set(["poll", "waitFor"]);

/**
 * 値をそのまま外へ渡す節点。判定はここを透かして見る。`?.` は `ChainExpression` が
 * 連鎖全体を包むので、入れないと optional chain を挟んだ同期読みが素通りする
 */
const WRAPPER_TYPES = new Set([
  "ParenthesizedExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "ChainExpression",
  "TSSatisfiesExpression",
  // 同期読みは Promise を返さないので、`await` は値をそのまま通す
  "AwaitExpression",
]);

/**
 * 同期読みの値が片側に来うる節点。`x.element().getAttribute(a) ?? ""` のように
 * 既定値を挟んでも、`` `${x.element().textContent}` `` や `!x.query()` のように演算やテンプレートに
 * 入れても、`[x.element()]` / `{ el: x.element() }` のようにリテラルへ包んでも、assert が見るのは
 * 同期読み由来の値である
 */
const PASSTHROUGH_TYPES = new Set([
  "LogicalExpression",
  "ConditionalExpression",
  "BinaryExpression",
  "UnaryExpression",
  "TemplateLiteral",
  "ArrayExpression",
  "ObjectExpression",
  "Property",
  "SpreadElement",
]);

type Node = ESTree.Node;

/** Program だけが親を持たない。走査はそこで止まる */
function parentOf(node: Node): Node | undefined {
  return node.type === "Program" ? undefined : node.parent;
}

function nameOf(node: Node): string | undefined {
  return node.type === "Identifier" ? node.name : undefined;
}

/** `a.b` の `b`。計算プロパティ (`a[b]`) は名前が静的に決まらないので拾わない */
function staticPropertyName(node: Node): string | undefined {
  if (node.type !== "MemberExpression" || node.computed) return undefined;
  return node.property.type === "PrivateIdentifier" ? undefined : nameOf(node.property);
}

/** 呼び出し名。`f(...)` の `f` と `a.f(...)` の `f` を同じに扱う */
function calleeName(call: ESTree.CallExpression): string | undefined {
  return nameOf(call.callee) ?? staticPropertyName(call.callee);
}

function isArgumentOf(call: ESTree.CallExpression, node: Node): boolean {
  return call.arguments.some((argument) => argument === node);
}

/**
 * その呼び出しが `expect(...)` から始まる assert か。
 * `expect(x)` 自身と、`expect(x).toBe(y)` のような matcher の呼び出しの両方を真にする。
 * どちらの引数も retry を持たない。
 */
function isAssertionCall(call: ESTree.CallExpression): boolean {
  for (let current: Node = call.callee; ;) {
    if (nameOf(current) === "expect") return true;
    if (current.type === "MemberExpression") {
      if (nameOf(current.object) === "expect") {
        // retry されるのは `expect.poll(cb)` に直に渡したコールバックだけ。matcher の引数
        // (`expect.poll(cb).toBe(x.element())`) は 1 度しか評価されない。
        // `expect.element(x)` が retry するのは locator を渡したときで、同期読みを渡すと
        // 最初に解決した要素を retry し続けるため、こちらは引数の位置を問わず assert 扱いする
        const method = staticPropertyName(current);
        // `current === call.callee` なら呼び出し自身の引数。違えば matcher の引数
        return !(method === "poll" && current === call.callee);
      }
      current = current.object;
      continue;
    }
    if (current.type === "CallExpression") {
      current = current.callee;
      continue;
    }
    return false;
  }
}

/** その式が retry を持つ口 (`expect.poll` / `vi.waitFor` 等) のコールバックの中にあるか */
function isInsideRetryingCallback(node: Node): boolean {
  for (let current = node; ;) {
    const parent = parentOf(current);
    if (!parent) return false;
    if (parent.type === "CallExpression" && isArgumentOf(parent, current)) {
      const method = calleeName(parent);
      if (method !== undefined && RETRYING_CALLBACK_CALLEES.has(method)) return true;
    }
    current = parent;
  }
}

/**
 * 同期読みの値がそのまま流れていく先を、流れが止まる節点まで登る。
 *
 * 包む節点・演算・プロパティ読み・メソッド呼び出し・assert 以外の関数の引数は、どれも
 * 同期読み由来の値を次へ渡す。`getComputedStyle(x.element())` の戻り値も、`Number(...)` の
 * 戻り値も、元の要素が retry されない点は変わらない。assert の引数に来た時点で止まる
 */
function valueFlowTop(node: Node): Node {
  for (let current = node; ;) {
    const parent = parentOf(current);
    if (!parent) return current;
    if (WRAPPER_TYPES.has(parent.type) || PASSTHROUGH_TYPES.has(parent.type)) {
      current = parent;
      continue;
    }
    if (parent.type === "MemberExpression" && parent.object === current) {
      current = parent;
      continue;
    }
    if (parent.type === "CallExpression") {
      if (parent.callee === current) {
        current = parent;
        continue;
      }
      if (isArgumentOf(parent, current) && !isAssertionCall(parent)) {
        current = parent;
        continue;
      }
    }
    return current;
  }
}

/**
 * その同期読みが変数へ束縛されているなら、その変数の read 参照を返す。
 *
 * 複数のルールがこの追跡に依拠している。ADR-0029 の「壊し方 (間接)」が固定しているのも
 * この追跡なので、数える対象の定義を 1 箇所に置く。束縛の右辺が `x.element().getAttribute(a)`
 * のような連鎖でも、その先頭の同期読みから辿れる
 */
function readReferencesOfBinding(node: Node, sourceCode: SourceCode): Node[] {
  const bound = valueFlowTop(node);
  const declarator = parentOf(bound);
  if (!declarator || declarator.type !== "VariableDeclarator" || declarator.init !== bound) {
    return [];
  }
  return sourceCode
    .getDeclaredVariables(declarator)
    .flatMap((variable) => variable.references)
    .filter((reference) => reference.isRead())
    .map((reference) => reference.identifier);
}

/** 同期読みの値を、使われる位置まで辿り、assert の引数 (主語でも matcher の期待値でも) に届くかを判定する */
function reachesAssertion(syncRead: Node): boolean {
  const top = valueFlowTop(syncRead);
  const parent = parentOf(top);
  return (
    parent !== undefined &&
    parent.type === "CallExpression" &&
    isArgumentOf(parent, top) &&
    isAssertionCall(parent)
  );
}

/**
 * 束縛した値が assert の主語 (`expect(v)` / `expect.element(v)`) に届くかを判定する。
 *
 * matcher の期待値 (`toBe(before)`) は含めない。束縛してから期待値に使う形は、操作の前に取った
 * 観測の基準値と操作の後の観測を比べる書き方で、ADR-0031 が認める「2 回の観測を比べる」に当たる。
 * 束縛せず直に matcher へ渡す形 (`toBe(x.element())`) は `reachesAssertion` が報告する
 */
function reachesAssertionSubject(reference: Node): boolean {
  const top = valueFlowTop(reference);
  const parent = parentOf(top);
  if (parent === undefined || parent.type !== "CallExpression" || !isArgumentOf(parent, top)) {
    return false;
  }
  const callee = parent.callee;
  if (nameOf(callee) === "expect") return true;
  return (
    callee.type === "MemberExpression" &&
    nameOf(callee.object) === "expect" &&
    staticPropertyName(callee) !== "poll"
  );
}

export const preferLocatorMethods = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "locator の同期読みを assert へ流さず、expect.element を通す (ADR-0029)",
    },
    messages: {
      syncRead:
        "locator の同期読みを expect() へ渡さない。expect.element を通す。matcher の無い実測は expect.poll のコールバックの中で読む。retry が無く、DOM の確定前に評価されると実装が正しくてもテストが落ちる (ADR-0029)",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        // 安い順に落とす。この visitor はテストの全呼び出し式で走る
        if (node.arguments.length > 0) return;
        const method = staticPropertyName(node.callee);
        if (method === undefined || !SYNC_READS.has(method)) return;

        if (isInsideRetryingCallback(node)) return;
        if (reachesAssertion(node)) {
          context.report({ node, messageId: "syncRead" });
          return;
        }

        // 変数へ束縛してから assert へ渡す形。束縛でなければ空配列が返る
        for (const reference of readReferencesOfBinding(node, context.sourceCode)) {
          if (isInsideRetryingCallback(reference)) continue;
          if (reachesAssertionSubject(reference)) {
            context.report({ node, messageId: "syncRead" });
            return;
          }
        }
      },
    };
  },
});

export const noFindElement = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "locator.findElement() を呼ばない。mount は expect.element で待つ (ADR-0030)",
    },
    messages: {
      findElement:
        "`locator.findElement()` を呼ばない。mount を待つなら `expect.element(locator).toBeInTheDocument()` を使う。この config は `actionTimeout` を置いており、`findElement()` は待ち時間が上限なしになる。要素が現れないとテストが `Test timed out` で落ち、locator の名前が出力から消える (ADR-0030)",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (staticPropertyName(node.callee) !== "findElement") return;
        context.report({ node, messageId: "findElement" });
      },
    };
  },
});

/**
 * 期待値が綴りで潰れる形か。式なら観測どうしの比較なので対象外にする。
 *
 * `toHaveStyle` は宣言名 (`color:`) を必ず字面で持ち、値に式を埋めても名前の綴り違いで素通りする
 * (`` `colr: ${token}` `` は解釈できない宣言になり `.not` が真になる) ので、形を問わず報告する。
 * 値の matcher では、式を含むテンプレートリテラル (`` `${before}px` ``) は観測を埋め込んだ比較なので外す
 */
function isLiteralArgument(call: ESTree.CallExpression): boolean {
  const [first] = call.arguments;
  if (first === undefined) return false;
  if (staticPropertyName(call.callee) === "toHaveStyle") return true;
  if (first.type === "TemplateLiteral") return first.expressions.length === 0;
  return first.type === "Literal" || first.type === "ObjectExpression";
}

/** 引数に渡した値がそのまま assert の主語になる呼び出し。`expect(x)` と `expect.poll(cb)` */
const ASSERT_SUBJECT_CALLEES = new Set(["expect", "soft", "poll"]);

/**
 * 算出値を数値へ変える呼び出し。ADR-0031 が肯定形の書き方として勧めているので、
 * 透かさないと「勧めた形を否定へ倒した退行」だけが無検査になる
 */
const VALUE_WRAPPER_CALLEES = new Set(["Number", "parseFloat", "parseInt"]);

/** `expect(...)` / `expect.element(...)` / `expect.poll(...)` のような assert の起点か */
function isExpectRoot(call: ESTree.CallExpression): boolean {
  if (nameOf(call.callee) === "expect") return true;
  return call.callee.type === "MemberExpression" && nameOf(call.callee.object) === "expect";
}

/**
 * `return` を囲むインラインのコールバック。`if` や `for` を挟んでいても辿り着く。
 *
 * 名前付きの関数宣言では `undefined` を返す。その戻り値が assert へ届くかは呼び出し側を
 * 辿らないと決まらず、1 ファイルの構文で判定するというこのルールの前提を越える
 */
function enclosingCallback(node: Node): Node | undefined {
  for (let current = node; ;) {
    const parent = parentOf(current);
    if (!parent) return undefined;
    if (parent.type === "FunctionDeclaration") return undefined;
    if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionExpression") {
      return parent;
    }
    current = parent;
  }
}

/**
 * 値が使われる位置まで親を辿り、`.not` を挟んだ matcher 呼び出しを返す。
 * 行き着かない形 (assert 以外へ渡す、否定でない、期待値が式) は空で返す。
 *
 * 下向きに部分木を走査しない。oxlint の node は `parent` を持つので、汎用の走査は木を
 * 登り直して無限再帰する。このファイルの他のルールと同じく親だけを辿る。
 *
 * @param followBinding 変数へ束縛してから使う形を追うか。追った先では `false` にする。
 *   `preferLocatorMethods` と同じ 1 ホップに留め、束縛の連鎖では再帰しない
 */
function findNegatedLiteralMatchers(
  start: Node,
  sourceCode: SourceCode,
  followBinding: boolean,
): ESTree.CallExpression[] {
  let negated = false;
  for (let current = start; ;) {
    const parent = parentOf(current);
    if (!parent) return [];

    if (WRAPPER_TYPES.has(parent.type)) {
      current = parent;
      continue;
    }

    // `.not` も `.toBe` も同じ形。名前が `not` のときだけ否定を覚える
    if (parent.type === "MemberExpression" && parent.object === current) {
      if (staticPropertyName(parent) === "not") negated = true;
      current = parent;
      continue;
    }

    // `cond ? a : b` / `a ?? b` の枝。値はそのまま外へ出る。
    // 三項の条件式は値にならないので、そこだけ透かさない
    if (
      PASSTHROUGH_TYPES.has(parent.type) &&
      !(parent.type === "ConditionalExpression" && parent.test === current)
    ) {
      current = parent;
      continue;
    }

    // `expect.poll(() => getComputedStyle(x).color)` の簡潔本体。`body` が式なのは arrow だけ
    if (parent.type === "ArrowFunctionExpression" && parent.body === current) {
      current = parent;
      continue;
    }

    // ブロック本体の `return`。文の入れ子を問わず、囲むコールバックまで飛ぶ
    if (parent.type === "ReturnStatement") {
      const callback = enclosingCallback(parent);
      if (!callback) return [];
      current = callback;
      continue;
    }

    if (parent.type === "CallExpression") {
      // `expect(x).not.toBe(y)` の `toBe(y)`。matcher の呼び出しが終点
      if (parent.callee === current) {
        return negated && isLiteralArgument(parent) ? [parent] : [];
      }
      const callee = calleeName(parent);
      if (
        isArgumentOf(parent, current) &&
        callee !== undefined &&
        (ASSERT_SUBJECT_CALLEES.has(callee) || VALUE_WRAPPER_CALLEES.has(callee))
      ) {
        current = parent;
        continue;
      }
      return [];
    }

    // 変数へ束縛してから assert へ渡す形
    if (followBinding && parent.type === "VariableDeclarator" && parent.init === current) {
      // 同じ束縛を 2 つの引数で読む形 (`expect(c.color, c.width)`) は同じ matcher へ届く。
      // 参照ごとに返すと同じ呼び出しを 2 回報告するので、ここで畳む
      const found = readReferencesOfBinding(current, sourceCode).flatMap((reference) =>
        findNegatedLiteralMatchers(reference, sourceCode, false),
      );
      return [...new Set(found)];
    }

    return [];
  }
}

export const noNegatedStyleLiteral = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "スタイルをリテラルとの否定で確かめない (ADR-0031)",
    },
    messages: {
      negatedStyleLiteral:
        "スタイルをリテラルとの否定で確かめない。`not.toHaveStyle` は宣言を解釈できないと素通りし、算出値との `not.toBe` は単位や綴りが 1 つ外れると潰れた状態でも通る。1 回の観測から数値を出すか、期待する値そのものと肯定で比べる (ADR-0031)",
    },
  },
  create(context) {
    function matchersFrom(start: Node): ESTree.CallExpression[] {
      return findNegatedLiteralMatchers(start, context.sourceCode, true);
    }
    function report(call: ESTree.CallExpression) {
      context.report({ node: call, messageId: "negatedStyleLiteral" });
    }
    return {
      CallExpression(node: ESTree.CallExpression) {
        // 起点は 2 つ。算出値を読む呼び出しと、要素を主語に置く assert の起点
        if (calleeName(node) === "getComputedStyle") {
          for (const matcher of matchersFrom(node)) {
            // `toHaveStyle` は要素を主語に取るので次の枝が拾う。二重報告にしない
            if (staticPropertyName(matcher.callee) !== "toHaveStyle") report(matcher);
          }
          return;
        }
        if (!isExpectRoot(node)) return;
        for (const matcher of matchersFrom(node)) {
          if (staticPropertyName(matcher.callee) === "toHaveStyle") report(matcher);
        }
      },
    };
  },
});

export const noBareAbsenceAssertion = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "不在の assert は expectAbsent / expectRemoved を通す (ADR-0031)",
    },
    messages: {
      bareAbsence:
        "`expect.element(...).not.toBeInTheDocument()` を直に書かない。最初から出ないなら `expectAbsent(locator)`、在る状態から消えるのを待つなら `expectRemoved(locator)` を使う (`src/test/absent.ts`)。同じ matcher なので、名前を付けないとどちらのつもりかが字面で読めない。`expectAbsent` は要素が無ければ 1 回目で通るので、同じ操作の効果を表す肯定 assert を先に置く。無いと何も検証していない (ADR-0031)",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (staticPropertyName(node.callee) !== "toBeInTheDocument") return;
        if (node.callee.type !== "MemberExpression") return;
        // `.not` を挟んだ形だけが対象。肯定形は待つ側なので素で書いてよい
        const negation = node.callee.object;
        if (staticPropertyName(negation) !== "not") return;
        if (negation.type !== "MemberExpression") return;
        // 主語が locator である証拠を `expect.element(...)` に求める。story の play が使う
        // `expect(screen.queryBy...)` は Testing Library の query で、locator ではない
        const subject = negation.object;
        if (subject.type !== "CallExpression") return;
        if (!isExpectRoot(subject) || calleeName(subject) !== "element") return;
        context.report({ node, messageId: "bareAbsence" });
      },
    };
  },
});

export default definePlugin({
  meta: { name: "browser-test" },
  rules: {
    "prefer-locator-methods": preferLocatorMethods,
    "no-find-element": noFindElement,
    "no-negated-style-literal": noNegatedStyleLiteral,
    "no-bare-absence-assertion": noBareAbsenceAssertion,
  },
});
