import { describe, expect, it, vi } from "vite-plus/test";

import { serverErrorAdapter } from "@/lib/server-error-exposure";

import { startInstance } from "./start";

describe("startInstance", () => {
  // adapter の並びを DEV と production で揃え、文言を運ぶかは adapter の中で決める (ADR-0038)
  it.each([true, false])("DEV が %s でも、Error を差し替える adapter を登録する", async (dev) => {
    vi.stubEnv("DEV", dev);
    const options = await startInstance.getOptions();
    expect(options.serializationAdapters).toEqual([serverErrorAdapter]);
  });
});
