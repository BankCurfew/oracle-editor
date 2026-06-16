/**
 * VisualEditor — GrapesJS canvas for drag & drop editing
 *
 * Usage: <VisualEditor fileUrl="/api/file?path=index.html" />
 *
 * Features:
 * - Load HTML from file API → display in GrapesJS canvas
 * - Visual drag & drop editing
 * - Properties panel: font, color, size, spacing
 * - Toggle: visual edit / code view / preview
 * - Save back to file via API
 */
import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs, { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

export interface VisualEditorProps {
  /** API endpoint to load HTML content */
  fileUrl: string;
  /** API endpoint to save HTML content */
  saveUrl?: string;
  /** Callback when content changes */
  onChange?: (html: string, css: string) => void;
  /** Height of the editor canvas */
  height?: string;
}

type ViewMode = "edit" | "code" | "preview";

export function VisualEditor({
  fileUrl,
  saveUrl,
  onChange,
  height = "100%",
}: VisualEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const gjsRef = useRef<Editor | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Initialize GrapesJS
  useEffect(() => {
    if (!editorRef.current || gjsRef.current) return;

    const editor = grapesjs.init({
      container: editorRef.current,
      height,
      width: "auto",
      fromElement: false,
      storageManager: false, // We handle saving ourselves
      panels: { defaults: [] }, // Custom panels below
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sarabun:wght@400;600;700&display=swap",
        ],
      },
      styleManager: {
        sectors: [
          {
            name: "Typography",
            open: true,
            properties: [
              { type: "select", property: "font-family", options: [
                { id: "Inter, sans-serif", label: "Inter" },
                { id: "Sarabun, sans-serif", label: "Sarabun" },
                { id: "LINESeedSansTH, sans-serif", label: "LINESeedSansTH" },
                { id: "serif", label: "Serif" },
                { id: "monospace", label: "Monospace" },
              ]},
              { type: "number", property: "font-size", units: ["px", "em", "rem"], min: 8, max: 120 },
              { type: "number", property: "font-weight", min: 100, max: 900, step: 100 },
              { type: "color", property: "color" },
              { type: "number", property: "line-height", units: ["px", "em", ""], min: 0, step: 0.1 },
              { type: "number", property: "letter-spacing", units: ["px", "em"], min: -5, max: 20 },
              { type: "select", property: "text-align", options: [
                { id: "left", label: "Left" },
                { id: "center", label: "Center" },
                { id: "right", label: "Right" },
                { id: "justify", label: "Justify" },
              ]},
            ],
          },
          {
            name: "Spacing",
            properties: [
              { type: "composite", property: "margin", properties: [
                { type: "number", property: "margin-top", units: ["px", "em", "%"] },
                { type: "number", property: "margin-right", units: ["px", "em", "%"] },
                { type: "number", property: "margin-bottom", units: ["px", "em", "%"] },
                { type: "number", property: "margin-left", units: ["px", "em", "%"] },
              ]},
              { type: "composite", property: "padding", properties: [
                { type: "number", property: "padding-top", units: ["px", "em", "%"] },
                { type: "number", property: "padding-right", units: ["px", "em", "%"] },
                { type: "number", property: "padding-bottom", units: ["px", "em", "%"] },
                { type: "number", property: "padding-left", units: ["px", "em", "%"] },
              ]},
            ],
          },
          {
            name: "Background",
            properties: [
              { type: "color", property: "background-color" },
              { type: "number", property: "border-radius", units: ["px", "%"] },
              { type: "number", property: "opacity", min: 0, max: 1, step: 0.05 },
            ],
          },
          {
            name: "Size",
            properties: [
              { type: "number", property: "width", units: ["px", "%", "vw", "auto"] },
              { type: "number", property: "height", units: ["px", "%", "vh", "auto"] },
              { type: "number", property: "max-width", units: ["px", "%"] },
            ],
          },
        ],
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
    });

    // Track changes
    editor.on("change:changesCount", () => {
      setDirty(true);
      if (onChange) {
        const html = editor.getHtml();
        const css = editor.getCss() || "";
        onChange(html, css);
      }
    });

    gjsRef.current = editor;

    // Load initial content
    loadContent(editor);

    return () => {
      editor.destroy();
      gjsRef.current = null;
    };
  }, []);

  // Load HTML from file API
  async function loadContent(editor: Editor) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        console.error(`[VisualEditor] Failed to load: ${res.status}`);
        return;
      }
      const html = await res.text();
      editor.setComponents(html);
      setDirty(false);
    } catch (err) {
      console.error("[VisualEditor] Load error:", err);
    }
  }

  // Save HTML back to file API
  const handleSave = useCallback(async () => {
    const editor = gjsRef.current;
    if (!editor || !saveUrl) return;

    setSaving(true);
    const html = editor.getHtml();
    const css = editor.getCss() || "";
    const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;

    try {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fullHtml }),
      });
      if (res.ok) {
        setDirty(false);
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("[VisualEditor] Save error:", err);
    }
    setSaving(false);
  }, [saveUrl]);

  // Toggle view modes
  const handleViewMode = useCallback((mode: ViewMode) => {
    const editor = gjsRef.current;
    if (!editor) return;

    setViewMode(mode);

    switch (mode) {
      case "code":
        // Open code editor panel
        editor.runCommand("open-code");
        break;
      case "preview":
        editor.runCommand("preview");
        break;
      case "edit":
        editor.stopCommand("preview");
        break;
    }
  }, []);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className="visual-editor" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: "13px",
      }}>
        {/* View mode toggles */}
        {(["edit", "code", "preview"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleViewMode(mode)}
            style={{
              padding: "4px 12px",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: viewMode === mode ? "#3b82f6" : "#e2e8f0",
              background: viewMode === mode ? "#eff6ff" : "white",
              color: viewMode === mode ? "#2563eb" : "#64748b",
              cursor: "pointer",
              fontWeight: viewMode === mode ? 600 : 400,
              fontSize: "12px",
            }}
          >
            {mode === "edit" ? "Visual" : mode === "code" ? "Code" : "Preview"}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Save status */}
        {lastSaved && (
          <span style={{ color: "#94a3b8", fontSize: "11px" }}>
            Saved {lastSaved}
          </span>
        )}
        {dirty && (
          <span style={{ color: "#f59e0b", fontSize: "11px" }}>Unsaved changes</span>
        )}

        {/* Save button */}
        {saveUrl && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              padding: "4px 16px",
              borderRadius: "6px",
              border: "none",
              background: dirty ? "#3b82f6" : "#e2e8f0",
              color: dirty ? "white" : "#94a3b8",
              cursor: dirty ? "pointer" : "default",
              fontWeight: 500,
              fontSize: "12px",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* GrapesJS Canvas */}
      <div ref={editorRef} style={{ flex: 1 }} />
    </div>
  );
}

export default VisualEditor;
