import { ChatTerminal } from "./ChatTerminal";
import { FileTree } from "./FileTree";
import { PreviewPane } from "./PreviewPane";
import { useEditorStore } from "./store";

export function App() {
  const wsConnected = useEditorStore((s) => s.wsConnected);
  const watcherConnected = useEditorStore((s) => s.watcherConnected);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-100">Oracle Editor</h1>
          <span className="text-xs text-zinc-500">Visual Website Builder + AI Chat</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <StatusBadge label="PTY" connected={wsConnected} />
          <StatusBadge label="Watch" connected={watcherConnected} />
        </div>
      </header>

      {/* Main three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat Terminal */}
        <div className="w-[400px] min-w-[300px] border-r border-zinc-800 flex flex-col">
          <ChatTerminal />
        </div>

        {/* Center: Preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <PreviewPane />
        </div>

        {/* Right: File Tree */}
        <div className="w-[260px] min-w-[200px] border-l border-zinc-800 flex flex-col">
          <FileTree />
        </div>
      </div>
    </div>
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
