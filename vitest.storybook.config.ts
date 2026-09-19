import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

export default defineProject({
  // vite.config.ts と同じく .env を読まない (ADR-0002)
  envDir: false,
  plugins: [viteReact(), tailwindcss(), storybookTest({ configDir: ".storybook" })],
  resolve: {
    tsconfigPaths: true,
    // registry combobox の @base-ui/react barrel import が React を二重解決するのを防ぐ
    dedupe: ["react", "react-dom"],
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
