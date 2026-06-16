import { useEffect, useRef, useCallback } from "react";

type MessageHandler = (data: string | ArrayBuffer) => void;

interface UseWebSocketOptions {
  url: string;
  onMessage: MessageHandler;
  onOpen?: () => void;
  onClose?: () => void;
  binaryType?: BinaryType;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RETRIES = 10;

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  binaryType = "arraybuffer",
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const retriesRef = useRef(0);
  // Store callbacks in refs to avoid reconnect loops from dep changes
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  const connect = useCallback(() => {
    // Close any existing socket first
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    if (retriesRef.current >= MAX_RETRIES) {
      console.warn(`[ws] ${url} — max retries (${MAX_RETRIES}) reached, stopping`);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = url.startsWith("/") ? `${protocol}//${window.location.host}${url}` : url;

    try {
      const ws = new WebSocket(fullUrl);
      ws.binaryType = binaryType;

      ws.onopen = () => {
        retriesRef.current = 0; // reset on success
        onOpenRef.current?.();
      };

      ws.onclose = () => {
        wsRef.current = null;
        onCloseRef.current?.();
        // Exponential backoff
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, retriesRef.current), RECONNECT_MAX_MS);
        retriesRef.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror — don't double-reconnect
      };

      ws.onmessage = (e) => onMessageRef.current(e.data);
      wsRef.current = ws;
    } catch {
      // WebSocket constructor can throw if too many connections
      const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, retriesRef.current), RECONNECT_MAX_MS);
      retriesRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [url, binaryType]); // stable deps only

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      retriesRef.current = MAX_RETRIES; // prevent reconnect during cleanup
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((data: string | ArrayBuffer | Uint8Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send, ws: wsRef };
}
