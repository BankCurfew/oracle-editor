/**
 * PTY — attach to tmux session via real pseudo-terminal (node-pty)
 *
 * Bun.spawn with stdin:'pipe' creates a regular pipe, NOT a PTY.
 * tmux detects non-TTY → doesn't echo keystrokes back.
 * node-pty creates a real pseudo-terminal → tmux works correctly.
 *
 * Binary frames = terminal data, JSON frames = control messages.
 */
import * as pty from "node-pty";
import type { IPty } from "node-pty";

/** Generic WebSocket interface — works with both ws and Bun */
interface WsLike { send(data: string | Buffer): void; }

interface PtySession {
  proc: IPty;
  target: string;
  viewers: Set<WsLike>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, PtySession>();
const CLEANUP_DELAY_MS = 1_000; // fast cleanup to free PTY resources
const MAX_SESSIONS = 5;

/** Get current session count for health reporting */
export function getPtySessionCount(): number {
  return sessions.size;
}

function findSession(ws: WsLike): PtySession | undefined {
  for (const s of sessions.values()) {
    if (s.viewers.has(ws)) return s;
  }
}

function attach(ws: WsLike, target: string, cols: number, rows: number) {
  const safe = target.replace(/[^a-zA-Z0-9\-_:.]/g, "");
  if (!safe) return;

  detach(ws);

  // Join existing PTY session for this target (doesn't count as new)
  if (sessions.has(safe)) {
    const session = sessions.get(safe)!;
    session.viewers.add(ws);
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }
    ws.send(JSON.stringify({ type: "attached", target: safe, reused: true }));
    return;
  }

  // Check session limit before spawning
  if (sessions.size >= MAX_SESSIONS) {
    console.warn(`[pty] max sessions (${MAX_SESSIONS}) reached, rejecting: ${safe}`);
    ws.send(JSON.stringify({ type: "error", message: `Max ${MAX_SESSIONS} sessions reached` }));
    return;
  }

  // Spawn real PTY → tmux attach
  const proc = pty.spawn("tmux", ["attach-session", "-t", safe], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.env.HOME || "/",
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
  });

  const session: PtySession = { proc, target: safe, viewers: new Set([ws]), cleanupTimer: null };
  sessions.set(safe, session);

  // Stream PTY output → all viewers
  proc.onData((data: string) => {
    const buf = Buffer.from(data);
    for (const v of session.viewers) {
      try {
        v.send(buf);
      } catch {
        session.viewers.delete(v);
      }
    }
  });

  proc.onExit(() => {
    sessions.delete(safe);
    for (const v of session.viewers) {
      try {
        v.send(JSON.stringify({ type: "detached", target: safe, reason: "process-exit" }));
      } catch {}
    }
    console.log(`[pty] session ended: ${safe}`);
  });

  ws.send(JSON.stringify({ type: "attached", target: safe, reused: false }));
  console.log(`[pty] attached to tmux session: ${safe} (${cols}x${rows})`);
}

function resize(ws: WsLike, cols: number, rows: number) {
  const session = findSession(ws);
  if (!session) return;
  session.proc.resize(cols, rows);
}

function detach(ws: WsLike) {
  const session = findSession(ws);
  if (!session) return;
  session.viewers.delete(ws);

  if (session.viewers.size === 0) {
    session.cleanupTimer = setTimeout(() => {
      session.proc.kill();
      sessions.delete(session.target);
      console.log(`[pty] cleaned up session: ${session.target}`);
    }, CLEANUP_DELAY_MS);
  }
}

export function handlePtyMessage(ws: WsLike, msg: string | Buffer) {
  if (typeof msg !== "string") {
    // Binary → keystroke to PTY stdin
    const session = findSession(ws);
    if (session) {
      session.proc.write(Buffer.from(msg as Buffer).toString());
    }
    return;
  }

  // JSON control message
  try {
    const data = JSON.parse(msg);
    if (data.type === "attach") attach(ws, data.target, data.cols || 120, data.rows || 40);
    else if (data.type === "resize") resize(ws, data.cols, data.rows);
    else if (data.type === "detach") detach(ws);
  } catch {}
}

export function handlePtyClose(ws: WsLike) {
  detach(ws);
}
