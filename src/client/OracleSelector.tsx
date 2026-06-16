import { useState, useEffect } from "react";
import { useEditorStore } from "./store";

interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
}

export function OracleSelector() {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const ptyTarget = useEditorStore((s) => s.ptyTarget);
  const setPtyTarget = useEditorStore((s) => s.setPtyTarget);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  // Map session names to friendly Oracle labels
  function label(name: string): string {
    const map: Record<string, string> = {
      "01-bob": "BoB", "02-dev": "Dev", "03-qa": "QA",
      "04-designer": "Designer", "05-researcher": "Researcher",
      "06-writer": "Writer", "07-hr": "HR", "08-aia": "AIA",
      "09-data": "Data", "10-admin": "Admin", "11-botdev": "BotDev",
      "12-creator": "Creator", "99-nobi": "Nobi",
    };
    return map[name] || name;
  }

  // When selecting, use "session:0" as the tmux target (first window)
  function handleChange(sessionName: string) {
    setPtyTarget(`${sessionName}:0`);
  }

  // Current session name (strip :0 window suffix)
  const currentSession = ptyTarget.replace(/:.*$/, "");

  return (
    <select
      value={currentSession}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300 cursor-pointer min-w-[80px]"
    >
      {sessions.length > 0 ? (
        sessions.map((s) => (
          <option key={s.name} value={s.name}>
            {label(s.name)} {s.attached ? "(active)" : ""}
          </option>
        ))
      ) : (
        <option value={currentSession}>{label(currentSession)}</option>
      )}
    </select>
  );
}
