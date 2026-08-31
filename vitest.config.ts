import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "lib",
          include: ["src/lib/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "worker",
          include: ["src/worker/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "migrations",
          include: ["tests/migrations/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "deploy",
          include: ["tests/deploy/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "site",
          include: ["tests/site/**/*.test.ts"],
          globalSetup: ["./tests/site/build.setup.ts"],
        },
      },
    ],
  },
});
