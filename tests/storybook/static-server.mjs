// AUTHORED. Minimal read-only static server for a Storybook static build (ephemeral 127.0.0.1 port).
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".map": "application/json", ".txt": "text/plain; charset=utf-8",
};

export function serveStatic(dir) {
  const server = createServer((req, res) => {
    let rel = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "");
    if (!rel || rel.endsWith("/")) rel += "index.html";
    if (rel.startsWith("..")) return res.writeHead(403).end();
    const file = join(dir, rel);
    try {
      if (!statSync(file).isFile()) throw new Error();
      res.writeHead(200, { "content-type": TYPES[extname(rel)] || "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
