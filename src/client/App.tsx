import { useState } from "react";
import { ChatTerminal } from "./ChatTerminal";
import { VisualEditor } from "./VisualEditor";
import { OracleSelector } from "./OracleSelector";
import { useEditorStore } from "./store";

type MobileTab = "editor" | "terminal";

export function App() {
  const wsConnected = useEditorStore((s) => s.wsConnected);
  const selectedFile = useEditorStore((s) => s.selectedFile);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");

  const filePath = selectedFile || "index.html";
  const fileUrl = `/api/file/raw?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="flex flex-col h-[100dvh] bg-white text-zinc-900">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 text-zinc-100 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Oracle Editor</span>
          <OracleSelector />
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-zinc-600"}`} />
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            className="hidden md:block px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            {terminalOpen ? "Hide Terminal" : "Terminal"}
          </button>
        </div>
      </header>

      {/* Desktop: editor-first + collapsible terminal at bottom */}
      <div className="hidden md:flex flex-col flex-1 min-h-0">
        {/* Editor area — takes all space when terminal closed */}
        <div className={`flex-1 min-h-0 ${terminalOpen ? "" : ""}`}>
          <VisualEditor
            fileUrl={fileUrl}
            saveUrl="/api/file"
            onChange={() => {}}
          />
        </div>

        {/* Terminal — collapsible bottom panel */}
        {terminalOpen && (
          <div className="h-[30vh] min-h-[200px] border-t border-zinc-700 bg-zinc-950 text-zinc-100 flex flex-col">
            <ChatTerminal />
          </div>
        )}
      </div>

      {/* Mobile: tab-based — Editor / Terminal */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0">
          {mobileTab === "editor" ? (
            <VisualEditor
              fileUrl={fileUrl}
              saveUrl="/api/file"
              onChange={() => {}}
            />
          ) : (
            <div className="h-full bg-zinc-950 text-zinc-100">
              <ChatTerminal />
            </div>
          )}
        </div>

        <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-900 text-zinc-100 safe-bottom">
          <TabBtn active={mobileTab === "editor"} onClick={() => setMobileTab("editor")} label="Editor" />
          <TabBtn active={mobileTab === "terminal"} onClick={() => setMobileTab("terminal")} label="Terminal" />
        </nav>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-center text-sm font-medium min-h-[48px] ${
        active ? "text-violet-400 bg-violet-500/10 border-t-2 border-violet-500" : "text-zinc-500"
      }`}
    >
      {label}
    </button>
  );
}
