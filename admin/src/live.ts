import { useEffect, useRef, useState } from "react";
import { auth, type Order } from "./api";

// Живые обновления: сервер шлёт события по SSE, страницы подписываются через useLiveReload.

export type LiveEvent =
  | { type: "hello"; at: number }
  | { type: "order.created"; at: number; order: Order }
  | { type: "order.photo"; at: number; orderId: string; uploaded: number; expected: number }
  | { type: "order.updated"; at: number; orderId: string; statusIndex: number; cancelled: boolean }
  | { type: "reset"; at: number };

const EVENT = "picpac:live";

// Заказы, пришедшие в этой вкладке, — подсвечиваем их в списке.
export const freshOrders = new Set<string>();

export type LiveStatus = "connecting" | "online" | "offline";

export function useLiveConnection(enabled: boolean, onEvent: (e: LiveEvent) => void) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const handler = useRef(onEvent);
  useEffect(() => { handler.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = () => {
      const token = auth.token;
      if (!token || stopped) return;
      setStatus("connecting");
      source = new EventSource(`/api/admin/events?token=${encodeURIComponent(token)}`);
      source.onopen = () => setStatus("online");
      source.onmessage = (msg) => {
        try {
          const e = JSON.parse(msg.data) as LiveEvent;
          if (e.type === "order.created") freshOrders.add(e.order.id);
          handler.current(e);
          window.dispatchEvent(new CustomEvent<LiveEvent>(EVENT, { detail: e }));
        } catch {
          // Битое сообщение пропускаем.
        }
      };
      // EventSource сам переподключается, но после рестарта сервера токен мог устареть —
      // поэтому закрываем и переподключаемся вручную с актуальным токеном.
      source.onerror = () => {
        source?.close();
        setStatus("offline");
        retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [enabled]);

  return status;
}

// Перезагрузить данные страницы, когда пришло подходящее событие (с небольшой задержкой,
// чтобы серия событий — например, загрузка 20 фото — дала одну перезагрузку).
export function useLiveReload(match: (e: LiveEvent) => boolean, reload: () => unknown) {
  const matchRef = useRef(match);
  const reloadRef = useRef(reload);
  useEffect(() => {
    matchRef.current = match;
    reloadRef.current = reload;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (ev: Event) => {
      const e = (ev as CustomEvent<LiveEvent>).detail;
      if (e.type === "hello" || !matchRef.current(e)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reloadRef.current(), 400);
    };
    window.addEventListener(EVENT, on);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVENT, on);
    };
  }, []);
}

// Короткий двухтональный сигнал о новом заказе (Web Audio, без файлов).
let ctx: AudioContext | null = null;
export function chime() {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // Без звука — не страшно.
  }
}

const SOUND_KEY = "picpac.admin.sound";
export const soundPref = {
  get: () => localStorage.getItem(SOUND_KEY) !== "off",
  set: (on: boolean) => localStorage.setItem(SOUND_KEY, on ? "on" : "off"),
};
