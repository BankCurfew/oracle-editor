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
      {/* Single header — Oracle selector + connection status */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Oracle</span>
          <OracleSelector />
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile tab toggle */}
          <div className="flex md:hidden rounded-lg bg-zinc-800 p-0.5">
            {(["chat", "preview"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs rounded-md ${
                  tab === t ? "bg-violet-600 text-white" : "text-zinc-400"
                }`}
              >
                {t === "chat" ? "Chat" : "Preview"}
              </button>
            ))}
          </div>
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-zinc-600"}`} />
        </div>
      </header>

      {/* Desktop: 2-panel — terminal (60%) + preview (40%) */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="flex-[3] min-w-0 border-r border-zinc-800 flex flex-col">
          <ChatTerminal />
        </div>
        <div className="flex-[2] min-w-0 flex flex-col bg-white">
          {previewSrc ? (
            <iframe src={previewSrc} className="w-full h-full border-0" title="Preview" />
          ) : (
            <div className="flex items-center justify-center h-full bg-zinc-950">
              <p className="text-zinc-600 text-sm">No preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: full-screen single panel */}
      <div className="flex md:hidden flex-1 min-h-0">
        {tab === "chat" ? (
          <div className="flex-1 flex flex-col">
            <ChatTerminal />
          </div>
        ) : (
          <div className="flex-1 bg-white">
            {previewSrc ? (
              <iframe src={previewSrc} className="w-full h-full border-0" title="Preview" />
            ) : (
              <div className="flex items-center justify-center h-full bg-zinc-950">
                <p className="text-zinc-600 text-sm">No preview</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
