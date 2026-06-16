import { useEffect, useRef, useCallback } from "react";

type MessageHandler = (data: string | ArrayBuffer) => void;

interface UseWebSocketOptions {
  url: string;
  onMessage: MessageHandler;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectMs?: number;
  binaryType?: BinaryType;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  reconnectMs = 3000,
  binaryType = "arraybuffer",
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = url.startsWith("/") ? `${protocol}//${window.location.host}${url}` : url;
    const ws = new WebSocket(fullUrl);
    ws.binaryType = binaryType;

    ws.onopen = () => onOpen?.();
    ws.onclose = () => {
      onClose?.();
      reconnectTimer.current = setTimeout(connect, reconnectMs);
    };
    ws.onmessage = (e) => onMessage(e.data);

    wsRef.current = ws;
  }, [url, onMessage, onOpen, onClose, reconnectMs, binaryType]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string | ArrayBuffer | Uint8Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send, ws: wsRef };
}
