import { useEditorStore } from "./store";

export function PreviewPane() {
  const selectedFile = useEditorStore((s) => s.selectedFile);
  const previewKey = useEditorStore((s) => s.previewKey);

  const isPreviewable = selectedFile?.match(/\.(html?|htm|svg)$/i);
  const isImage = selectedFile?.match(/\.(png|jpe?g|gif|webp|svg)$/i);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs">
        <span className="font-medium text-zinc-200">Preview</span>
        {selectedFile && (
          <span className="text-zinc-500 truncate">{selectedFile}</span>
        )}
      </div>
      <div className="flex-1 min-h-0 bg-white">
        {!selectedFile ? (
          <div className="flex items-center justify-center h-full bg-zinc-950">
            <p className="text-zinc-600 text-sm">Select a file to preview</p>
          </div>
        ) : isPreviewable ? (
          <iframe
            key={`${selectedFile}-${previewKey}`}
            src={`/api/file/raw?path=${encodeURIComponent(selectedFile)}`}
            className="w-full h-full border-0"
            title="Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : isImage ? (
          <div className="flex items-center justify-center h-full bg-zinc-950 p-4">
            <img
              key={`${selectedFile}-${previewKey}`}
              src={`/api/file/raw?path=${encodeURIComponent(selectedFile)}`}
              alt={selectedFile}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <FileContentView path={selectedFile} refreshKey={previewKey} />
        )}
      </div>
    </div>
  );
}

function FileContentView({ path, refreshKey }: { path: string; refreshKey: number }) {
  return (
    <div className="h-full bg-zinc-950 overflow-auto">
      <FileContent path={path} refreshKey={refreshKey} />
    </div>
  );
}

import { useState, useEffect } from "react";

function FileContent({ path, refreshKey }: { path: string; refreshKey: number }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || "");
        setLoading(false);
      })
      .catch(() => {
        setContent("Error loading file");
        setLoading(false);
      });
  }, [path, refreshKey]);

  if (loading) return <p className="text-zinc-600 text-sm p-4">Loading...</p>;

  return (
    <pre className="text-zinc-300 text-xs p-4 font-mono whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}
