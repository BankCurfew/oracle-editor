import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useWebSocket } from "./useWebSocket";
import { useEditorStore } from "./store";

const IS_MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function ChatTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyTarget = useEditorStore((s) => s.ptyTarget);
  const setWsConnected = useEditorStore((s) => s.setWsConnected);

  const onMessage = useCallback((data: string | ArrayBuffer) => {
    if (!termRef.current) return;

    if (data instanceof ArrayBuffer) {
      termRef.current.write(new Uint8Array(data));
    } else {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "attached") {
          termRef.current.write(`\r\n\x1b[32m[attached: ${msg.target}${msg.reused ? " (reused)" : ""}]\x1b[0m\r\n`);
        } else if (msg.type === "detached") {
          termRef.current.write(`\r\n\x1b[33m[detached: ${msg.reason}]\x1b[0m\r\n`);
        }
      } catch {
        termRef.current.write(data);
      }
    }
  }, []);

  const { send } = useWebSocket({
    url: "/ws/pty",
    onMessage,
    onOpen: () => {
      setWsConnected(true);
      const fit = fitRef.current;
      const cols = fit ? termRef.current?.cols || 120 : 120;
      const rows = fit ? termRef.current?.rows || 40 : 40;
      send(JSON.stringify({ type: "attach", target: ptyTarget, cols, rows }));
    },
    onClose: () => setWsConnected(false),
  });

  // Reconnect PTY when oracle selection changes
  const prevTarget = useRef(ptyTarget);
  useEffect(() => {
    if (prevTarget.current !== ptyTarget) {
      prevTarget.current = ptyTarget;
      const fit = fitRef.current;
      const cols = fit ? termRef.current?.cols || 120 : 120;
      const rows = fit ? termRef.current?.rows || 40 : 40;
      send(JSON.stringify({ type: "detach" }));
      setTimeout(() => {
        send(JSON.stringify({ type: "attach", target: ptyTarget, cols, rows }));
        termRef.current?.write(`\r\n\x1b[36m[switching to: ${ptyTarget}]\x1b[0m\r\n`);
      }, 200);
    }
  }, [ptyTarget, send]);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#a78bfa",
        selectionBackground: "#3f3f4660",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    term.onData((data) => {
      const encoder = new TextEncoder();
      send(encoder.encode(data));
    });

    term.onResize(({ cols, rows }) => {
      send(JSON.stringify({ type: "resize", cols, rows }));
    });

    termRef.current = term;
    fitRef.current = fit;

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [send]);

  // Mobile input box state
  const [mobileInput, setMobileInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleMobileSend = () => {
    if (!mobileInput.trim()) return;
    const encoder = new TextEncoder();
    // Send each character + Enter
    send(encoder.encode(mobileInput));
    send(encoder.encode("\r"));
    setMobileInput("");
    inputRef.current?.focus();
  };

  // Desktop: tap terminal container to focus xterm
  const handleContainerClick = () => {
    termRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
        <span className="font-medium text-zinc-200">Oracle Chat</span>
        <span className="text-zinc-600">|</span>
        <span className="truncate">tmux: {ptyTarget}</span>
        <ConnectionDot />
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 cursor-text"
        onClick={handleContainerClick}
      />
      {/* Mobile input box — iOS Safari can't focus xterm textarea */}
      {IS_MOBILE && (
        <div className="flex items-center gap-2 px-2 py-2 bg-zinc-900 border-t border-zinc-800 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleMobileSend(); }}
            placeholder="Type command..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 min-h-[44px]"
          />
          <button
            onClick={handleMobileSend}
            className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] min-w-[44px] active:bg-violet-700"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectionDot() {
  const connected = useEditorStore((s) => s.wsConnected);
  return (
    <span
      className={`ml-auto inline-block w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
      title={connected ? "Connected" : "Disconnected"}
    />
  );
}
