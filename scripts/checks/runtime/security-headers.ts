import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { findCspNonceViolations } from "../../lib/csp-nonce.ts";
import { REPO_ROOT } from "../../lib/repo-root.ts";
import { type ExpectedHeader, findHeaderViolations } from "../../lib/response-headers.ts";

/**
 * `vite.config.ts` の `nitro({ routeRules })` で付けたセキュリティヘッダが、実際の
 * レスポンスに乗っていることをビルド成果物で確かめる。root route の `headers` が付ける
 * CSP も、nonce が HTML の `<script>` に届き、応答ごとに変わることと併せて確かめる。
 *
 * 設定値の検査では代替できない。`.output/nitro.json` の `config` は空で routeRules を
 * 含まず、Cloudflare の preset へ移して `nitro()` ごと外す変更は設定にもビルドにも
 * エラーを出さないまま緑で通る。
 *
 * 整合検査 (`scripts/checks/integrity/`) に置かないのは、`vp build` の成果物が要るため。
 *
 * `/` に加えて、route の無い path の 404 も見る。h3 は 400 以上の応答に、用意した
 * ヘッダのうち `event.res.errHeaders` だけを合わせる (h3 docs「Sending Response」、h3 2.0.2)。routeRules の
 * `headers` がそこへ書かない版では、`/` に乗っても 404 と SSR の 500 には乗らない
 * (nitro 3.0.260610-beta で、2026-10-31 に実測)。500 を見ないのは、必ず失敗する route を
 * 検査のためだけにテンプレートへ置くことになるため。
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

/**
 * 期待する CSP。`src/routes/__root.tsx` の `headers` と対で持つ。`{nonce}` には応答ごとの nonce が入る。
 * 写しで持つ理由は `EXPECTED_HEADERS` と同じ
 */
const EXPECTED_CSP =
  "script-src 'nonce-{nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const SERVER_ENTRY = join(REPO_ROOT, ".output", "server", "index.mjs");
const HOST = "127.0.0.1";
const PORT = 39271;
const ORIGIN = `http://${HOST}:${PORT.toString()}`;
/** 検査する path と、その path が返すはずの status */
const CHECKED_RESPONSES = [
  { path: "/", status: 200 },
  { path: "/__security-headers-check-not-found", status: 404 },
] as const;
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

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 起動を待つ逐次ポーリング。並列化すると「起動したか」を観測する意味が消える
      await fetch(ORIGIN);
      return;
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

/**
 * `/` の CSP の nonce が HTML の `<script>` に届き、応答ごとに変わることを確かめる。
 * 2 回目の応答は、1 回目と比べるためだけに取る
 */
async function checkCspNonce(): Promise<void> {
  // 上の検査と同じく redirect を追わず、200 の応答だけを比べる
  const responses = [
    await fetch(ORIGIN, { redirect: "manual" }),
    await fetch(ORIGIN, { redirect: "manual" }),
  ];
  for (const response of responses) {
    if (response.status !== 200) {
      throw new CheckFailure(
        `CSP を比べる ${ORIGIN} の status が ${response.status.toString()} で、200 ではない`,
      );
    }
  }
  const samples = await Promise.all(
    responses.map(async (response) => ({
      policy: response.headers.get("Content-Security-Policy"),
      html: await response.text(),
    })),
  );
  const violations = findCspNonceViolations(samples, EXPECTED_CSP);
  if (violations.length > 0) {
    throw new CheckFailure(
      [
        "CSP の nonce が HTML の応答に届いていない。",
        "src/router.tsx の ssr と src/routes/__root.tsx の headers を見る。",
        ...violations.map((violation) => `  - ${violation}`),
      ].join("\n"),
    );
  }
  console.log(
    `[security-headers] CSP の nonce が ${ORIGIN} の HTML の <script> に届き、応答ごとに変わっている`,
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
    await waitForServer();
    const violations: string[] = [];
    for (const { path, status } of CHECKED_RESPONSES) {
      // redirect を追うと、移り先の応答を検査してしまう
      // oxlint-disable-next-line eslint/no-await-in-loop -- 1 つのサーバへ数件を順に聞くだけで、並列にしても得るものが無い
      const response = await fetch(`${ORIGIN}${path}`, { redirect: "manual" });
      if (response.status !== status) {
        // 期待と違う status の応答を検査しても、その path の経路を確かめたことにならない
        throw new CheckFailure(
          `${path} の status が ${response.status.toString()} で、${status.toString()} ではない。検査する path を見直す`,
        );
      }
      violations.push(
        ...findHeaderViolations(
          Object.fromEntries(response.headers.entries()),
          EXPECTED_HEADERS,
        ).map((violation) => `${path} (${status.toString()}) ${violation}`),
      );
    }
    if (violations.length > 0) {
      throw new CheckFailure(
        [
          "セキュリティヘッダが実レスポンスに乗っていない。",
          "vite.config.ts の nitro({ routeRules }) と、preset を差し替えていないかを見る。",
          ...violations.map((violation) => `  - ${violation}`),
        ].join("\n"),
      );
    }
    await checkCspNonce();
  } finally {
    server.kill();
  }

  console.log(
    `[security-headers] ${EXPECTED_HEADERS.length.toString()} 件すべてが ${CHECKED_RESPONSES.map(({ path, status }) => `${path} (${status.toString()})`).join("、")} の応答に乗っている`,
  );
}

try {
  await run();
} catch (error) {
  // CheckFailure 以外 (spawn 失敗や想定外の例外) も同じ経路で落とす。握りつぶさない
  console.error(`[security-headers] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
