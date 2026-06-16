/**
 * File Watcher — chokidar watch workspace folder → WebSocket push on change
 *
 * Watches for file add/change/unlink events in the workspace root.
 * Broadcasts to all connected WebSocket clients on the /ws/files endpoint.
 */
import { watch, type FSWatcher } from "chokidar";
import { relative } from "node:path";
import type { ServerWebSocket } from "bun";

const viewers = new Set<ServerWebSocket<any>>();
let watcher: FSWatcher | null = null;

export function startFileWatcher(workspaceRoot: string) {
  if (watcher) return; // already watching

  watcher = watch(workspaceRoot, {
    ignoreInitial: true,
    ignored: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.next/**",
      "**/.wrangler/**",
      "**/dist/**",
    ],
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const broadcast = (event: string, path: string) => {
    const relPath = relative(workspaceRoot, path);
    const msg = JSON.stringify({ type: "file-change", event, path: relPath, ts: Date.now() });
    for (const ws of viewers) {
      try {
        ws.send(msg);
      } catch {
        viewers.delete(ws);
      }
    }
  };

  watcher.on("add", (path) => broadcast("add", path));
  watcher.on("change", (path) => broadcast("change", path));
  watcher.on("unlink", (path) => broadcast("unlink", path));
  watcher.on("addDir", (path) => broadcast("addDir", path));
  watcher.on("unlinkDir", (path) => broadcast("unlinkDir", path));

  console.log(`[file-watcher] watching ${workspaceRoot}`);
}

export function addFileViewer(ws: ServerWebSocket<any>) {
  viewers.add(ws);
}

export function removeFileViewer(ws: ServerWebSocket<any>) {
  viewers.delete(ws);
}

export function stopFileWatcher() {
  watcher?.close();
  watcher = null;
  viewers.clear();
}
