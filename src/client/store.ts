import { create } from "zustand";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string | null;
  children?: FileEntry[];
  expanded?: boolean;
}

export type MobileTab = "chat" | "preview" | "files";

interface EditorState {
  /** Mobile tab */
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;

  /** File tree state */
  files: FileEntry[];
  setFiles: (files: FileEntry[]) => void;
  toggleExpanded: (path: string) => void;

  /** Currently selected file for preview */
  selectedFile: string | null;
  selectFile: (path: string | null) => void;

  /** PTY target (tmux session name) */
  ptyTarget: string;
  setPtyTarget: (target: string) => void;

  /** WebSocket connection status */
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  /** File watcher connection */
  watcherConnected: boolean;
  setWatcherConnected: (connected: boolean) => void;

  /** Preview refresh counter */
  previewKey: number;
  refreshPreview: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),

  files: [],
  setFiles: (files) => set({ files }),
  toggleExpanded: (path) =>
    set((state) => ({
      files: toggleNode(state.files, path),
    })),

  selectedFile: null,
  selectFile: (path) => set({ selectedFile: path }),

  ptyTarget: new URLSearchParams(window.location.search).get("session") || "01-bob:0",
  setPtyTarget: (target) => set({ ptyTarget: target }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  watcherConnected: false,
  setWatcherConnected: (connected) => set({ watcherConnected: connected }),

  previewKey: 0,
  refreshPreview: () => set((s) => ({ previewKey: s.previewKey + 1 })),
}));

function toggleNode(nodes: FileEntry[], path: string): FileEntry[] {
  return nodes.map((n) => {
    if (n.path === path) return { ...n, expanded: !n.expanded };
    if (n.children) return { ...n, children: toggleNode(n.children, path) };
    return n;
  });
}
