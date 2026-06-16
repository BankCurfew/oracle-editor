/**
 * PTY — attach to tmux session, stream via WebSocket (xterm.js protocol)
 *
 * Pattern from maw-js office PTY streaming.
 * Spawns `tmux attach-session -t <name>` and pipes stdin/stdout over WebSocket.
 * Binary frames = terminal data, JSON frames = control messages.
 */
import type { ServerWebSocket, Subprocess } from "bun";

interface PtySession {
  proc: Subprocess;
  target: string;
  viewers: Set<ServerWebSocket<any>>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, PtySession>();
const CLEANUP_DELAY_MS = 5_000; // kill PTY 5s after last viewer leaves

function findSession(ws: ServerWebSocket<any>): PtySession | undefined {
  for (const s of sessions.values()) {
    if (s.viewers.has(ws)) return s;
  }
}

async function attach(ws: ServerWebSocket<any>, target: string, cols: number, rows: number) {
  const safe = target.replace(/[^a-zA-Z0-9\-_:.]/g, "");
  if (!safe) return;

  detach(ws);

  // Join existing PTY session for this target
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

  // Spawn new tmux attach
  const cmd = `stty rows ${rows} cols ${cols} 2>/dev/null; TERM=xterm-256color tmux attach-session -t '${safe}'`;
  const proc = Bun.spawn(["bash", "-c", cmd], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, TERM: "xterm-256color" },
  });

  const session: PtySession = { proc, target: safe, viewers: new Set([ws]), cleanupTimer: null };
  sessions.set(safe, session);

  // Stream stdout → all viewers
  (async () => {
    const reader = proc.stdout.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const v of session.viewers) {
          try {
            v.send(value);
          } catch {
            session.viewers.delete(v);
          }
        }
      }
    } catch {}
    // Process ended — cleanup
    sessions.delete(safe);
    for (const v of session.viewers) {
      try {
        v.send(JSON.stringify({ type: "detached", target: safe, reason: "process-exit" }));
      } catch {}
    }
  })();

  ws.send(JSON.stringify({ type: "attached", target: safe, reused: false }));
  console.log(`[pty] attached to tmux session: ${safe}`);
}

function resize(ws: ServerWebSocket<any>, cols: number, rows: number) {
  const session = findSession(ws);
  if (!session?.proc.stdin) return;
  // Send tmux resize command
  const resizeCmd = `tmux resize-window -t '${session.target}' -x ${cols} -y ${rows} 2>/dev/null\n`;
  session.proc.stdin.write(resizeCmd);
  session.proc.stdin.flush();
}

function detach(ws: ServerWebSocket<any>) {
  const session = findSession(ws);
  if (!session) return;
  session.viewers.delete(ws);

  if (session.viewers.size === 0) {
    // Schedule cleanup after delay
    session.cleanupTimer = setTimeout(() => {
      session.proc.kill();
      sessions.delete(session.target);
      console.log(`[pty] cleaned up session: ${session.target}`);
    }, CLEANUP_DELAY_MS);
  }
}

export function handlePtyMessage(ws: ServerWebSocket<any>, msg: string | Buffer) {
  if (typeof msg !== "string") {
    // Binary → keystroke to PTY stdin
    const session = findSession(ws);
    if (session?.proc.stdin) {
      session.proc.stdin.write(msg as Buffer);
      session.proc.stdin.flush();
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

export function handlePtyClose(ws: ServerWebSocket<any>) {
  detach(ws);
}
