import { useEffect, useCallback } from "react";
import { useEditorStore, type FileEntry } from "./store";
import { useWebSocket } from "./useWebSocket";

export function FileTree() {
  const files = useEditorStore((s) => s.files);
  const setFiles = useEditorStore((s) => s.setFiles);
  const refreshPreview = useEditorStore((s) => s.refreshPreview);
  const setWatcherConnected = useEditorStore((s) => s.setWatcherConnected);

  const onWatcherMessage = useCallback(
    (data: string | ArrayBuffer) => {
      if (typeof data !== "string") return;
      try {
        const msg = JSON.parse(data);
        if (msg.type === "file-change") {
          loadFiles();
          if (msg.path?.match(/\.(html?|css|js)$/i)) {
            refreshPreview();
          }
        }
      } catch {}
    },
    [refreshPreview]
  );

  useWebSocket({
    url: "/ws/files",
    onMessage: onWatcherMessage,
    onOpen: () => setWatcherConnected(true),
    onClose: () => setWatcherConnected(false),
  });

  async function loadFiles(path = ".") {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (path === ".") {
        setFiles(
          data.files
            .sort((a: FileEntry, b: FileEntry) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((f: FileEntry) => ({ ...f, children: f.isDirectory ? [] : undefined }))
        );
      }
    } catch {}
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleCreate(type: "file" | "dir") {
    const name = prompt(`New ${type} name:`);
    if (!name) return;
    if (type === "dir") {
      await fetch("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name }),
      });
    } else {
      await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name, content: "" }),
      });
    }
    loadFiles();
  }

  async function handleDelete(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    await fetch(`/api/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    loadFiles();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs">
        <span className="font-medium text-zinc-200 flex-1">Files</span>
        <button
          onClick={() => handleCreate("file")}
          className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          title="New File"
        >
          +F
        </button>
        <button
          onClick={() => handleCreate("dir")}
          className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          title="New Folder"
        >
          +D
        </button>
        <button
          onClick={() => loadFiles()}
          className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          title="Refresh"
        >
          R
        </button>
      </div>
      <div className="flex-1 overflow-y-auto text-sm p-1">
        {files.length === 0 ? (
          <p className="text-zinc-600 text-xs px-2 py-4">No files</p>
        ) : (
          files.map((f) => (
            <TreeNode key={f.path} entry={f} depth={0} onDelete={handleDelete} onReload={() => loadFiles()} />
          ))
        )}
      </div>
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  onDelete,
  onReload,
}: {
  entry: FileEntry;
  depth: number;
  onDelete: (path: string) => void;
  onReload: () => void;
}) {
  const selectFile = useEditorStore((s) => s.selectFile);
  const selectedFile = useEditorStore((s) => s.selectedFile);
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded);
  const isSelected = selectedFile === entry.path;

  function handleClick() {
    if (entry.isDirectory) {
      toggleExpanded(entry.path);
      if (!entry.expanded && entry.children?.length === 0) {
        loadChildren(entry.path);
      }
    } else {
      selectFile(entry.path);
    }
  }

  async function loadChildren(dirPath: string) {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      const store = useEditorStore.getState();
      const updated = insertChildren(store.files, dirPath, data.files);
      store.setFiles(updated);
    } catch {}
  }

  const icon = entry.isDirectory ? (entry.expanded ? "v" : ">") : fileIcon(entry.name);

  return (
    <>
      <div
        className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer group ${
          isSelected ? "bg-violet-500/20 text-violet-300" : "text-zinc-300 hover:bg-zinc-800/50"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
      >
        <span className="text-zinc-500 w-3 text-center text-xs flex-shrink-0">{icon}</span>
        <span className="truncate flex-1">{entry.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.path);
          }}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs px-1"
        >
          x
        </button>
      </div>
      {entry.isDirectory &&
        entry.expanded &&
        entry.children?.map((child) => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} onDelete={onDelete} onReload={onReload} />
        ))}
    </>
  );
}

function fileIcon(name: string): string {
  if (name.match(/\.(html?|htm)$/i)) return "#";
  if (name.match(/\.css$/i)) return "*";
  if (name.match(/\.(js|ts|tsx)$/i)) return "f";
  if (name.match(/\.(png|jpe?g|gif|svg|webp)$/i)) return "i";
  if (name.match(/\.json$/i)) return "{}";
  return ".";
}

function insertChildren(nodes: FileEntry[], parentPath: string, children: FileEntry[]): FileEntry[] {
  return nodes.map((n) => {
    if (n.path === parentPath) {
      return {
        ...n,
        children: children
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map((c) => ({ ...c, children: c.isDirectory ? [] : undefined })),
      };
    }
    if (n.children) {
      return { ...n, children: insertChildren(n.children, parentPath, children) };
    }
    return n;
  });
}
