import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { serverErrorAdapter } from "@/lib/server-error-exposure";

import { startInstance } from "./start";

describe("startInstance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("production では Error を差し替える adapter を登録する", async () => {
    vi.stubEnv("DEV", false);
    const options = await startInstance.getOptions();
    expect(options.serializationAdapters).toEqual([serverErrorAdapter]);
  });

  // DEV では組み込みの直列化が message を運び、画面に例外の文言を出せる
  it("DEV では adapter を登録しない", async () => {
    vi.stubEnv("DEV", true);
    const options = await startInstance.getOptions();
    expect(options.serializationAdapters).toEqual([]);
  });
});
