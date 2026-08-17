import { readFileSync, readdirSync } from "node:fs";

export const read = (file: string): string => readFileSync(`dist/${file}`, "utf8");

export const PAGES: readonly string[] = readdirSync("dist").filter((f) => f.endsWith(".html"));
