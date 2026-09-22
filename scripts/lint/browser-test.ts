import { definePlugin, defineRule, type ESTree } from "vite-plus/lint/plugins";

/**
 * ブラウザテストの assert に locator を渡させる oxlint の JS plugin (ADR-0029)。
 *
 * `vite.config.ts` の `lint.jsPlugins` から読まれ、`vp lint` / `vp check` で走る。
 * 対象の限定は同 config の `lint.overrides` が持つ。
 */

/** retry を持たない同期読み。DOM の確定前に評価されると、実装が正しくてもテストが落ちる */
const SYNC_READS = new Set(["element", "elements", "query", "all"]);

/**
 * 同期読みの戻り値に続けて読んでよいもの。locator に対応する matcher が無い実測に限る。
 * 足す前に、その主張が matcher で書けないことを確かめる (ADR-0029)
 */
const ESCAPE_HATCH_MEMBERS = new Set([
  "getBoundingClientRect",
  "matches",
  "closest",
  "parentElement",
  "querySelector",
  "querySelectorAll",
]);

/** 同期読みを引数として受け取ってよい関数。同上 */
const ESCAPE_HATCH_CALLEES = new Set(["getComputedStyle"]);

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
]);

/**
 * 同期読みの値が片側に来うる節点。`x.element().getAttribute(a) ?? ""` のように
 * 既定値を挟んでも、assert が見るのは同期読み由来の値である
 */
const PASSTHROUGH_TYPES = new Set(["LogicalExpression", "ConditionalExpression"]);

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

/** 包むだけの節点を外へ辿り、値が実際に使われる位置まで上がる */
function unwrap(node: Node): Node {
  let current = node;
  for (;;) {
    const parent = parentOf(current);
    if (!parent || !WRAPPER_TYPES.has(parent.type)) return current;
    current = parent;
  }
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
  // 1 周目の callee だけが「その呼び出し自身」。2 周目以降は matcher の呼び出し
  let isDirectCallee = true;
  for (let current: Node = call.callee; ; isDirectCallee = false) {
    if (nameOf(current) === "expect") return true;
    if (current.type === "MemberExpression") {
      if (nameOf(current.object) === "expect") {
        // retry されるのは `expect.poll(cb)` に直に渡したコールバックだけ。matcher の引数
        // (`expect.poll(cb).toBe(x.element())`) は 1 度しか評価されない。
        // `expect.element(x)` が retry するのは locator を渡したときで、同期読みを渡すと
        // 最初に解決した要素を retry し続けるため、こちらは引数の位置を問わず assert 扱いする
        const method = staticPropertyName(current);
        return !(method === "poll" && isDirectCallee);
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

type Verdict = "report" | "allowed" | "unknown";

/** 同期読みの値を、使われる位置まで辿って判定する */
function classifyUse(syncRead: Node): Verdict {
  for (let current = syncRead; ;) {
    const parent = parentOf(current);
    if (!parent) return "unknown";

    // 包むだけの節点は値を変えない。透かして次の親を見る
    if (WRAPPER_TYPES.has(parent.type) || PASSTHROUGH_TYPES.has(parent.type)) {
      current = parent;
      continue;
    }

    if (parent.type === "MemberExpression" && parent.object === current) {
      const member = staticPropertyName(parent);
      if (member !== undefined && ESCAPE_HATCH_MEMBERS.has(member)) return "allowed";
      // `.getAttribute` / `.textContent` のように matcher で書ける読み。値の行き先を追う
      current = parent;
      continue;
    }

    if (parent.type === "CallExpression") {
      if (parent.callee === current) {
        current = parent;
        continue;
      }
      if (isArgumentOf(parent, current)) {
        const name = calleeName(parent);
        if (name !== undefined && ESCAPE_HATCH_CALLEES.has(name)) return "allowed";
        return isAssertionCall(parent) ? "report" : "unknown";
      }
    }

    return "unknown";
  }
}

export const preferLocatorMethods = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "locator の同期読みを assert へ流さず、expect.element を通す (ADR-0029)",
    },
    messages: {
      syncRead:
        "locator の同期読みを expect() へ渡さない。expect.element を通す。retry が無く、DOM の確定前に評価されると実装が正しくてもテストが落ちる (ADR-0029)",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        // 安い順に落とす。この visitor はテストの全呼び出し式で走る
        if (node.arguments.length > 0) return;
        const method = staticPropertyName(node.callee);
        if (method === undefined || !SYNC_READS.has(method)) return;

        // classifyUse は連鎖が切れた時点で返る。根まで登る判定より先に回す
        const verdict = classifyUse(node);
        if (verdict === "allowed") return;
        if (verdict === "report") {
          if (!isInsideRetryingCallback(node)) context.report({ node, messageId: "syncRead" });
          return;
        }
        if (isInsideRetryingCallback(node)) return;

        // 変数へ束縛してから assert へ渡す形。宣言が導入した変数の参照を辿る
        const bound = unwrap(node);
        const declarator = parentOf(bound);
        if (!declarator || declarator.type !== "VariableDeclarator" || declarator.init !== bound) {
          return;
        }
        for (const variable of context.sourceCode.getDeclaredVariables(declarator)) {
          for (const reference of variable.references) {
            if (!reference.isRead()) continue;
            if (isInsideRetryingCallback(reference.identifier)) continue;
            if (classifyUse(reference.identifier) === "report") {
              context.report({ node, messageId: "syncRead" });
              return;
            }
          }
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "browser-test" },
  rules: { "prefer-locator-methods": preferLocatorMethods },
});
