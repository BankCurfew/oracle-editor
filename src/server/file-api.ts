/**
 * File API — REST CRUD for workspace files
 *
 * GET  /api/files?path=   List directory
 * GET  /api/file?path=    Read file
 * POST /api/file          Write file { path, content }
 * DELETE /api/file?path=  Delete file
 * POST /api/mkdir         Create directory { path }
 */
import { Hono } from "hono";
import { readdir, readFile, writeFile, unlink, mkdir, stat } from "node:fs/promises";
import { join, resolve, relative, extname } from "node:path";

export function createFileApi(workspaceRoot: string) {
  const api = new Hono();

  /** Resolve and validate path is within workspace */
  function safePath(requestedPath: string): string | null {
    const resolved = resolve(workspaceRoot, requestedPath);
    if (!resolved.startsWith(resolve(workspaceRoot))) return null; // path traversal
    return resolved;
  }

  /** Detect MIME type from extension */
  function mimeType(filepath: string): string {
    const ext = extname(filepath).toLowerCase();
    const types: Record<string, string> = {
      ".html": "text/html", ".htm": "text/html",
      ".css": "text/css", ".js": "text/javascript",
      ".ts": "text/typescript", ".json": "application/json",
      ".md": "text/markdown", ".txt": "text/plain",
      ".svg": "image/svg+xml", ".png": "image/png",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".gif": "image/gif", ".webp": "image/webp",
    };
    return types[ext] || "application/octet-stream";
  }

  // GET /api/files — list directory
  api.get("/files", async (c) => {
    const reqPath = c.req.query("path") || ".";
    const dirPath = safePath(reqPath);
    if (!dirPath) return c.json({ error: "invalid path" }, 400);

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const files = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith("."))
          .map(async (e) => {
            const fullPath = join(dirPath, e.name);
            const relPath = relative(workspaceRoot, fullPath);
            try {
              const s = await stat(fullPath);
              return {
                name: e.name,
                path: relPath,
                isDirectory: e.isDirectory(),
                size: s.size,
                modified: s.mtime.toISOString(),
              };
            } catch {
              return {
                name: e.name,
                path: relPath,
                isDirectory: e.isDirectory(),
                size: 0,
                modified: null,
              };
            }
          })
      );
      return c.json({ path: reqPath, files });
    } catch (e: any) {
      return c.json({ error: e.message }, 404);
    }
  });

  // GET /api/file — read file
  api.get("/file", async (c) => {
    const reqPath = c.req.query("path");
    if (!reqPath) return c.json({ error: "path required" }, 400);
    const filePath = safePath(reqPath);
    if (!filePath) return c.json({ error: "invalid path" }, 400);

    try {
      const content = await readFile(filePath, "utf-8");
      const s = await stat(filePath);
      return c.json({
        path: reqPath,
        content,
        size: s.size,
        modified: s.mtime.toISOString(),
        mimeType: mimeType(filePath),
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 404);
    }
  });

  // POST /api/file — write file
  api.post("/file", async (c) => {
    const body = await c.req.json<{ path: string; content: string }>();
    if (!body.path || body.content === undefined) {
      return c.json({ error: "path and content required" }, 400);
    }
    const filePath = safePath(body.path);
    if (!filePath) return c.json({ error: "invalid path" }, 400);

    try {
      // Ensure parent directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(filePath, body.content, "utf-8");
      const s = await stat(filePath);
      return c.json({ ok: true, path: body.path, size: s.size });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // DELETE /api/file — delete file
  api.delete("/file", async (c) => {
    const reqPath = c.req.query("path");
    if (!reqPath) return c.json({ error: "path required" }, 400);
    const filePath = safePath(reqPath);
    if (!filePath) return c.json({ error: "invalid path" }, 400);

    try {
      await unlink(filePath);
      return c.json({ ok: true, path: reqPath });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // POST /api/mkdir — create directory
  api.post("/mkdir", async (c) => {
    const body = await c.req.json<{ path: string }>();
    if (!body.path) return c.json({ error: "path required" }, 400);
    const dirPath = safePath(body.path);
    if (!dirPath) return c.json({ error: "invalid path" }, 400);

    try {
      await mkdir(dirPath, { recursive: true });
      return c.json({ ok: true, path: body.path });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  return api;
}
