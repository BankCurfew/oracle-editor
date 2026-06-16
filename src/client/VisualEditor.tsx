/**
 * VisualEditor — GrapesJS with full plugin suite + panels
 *
 * Plugins: preset-webpage, blocks-basic, plugin-forms, navbar, tabs, custom-code
 * Layout: blocks left, canvas center, styles/layers right (managed by GrapesJS panels)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs, { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import gjsPresetWebpage from "grapesjs-preset-webpage";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import gjsPluginForms from "grapesjs-plugin-forms";
import gjsNavbar from "grapesjs-navbar";
import gjsTabs from "grapesjs-tabs";
import gjsCustomCode from "grapesjs-custom-code";

export interface VisualEditorProps {
  fileUrl: string;
  saveUrl?: string;
  onChange?: (html: string, css: string) => void;
}

export function VisualEditor({ fileUrl, saveUrl, onChange }: VisualEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const gjsRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!editorRef.current || gjsRef.current) return;

    const editor = grapesjs.init({
      container: editorRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      plugins: [
        gjsPresetWebpage,
        gjsBlocksBasic,
        gjsPluginForms,
        gjsNavbar,
        gjsTabs,
        gjsCustomCode,
      ],
      pluginsOpts: {
        [gjsPresetWebpage as any]: {
          modalImportTitle: "Import HTML",
          modalImportButton: "Import",
          modalImportLabel: "",
        },
        [gjsBlocksBasic as any]: { flexGrid: true },
        [gjsPluginForms as any]: {},
        [gjsNavbar as any]: {},
        [gjsTabs as any]: {},
        [gjsCustomCode as any]: {},
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sarabun:wght@400;600;700&display=swap",
        ],
      },
      styleManager: {
        appendTo: "#styles-container",
        sectors: [
          {
            name: "Typography",
            open: true,
            properties: [
              { type: "select", property: "font-family", options: [
                { id: "Inter, sans-serif", label: "Inter" },
                { id: "Sarabun, sans-serif", label: "Sarabun" },
                { id: "Arial, sans-serif", label: "Arial" },
                { id: "serif", label: "Serif" },
                { id: "monospace", label: "Monospace" },
              ]},
              { type: "number", property: "font-size", units: ["px", "em", "rem"], min: 8, max: 120 },
              { type: "number", property: "font-weight", min: 100, max: 900, step: 100 },
              { type: "color", property: "color" },
              { type: "select", property: "text-align", options: [
                { id: "left", label: "Left" },
                { id: "center", label: "Center" },
                { id: "right", label: "Right" },
              ]},
            ],
          },
          {
            name: "Layout",
            properties: [
              { type: "composite", property: "margin", properties: [
                { type: "number", property: "margin-top", units: ["px", "%"] },
                { type: "number", property: "margin-right", units: ["px", "%"] },
                { type: "number", property: "margin-bottom", units: ["px", "%"] },
                { type: "number", property: "margin-left", units: ["px", "%"] },
              ]},
              { type: "composite", property: "padding", properties: [
                { type: "number", property: "padding-top", units: ["px", "%"] },
                { type: "number", property: "padding-right", units: ["px", "%"] },
                { type: "number", property: "padding-bottom", units: ["px", "%"] },
                { type: "number", property: "padding-left", units: ["px", "%"] },
              ]},
            ],
          },
          {
            name: "Appearance",
            properties: [
              { type: "color", property: "background-color" },
              { type: "number", property: "border-radius", units: ["px", "%"] },
              { type: "number", property: "opacity", min: 0, max: 1, step: 0.05 },
              { type: "number", property: "width", units: ["px", "%", "vw"] },
              { type: "number", property: "height", units: ["px", "%", "vh"] },
            ],
          },
        ],
      },
      blockManager: {
        appendTo: "#blocks-container",
      },
      layerManager: {
        appendTo: "#layers-container",
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
        onChange(editor.getHtml(), editor.getCss() || "");
      }
    });

    gjsRef.current = editor;
    loadContent(editor);

    return () => {
      editor.destroy();
      gjsRef.current = null;
    };
  }, []);

  async function loadContent(editor: Editor) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return;
      const html = await res.text();
      editor.setComponents(html);
      setDirty(false);
    } catch (err) {
      console.error("[VisualEditor] Load error:", err);
    }
  }

  const handleSave = useCallback(async () => {
    const editor = gjsRef.current;
    if (!editor || !saveUrl) return;
    setSaving(true);
    const html = editor.getHtml();
    const css = editor.getCss() || "";
    const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    try {
      const urlObj = new URL(fileUrl, window.location.origin);
      const filePath = urlObj.searchParams.get("path") || "index.html";
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: fullHtml }),
      });
      if (res.ok) {
        setDirty(false);
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("[VisualEditor] Save error:", err);
    }
    setSaving(false);
  }, [saveUrl, fileUrl]);

  // Device toggle
  const setDevice = useCallback((name: string) => {
    gjsRef.current?.setDevice(name);
  }, []);

  // Undo/Redo
  const undo = useCallback(() => gjsRef.current?.UndoManager.undo(), []);
  const redo = useCallback(() => gjsRef.current?.UndoManager.redo(), []);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, undo, redo]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50 shrink-0 text-xs">
        <button onClick={undo} className="px-2 py-1 rounded hover:bg-zinc-200" title="Undo (Ctrl+Z)">Undo</button>
        <button onClick={redo} className="px-2 py-1 rounded hover:bg-zinc-200" title="Redo (Ctrl+Shift+Z)">Redo</button>
        <span className="w-px h-4 bg-zinc-300" />
        {["Desktop", "Tablet", "Mobile"].map((d) => (
          <button key={d} onClick={() => setDevice(d)} className="px-2 py-1 rounded hover:bg-zinc-200">{d}</button>
        ))}
        <div className="flex-1" />
        {lastSaved && <span className="text-zinc-400">Saved {lastSaved}</span>}
        {dirty && <span className="text-amber-500">Unsaved</span>}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`px-3 py-1 rounded text-white ${dirty ? "bg-blue-500 hover:bg-blue-600" : "bg-zinc-300"}`}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Editor body: blocks | canvas | styles */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Blocks */}
        <div className="w-[200px] border-r border-zinc-200 overflow-y-auto bg-zinc-50 hidden md:block">
          <div className="p-2 text-xs font-medium text-zinc-500 border-b border-zinc-200">Blocks</div>
          <div id="blocks-container" />
        </div>

        {/* Center: Canvas */}
        <div ref={editorRef} className="flex-1 min-w-0" />

        {/* Right: Styles + Layers */}
        <div className="w-[240px] border-l border-zinc-200 overflow-y-auto bg-zinc-50 hidden lg:block">
          <div className="p-2 text-xs font-medium text-zinc-500 border-b border-zinc-200">Styles</div>
          <div id="styles-container" />
          <div className="p-2 text-xs font-medium text-zinc-500 border-b border-zinc-200 mt-2">Layers</div>
          <div id="layers-container" />
        </div>
      </div>
    </div>
  );
}

export default VisualEditor;
