/**
 * Oracle Editor — Backend Server
 *
 * Hono HTTP server + Bun WebSocket for:
 * - File API (REST CRUD)
 * - File watcher (WebSocket push on change)
 * - PTY streaming (attach to tmux session via WebSocket)
 *
 * Port: 3500 (EDITOR_PORT env override)
 * Workspace: EDITOR_WORKSPACE env or cwd
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createFileApi } from "./file-api";
import { startFileWatcher, addFileViewer, removeFileViewer } from "./file-watcher";
import { handlePtyMessage, handlePtyClose } from "./pty";

const PORT = Number(process.env.EDITOR_PORT || 3500);
const WORKSPACE = process.env.EDITOR_WORKSPACE || process.cwd();

const app = new Hono();

// CORS — allow frontend dev server
app.use("/*", cors({ origin: "*" }));

// Health check
app.get("/health", (c) =>
  c.json({ ok: true, workspace: WORKSPACE, uptime: process.uptime() })
);

// File API — /api/files, /api/file, /api/mkdir
app.route("/api", createFileApi(WORKSPACE));

// List available tmux sessions for Oracle selector
app.get("/api/sessions", async (c) => {
  try {
    const proc = Bun.spawn(["tmux", "list-sessions", "-F", "#{session_name}\t#{session_windows}\t#{session_attached}"], {
      stdout: "pipe", stderr: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    const sessions = text.trim().split("\n").filter(Boolean).map((line) => {
      const [name, windows, attached] = line.split("\t");
      return { name, windows: Number(windows), attached: Number(attached) > 0 };
    });
    return c.json({ sessions });
  } catch {
    return c.json({ sessions: [], error: "tmux not available" });
  }
});

// Raw file serving — for iframe preview (serves actual file content with correct MIME)
app.get("/api/file/raw", async (c) => {
  const reqPath = c.req.query("path");
  if (!reqPath) return c.text("path required", 400);
  const { resolve, extname } = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const resolved = resolve(WORKSPACE, reqPath);
  if (!resolved.startsWith(resolve(WORKSPACE))) return c.text("invalid path", 400);
  try {
    const content = await readFile(resolved);
    const ext = extname(resolved).toLowerCase();
    const mimes: Record<string, string> = {
      ".html": "text/html", ".htm": "text/html", ".css": "text/css",
      ".js": "text/javascript", ".json": "application/json",
      ".svg": "image/svg+xml", ".png": "image/png",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".gif": "image/gif", ".webp": "image/webp",
    };
    return new Response(content, {
      headers: { "Content-Type": mimes[ext] || "application/octet-stream" },
    });
  } catch {
    return c.text("not found", 404);
  }
});

// Start file watcher
startFileWatcher(WORKSPACE);

// WebSocket upgrade handler for Bun.serve
type WsData = { type: "pty" | "files" };

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade — PTY
    if (url.pathname === "/ws/pty") {
      const ok = server.upgrade(req, { data: { type: "pty" } as WsData });
      return ok ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    // WebSocket upgrade — file watcher
    if (url.pathname === "/ws/files") {
      const ok = server.upgrade(req, { data: { type: "files" } as WsData });
      return ok ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Regular HTTP — delegate to Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      const data = ws.data as WsData;
      if (data.type === "files") {
        addFileViewer(ws);
      }
    },
    message(ws, msg) {
      const data = ws.data as WsData;
      if (data.type === "pty") {
        handlePtyMessage(ws, msg);
      }
      // files WebSocket is server-push only, no client messages needed
    },
    close(ws) {
      const data = ws.data as WsData;
      if (data.type === "pty") {
        handlePtyClose(ws);
      } else if (data.type === "files") {
        removeFileViewer(ws);
      }
    },
  },
});

console.log(`🔧 Oracle Editor server on http://localhost:${server.port}`);
console.log(`   workspace: ${WORKSPACE}`);
console.log(`   ws://localhost:${server.port}/ws/pty    — terminal`);
console.log(`   ws://localhost:${server.port}/ws/files  — file watcher`);
