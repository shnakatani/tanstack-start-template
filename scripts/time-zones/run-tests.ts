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
 * UTC より進んだ側と遅れた側、日付変更線の際を並べる (ADR-0031 の Context)。
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

type TimeZone = (typeof TIME_ZONES)[number];

const VP_ARGS = ["test", "run", "--project", "unit", ".tz.test.ts"];

type Run = {
  timeZone: TimeZone;
  status: number | null;
  signal: NodeJS.Signals | null;
  output: string;
};

/**
 * 1 つの TZ を走らせ、出力をためて返す。並列に走らせるので、出力を流すと TZ の間で行が混ざる。
 * stdout と stderr は届いた順にためるので、2 つの間の前後は保たない。
 * 各プロセスの worker は 1 本にする。絞らないとプロセスの数と掛け算で増える
 * (`docs/guides/testing/time-zones.md`「TZ ごとの実行を並列にする理由」)。
 * 起動に失敗しても reject せず、失敗した TZ として返す。reject すると、走っている他の TZ の子を
 * 残したまま親だけが終わる。起動の失敗は error イベントで届くものと、spawn が同期に投げるもの
 * (ENOEXEC など) があるので、両方を受ける
 */
function runTimeZone(timeZone: TimeZone): Promise<Run> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const fail = (error: Error) => {
      chunks.push(Buffer.from(`${error.stack ?? String(error)}\n`));
    };
    try {
      const child = spawn("vp", VP_ARGS, {
        cwd: REPO_ROOT,
        env: { ...process.env, TEST_TIME_ZONE: timeZone, VITEST_MAX_WORKERS: "1" },
      });
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.on("error", fail);
      child.on("close", (status, signal) => {
        resolve({ timeZone, status, signal, output: Buffer.concat(chunks).toString() });
      });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      resolve({ timeZone, status: null, signal: null, output: Buffer.concat(chunks).toString() });
    }
  });
}

// 1 つの TZ で落ちても残りを走らせる。どの TZ で落ちたかの組み合わせ (進んだ側だけ、など) が原因の手がかりになる
const queue: TimeZone[] = [...TIME_ZONES];
const failed: Run[] = [];
await Promise.all(
  Array.from({ length: Math.min(availableParallelism(), queue.length) }, async () => {
    for (let timeZone = queue.shift(); timeZone; timeZone = queue.shift()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 並列の数を抑えるための逐次。この列が終わってから次の TZ を取る
      const run = await runTimeZone(timeZone);
      if (run.status === 0) {
        console.log(`[time-zones] OK   TEST_TIME_ZONE=${timeZone}`);
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

if (failed.length > 0) {
  // 終わった順ではなく TIME_ZONES の順に並べ、実行ごとにログの並びが変わらないようにする
  failed.sort((a, b) => TIME_ZONES.indexOf(a.timeZone) - TIME_ZONES.indexOf(b.timeZone));
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
