import path from "node:path";

const { spawn } = await import("node:child_process");

const baseDir = path.resolve(path.dirname(import.meta.filename), "..");

const args = process.argv.slice(2);
const tsxBin = path.resolve(baseDir, "node_modules/.bin/tsx");

const isWatch = process.env.ZUDOKU_INTERNAL_CLI === "watch";

// eslint-disable-next-line no-console
console.log(
  `>> Running \`tsx${isWatch ? " watch" : ""} src/cli/cli.ts\` for development...`,
);

const tsxProcess = spawn(
  tsxBin,
  [
    ...(isWatch
      ? ["watch", "--ignore", `./zudoku.config.*.mjs`, "--clear-screen=false"]
      : []),
    path.join(baseDir, "src/cli/cli.ts"),
    ...args,
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);

tsxProcess.on("close", (code) => {
  process.exit(code);
});