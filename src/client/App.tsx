import { ChatTerminal } from "./ChatTerminal";
import { FileTree } from "./FileTree";
import { PreviewPane } from "./PreviewPane";
import { OracleSelector } from "./OracleSelector";
import { useEditorStore, type MobileTab } from "./store";

export function App() {
  const wsConnected = useEditorStore((s) => s.wsConnected);
  const watcherConnected = useEditorStore((s) => s.watcherConnected);
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-zinc-100">Oracle Editor</h1>
          <OracleSelector />
          <span className="text-xs text-zinc-500 hidden sm:inline">Visual Website Builder + AI Chat</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <StatusBadge label="PTY" connected={wsConnected} />
          <StatusBadge label="Watch" connected={watcherConnected} />
        </div>
      </header>

      {/* Desktop: three-panel layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="w-[400px] min-w-[300px] border-r border-zinc-800 flex flex-col">
          <ChatTerminal />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <PreviewPane />
        </div>
        <div className="w-[260px] min-w-[200px] border-l border-zinc-800 flex flex-col">
          <FileTree />
        </div>
      </div>

      {/* Mobile: tab-based layout */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0">
          {activeTab === "chat" && <ChatTerminal />}
          {activeTab === "preview" && <PreviewPane />}
          {activeTab === "files" && <FileTree />}
        </div>

        {/* Bottom tab bar */}
        <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-900 safe-bottom">
          <TabButton tab="chat" active={activeTab} onTap={setActiveTab} label="Chat" />
          <TabButton tab="preview" active={activeTab} onTap={setActiveTab} label="Preview" />
          <TabButton tab="files" active={activeTab} onTap={setActiveTab} label="Files" />
        </nav>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onTap,
  label,
}: {
  tab: MobileTab;
  active: MobileTab;
  onTap: (t: MobileTab) => void;
  label: string;
}) {
  const isActive = tab === active;
  return (
    <button
      onClick={() => onTap(tab)}
      className={`flex-1 py-3 text-center text-sm font-medium transition-colors min-h-[44px] ${
        isActive ? "text-violet-400 bg-zinc-800/50" : "text-zinc-500 active:bg-zinc-800/30"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ label, connected }: { label: string; connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-600"}`}
      />
      {label}
    </span>
  );
}
