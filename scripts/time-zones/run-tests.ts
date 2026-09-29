import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";

import { REPO_ROOT } from "../lib/repo-root.ts";

/**
 * `*.tz.test.ts` を TZ ごとに別のプロセスで走らせる。基準の TZ (`vitest.global-setup.ts`) では
 * `vp test run` が走らせるので、ここでは残りを走らせる。
 *
 * テストの中で `TZ` を変えても、threads と vmThreads の pool では `Date` に効かない。
 * プロセスごとに決めれば pool を問わず効く (`docs/guides/testing/time-zones.md`「TZ ごとにプロセスを分ける理由」)。
 *
 * 暦の日付は、`toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、UTC より進んだ TZ か
 * 遅れた TZ のどちらかで 1 日ずれる (ADR-0031 の Context)。両側と日付変更線の際を並べる。
 */
const TIME_ZONES = [
  "UTC",
  // UTC+9
  "Asia/Tokyo",
  // UTC+5:30。時単位でないオフセット
  "Asia/Kolkata",
  // UTC+14。進んだ側の端
  "Pacific/Kiritimati",
  // UTC-11。遅れた側の端
  "Pacific/Pago_Pago",
] as const;

const VP_ARGS = ["test", "run", "--project", "unit", ".tz.test.ts"];

type Run = {
  timeZone: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  output: string;
};

// 止めるときに、走っている子へ SIGTERM を送る (spawn の signal と killSignal の既定)
const abort = new AbortController();

/**
 * 1 つの TZ を走らせ、出力をためて返す。並列に走らせるので、出力を流すと TZ の間で行が混ざる。
 * stdout と stderr は届いた順にためるので、2 つの間の前後は保たない。
 * 各プロセスの worker は 1 本にする。絞らないとプロセスの数と掛け算で増える
 * (`docs/guides/testing/time-zones.md`「TZ ごとの実行を並列にする理由」)。
 * 起動に失敗しても reject せず、失敗した TZ として返す。reject すると、走っている他の TZ の子を
 * 残したまま親だけが終わる
 */
function runTimeZone(timeZone: string): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn("vp", VP_ARGS, {
      cwd: REPO_ROOT,
      env: { ...process.env, TEST_TIME_ZONE: timeZone, VITEST_MAX_WORKERS: "1" },
      signal: abort.signal,
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", (error) => {
      chunks.push(Buffer.from(`${error.stack ?? String(error)}\n`));
    });
    child.on("close", (status, signal) => {
      resolve({ timeZone, status, signal, output: Buffer.concat(chunks).toString() });
    });
  });
}

// 親だけに届いた signal (kill <pid> など) では子が残る。子を止め、全部の終わりを待ってから失敗で終える。
// 端末の Ctrl-C はプロセスグループ全体に届くので、子には SIGINT と SIGTERM が届くが、終わり方は変わらない
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    abort.abort();
  });
}

// 1 つの TZ で落ちても残りを走らせる。どの TZ で落ちたかの組み合わせ (進んだ側だけ、など) が原因の手がかりになる
const queue: string[] = [...TIME_ZONES];
const failed: Run[] = [];
await Promise.all(
  Array.from({ length: Math.min(availableParallelism(), queue.length) }, async () => {
    for (
      let timeZone = queue.shift();
      timeZone && !abort.signal.aborted;
      timeZone = queue.shift()
    ) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 並列の数を抑えるための逐次。この列が終わってから次の TZ を取る
      const run = await runTimeZone(timeZone);
      if (run.status === 0) {
        // 全部通ったときも件数を残す。0 件で通っていても気づける
        const summary = /^\s*Tests\s+.*$/m.exec(run.output)?.[0].trim() ?? "";
        console.log(`[time-zones] OK   TEST_TIME_ZONE=${timeZone}  ${summary}`);
      } else {
        console.error(`[time-zones] FAIL TEST_TIME_ZONE=${timeZone}`, {
          status: run.status,
          signal: run.signal,
        });
        failed.push(run);
      }
    }
  }),
);

if (abort.signal.aborted) {
  const skipped = queue.length > 0 ? `。走らせていない TZ: ${queue.join(", ")}` : "";
  console.error(`\n[time-zones] signal を受けて止めた${skipped}`);
  process.exitCode = 1;
}

if (failed.length > 0) {
  for (const run of failed) {
    console.error(`\n[time-zones] TEST_TIME_ZONE=${run.timeZone} の出力:\n${run.output}`);
  }
  console.error(`\n[time-zones] ${failed.length} 個の TZ で失敗した。1 つずつ走らせ直すには:`);
  for (const run of failed) {
    console.error(`  TEST_TIME_ZONE=${run.timeZone} vp ${VP_ARGS.join(" ")}`);
  }
  // `process.exit` は使わない。stderr が pipe のとき書き込みは非同期で、exit が待たずに落とすと
  // 上の再現コマンドが切れる。終了コードだけ立てて自然に終わらせる
  process.exitCode = 1;
}
