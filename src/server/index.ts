/**
 * Oracle Editor — Backend Server (Node.js + node-pty)
 *
 * Hono HTTP + ws WebSocket for:
 * - File API (REST CRUD)
 * - File watcher (WebSocket push on change)
 * - PTY streaming (attach to tmux session via WebSocket)
 *
 * Runs on Node.js (not Bun) because node-pty requires libuv.
 * Port: 3500 (EDITOR_PORT env override)
 * Workspace: EDITOR_WORKSPACE env or cwd
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { resolve, extname } from "node:path";
import { readFile } from "node:fs/promises";
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
app.get("/api/sessions", (c) => {
  try {
    const text = execSync(
      'tmux list-sessions -F "#{session_name}\t#{session_windows}\t#{session_attached}" 2>/dev/null',
      { encoding: "utf-8" }
    );
    const sessions = text.trim().split("\n").filter(Boolean).map((line) => {
      const [name, windows, attached] = line.split("\t");
      return { name, windows: Number(windows), attached: Number(attached) > 0 };
    });
    return c.json({ sessions });
  } catch {
    return c.json({ sessions: [], error: "tmux not available" });
  }
});

// Raw file serving — for iframe preview
app.get("/api/file/raw", async (c) => {
  const reqPath = c.req.query("path");
  if (!reqPath) return c.text("path required", 400);
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

// Create HTTP server from Hono
const httpServer = createServer(serve({ fetch: app.fetch, port: PORT }).server ? undefined : app.fetch as any);

// WebSocket server on same HTTP server
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/ws/pty" || url.pathname === "/ws/files") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      (ws as any)._editorType = url.pathname === "/ws/pty" ? "pty" : "files";
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  const type = (ws as any)._editorType as "pty" | "files";

  if (type === "files") {
    addFileViewer(ws as any);
  }

  ws.on("message", (msg) => {
    if (type === "pty") {
      // Pass as Buffer or string depending on message type
      if (Buffer.isBuffer(msg)) {
        handlePtyMessage(ws as any, msg);
      } else if (msg instanceof ArrayBuffer) {
        handlePtyMessage(ws as any, Buffer.from(msg));
      } else {
        handlePtyMessage(ws as any, msg.toString());
      }
    }
  });

  ws.on("close", () => {
    if (type === "pty") {
      handlePtyClose(ws as any);
    } else {
      removeFileViewer(ws as any);
    }
  });
});

// Start with @hono/node-server
const server = serve({ fetch: app.fetch, port: PORT, createServer: () => httpServer });

console.log(`🔧 Oracle Editor server on http://localhost:${PORT}`);
console.log(`   workspace: ${WORKSPACE}`);
console.log(`   ws://localhost:${PORT}/ws/pty    — terminal`);
console.log(`   ws://localhost:${PORT}/ws/files  — file watcher`);
