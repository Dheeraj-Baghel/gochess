import { readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Ship the real, single-threaded NNUE engine. No SharedArrayBuffer or third-party CDN.
// Its versioned filenames allow immutable caching without stale-engine upgrades.
const root = path.resolve("node_modules/stockfish");
const out = path.resolve("public/engine");
await mkdir(out, { recursive: true });
const candidates = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory() && !["node_modules", ".git"].includes(item.name)) await walk(file);
    else if (item.isFile() && /lite-single.*\.(js|wasm)$/.test(item.name)) candidates.push(file);
  }
}
await walk(root);
const js = candidates.find(f => f.endsWith(".js"));
if (!js || !candidates.some(f => f.endsWith(".wasm"))) throw new Error("Stockfish lite-single distribution missing");
for (const file of candidates) await copyFile(file, path.join(out, path.basename(file)));
await copyFile(path.join(root, "Copying.txt"), path.join(out, "LICENSE.txt"));
await writeFile(path.join(out, "manifest.json"), JSON.stringify({ worker: `/engine/${path.basename(js)}`, license: "/engine/LICENSE.txt" }));
console.log(`Stockfish engine installed: ${path.basename(js)}`);