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
