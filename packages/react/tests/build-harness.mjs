// AUTHORED. Builds the Button test harness with Vite (programmatic API) into a temp directory and serves it on an
// ephemeral 127.0.0.1 port. Nothing is written into the repository.
import { build } from "vite";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export async function buildHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-react-harness-"));
  await build({ root: join(HERE, "harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

export function serve(dir) {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
  const server = createServer((req, res) => {
    let rel = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "") || "index.html";
    const type = types[extname(rel)];
    if (!type || rel.startsWith("..")) return res.writeHead(404).end();
    try { res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(readFileSync(join(dir, rel))); } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}/index.html`, close: () => server.close() })));
}
