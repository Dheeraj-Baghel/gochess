import { mkdirSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// GPL corresponding app source is downloadable alongside the engine. This is an
// explicit allowlist, never a recursive archive of the workspace or environment.
mkdirSync("public/source", { recursive: true });
if (!existsSync("LICENSE")) copyFileSync("node_modules/stockfish/Copying.txt", "LICENSE");
const files = ["src", "scripts", "tests", "e2e", ".github", "public/favicon.svg", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "vercel.json", "vitest.config.ts", "playwright.config.ts", ".env.example", ".gitignore", ".vercelignore", "README.md", "DEPLOYMENT.md", "LICENSE"].filter(existsSync);
execFileSync("tar", ["-czf", "public/source/knightfall-source.tar.gz", ...files], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
console.log("Packaged public source (no credentials, databases, or machine-specific files).");