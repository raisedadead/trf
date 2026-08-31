import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "src/scripts/**/*.test.ts"],
          css: false,
        },
      },
      {
        test: {
          name: "lib",
          environment: "node",
          include: ["src/lib/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "worker",
          environment: "node",
          include: ["src/worker/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "migrations",
          environment: "node",
          include: ["tests/migrations/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "deploy",
          environment: "node",
          include: ["tests/deploy/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "site",
          environment: "node",
          include: ["tests/site/**/*.test.ts"],
          globalSetup: ["./tests/site/build.setup.ts"],
        },
      },
    ],
  },
});
