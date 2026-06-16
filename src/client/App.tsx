import { useState } from "react";
import { ChatTerminal } from "./ChatTerminal";
import { OracleSelector } from "./OracleSelector";
import { useEditorStore } from "./store";

type Tab = "chat" | "preview";

export function App() {
  const wsConnected = useEditorStore((s) => s.wsConnected);
  const selectedFile = useEditorStore((s) => s.selectedFile);
  const [tab, setTab] = useState<Tab>("chat");

  const previewSrc = selectedFile
    ? `/api/file/raw?path=${encodeURIComponent(selectedFile)}`
    : null;

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100">
      {/* Header — 1 line: title + Oracle selector + status dot */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Oracle</span>
          <OracleSelector />
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected ? "bg-emerald-500" : "bg-zinc-600"}`} />
      </header>

      {/* Desktop: 2-panel — terminal (60%) + preview (40%) */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="flex-[3] min-w-0 border-r border-zinc-800 flex flex-col">
          <ChatTerminal />
        </div>
        <div className="flex-[2] min-w-0 flex flex-col bg-white">
          <Preview src={previewSrc} />
        </div>
      </div>

      {/* Mobile: content + bottom tab bar */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col">
        {/* Content area */}
        <div className="flex-1 min-h-0">
          {tab === "chat" ? <ChatTerminal /> : <Preview src={previewSrc} />}
        </div>

        {/* Bottom tab bar — always visible on mobile */}
        <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-900 safe-bottom">
          <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} label="Chat" />
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} label="Preview" />
        </nav>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-center text-sm font-medium min-h-[48px] transition-colors ${
        active
          ? "text-violet-400 bg-violet-500/10 border-t-2 border-violet-500"
          : "text-zinc-500 active:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function Preview({ src }: { src: string | null }) {
  return src ? (
    <iframe src={src} className="w-full h-full border-0" title="Preview" />
  ) : (
    <div className="flex items-center justify-center h-full bg-zinc-950">
      <p className="text-zinc-600 text-sm">No preview</p>
    </div>
  );
}
