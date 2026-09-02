import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../../lib/repo-root.ts";
import { type ExpectedHeader, findHeaderViolations } from "../../lib/response-headers.ts";

/**
 * `vite.config.ts` の `nitro({ routeRules })` で付けたセキュリティヘッダが、実際の
 * レスポンスに乗っていることをビルド成果物で確かめる。
 *
 * 設定値の検査では代替できない。`.output/nitro.json` の `config` は空で routeRules を
 * 含まず、Cloudflare の preset へ移して `nitro()` ごと外す変更は設定にもビルドにも
 * エラーを出さないまま緑で通る。
 *
 * 整合検査 (`scripts/checks/integrity/`) に置かないのは、`vp build` の成果物が要るため。
 * vitest の project は build との順序を持てないので、`mise run verify` と CI の
 * `vp build` の直後に独立した step として置く。
 */

/**
 * 期待するヘッダ。`vite.config.ts` の `routeRules` と対で持つ。
 *
 * 定数を共有していないのは、production の設定を `scripts/` から import させると依存の
 * 向きが逆になるため。写しである代わりに、値を変えると本検査が落ちて両方を見ることになる。
 */
const EXPECTED_HEADERS: readonly ExpectedHeader[] = [
  { name: "X-Content-Type-Options", value: "nosniff" },
  { name: "X-Frame-Options", value: "DENY" },
  { name: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { name: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { name: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { name: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const SERVER_ENTRY = join(REPO_ROOT, ".output", "server", "index.mjs");
const HOST = "127.0.0.1";
const PORT = 39271;
const ORIGIN = `http://${HOST}:${PORT.toString()}`;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

/** 検査の失敗。プロセスの終了はサーバを止めたあとで行う */
class CheckFailure extends Error {}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 起動前に、その origin で既に何かが応答していないことを確かめる。
 *
 * 応答するものが居ると、こちらの起動が失敗していてもそれが答えてしまい、古いビルドを
 * 検査した結果が緑になる。socket の bind で見ないのは、IPv6 の wildcard で listen して
 * いるプロセスがあっても IPv4 の特定アドレスへの bind は EADDRINUSE にならないため
 * (macOS で実測、2026-09-02)。応答の有無で見れば address family に依存しない。
 */
async function assertOriginIsFree(): Promise<void> {
  try {
    await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
  } catch {
    return;
  }
  throw new CheckFailure(
    `${ORIGIN} で既に何かが応答している。前回の残骸だと古いビルドを検査してしまうため止める`,
  );
}

async function waitForServer(): Promise<Response> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 起動を待つ逐次ポーリング。並列化すると「起動したか」を観測する意味が消える
      return await fetch(ORIGIN);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // oxlint-disable-next-line eslint/no-await-in-loop -- 同上。次の試行まで待つのが目的
      await delay(POLL_INTERVAL_MS);
    }
  }
  throw new CheckFailure(
    `${ORIGIN} が ${(STARTUP_TIMEOUT_MS / 1000).toString()} 秒以内に応答しない: ${lastError}`,
  );
}

async function run(): Promise<void> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new CheckFailure(`${SERVER_ENTRY} が無い。先に vp build を実行する`);
  }
  await assertOriginIsFree();

  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: PORT.toString() },
    stdio: "ignore",
  });

  try {
    const response = await waitForServer();
    const violations = findHeaderViolations(
      Object.fromEntries(response.headers.entries()),
      EXPECTED_HEADERS,
    );
    if (violations.length > 0) {
      throw new CheckFailure(
        [
          "セキュリティヘッダが実レスポンスに乗っていない。",
          "vite.config.ts の nitro({ routeRules }) と、preset を差し替えていないかを見る。",
          ...violations.map((violation) => `  - ${violation}`),
        ].join("\n"),
      );
    }
  } finally {
    server.kill();
  }

  console.log(
    `[security-headers] ${EXPECTED_HEADERS.length.toString()} 件すべてが ${ORIGIN} の応答に乗っている`,
  );
}

try {
  await run();
} catch (error) {
  // CheckFailure 以外 (spawn 失敗や想定外の例外) も同じ経路で落とす。握りつぶさない
  console.error(`[security-headers] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
