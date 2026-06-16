import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useWebSocket } from "./useWebSocket";
import { useEditorStore } from "./store";

export function ChatTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ptyTarget = useEditorStore((s) => s.ptyTarget);
  const setWsConnected = useEditorStore((s) => s.setWsConnected);
  const [input, setInput] = useState("");

  const onMessage = useCallback((data: string | ArrayBuffer) => {
    if (!termRef.current) return;
    if (data instanceof ArrayBuffer) {
      termRef.current.write(new Uint8Array(data));
    } else {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "attached") {
          termRef.current.write(`\r\n\x1b[32m[attached: ${msg.target}]\x1b[0m\r\n`);
        } else if (msg.type === "detached") {
          termRef.current.write(`\r\n\x1b[33m[detached]\x1b[0m\r\n`);
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
      const cols = termRef.current?.cols || 120;
      const rows = termRef.current?.rows || 40;
      send(JSON.stringify({ type: "attach", target: ptyTarget, cols, rows }));
    },
    onClose: () => setWsConnected(false),
  });

  // Reconnect on oracle change
  const prevTarget = useRef(ptyTarget);
  useEffect(() => {
    if (prevTarget.current !== ptyTarget) {
      prevTarget.current = ptyTarget;
      send(JSON.stringify({ type: "detach" }));
      setTimeout(() => {
        const cols = termRef.current?.cols || 120;
        const rows = termRef.current?.rows || 40;
        send(JSON.stringify({ type: "attach", target: ptyTarget, cols, rows }));
      }, 200);
    }
  }, [ptyTarget, send]);

  // Init xterm
  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const isMobile = window.innerWidth < 768;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? 10 : 13,
      lineHeight: isMobile ? 1.2 : 1,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      scrollback: 1000,
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#a78bfa",
        selectionBackground: "#3f3f4660",
      },
      allowProposedApi: true,
      // Prevent horizontal scroll on mobile
      overviewRuler: { width: 0 } as any,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    // Desktop: direct keyboard input to PTY
    term.onData((data) => {
      send(new TextEncoder().encode(data));
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

  // Send from input box
  const handleSend = () => {
    if (!input) return;
    send(new TextEncoder().encode(input + "\r"));
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Terminal output — fills available space */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 cursor-text"
        onClick={() => termRef.current?.focus()}
      />

      {/* Input box — ALWAYS visible, primary input method */}
      <div className="flex items-center gap-2 px-2 py-2 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Type here..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 min-h-[44px]"
        />
        <button
          onClick={handleSend}
          className="bg-violet-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium min-h-[44px] active:bg-violet-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
