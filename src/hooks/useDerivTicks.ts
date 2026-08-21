import { useEffect, useRef, useState } from "react";
import { getDerivSocket, type ConnectionStatus, type Tick } from "@/lib/deriv-ws";

const MAX_TICKS = 240;

export function useDerivTicks(symbol: string) {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [pipSize, setPipSize] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = getDerivSocket();
    socket.connect();
    let cancelled = false;

    const requestStream = () => {
      setTicks([]);
      setError(null);
      socket.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: MAX_TICKS,
        end: "latest",
        style: "ticks",
        subscribe: 1,
      });
    };

    const offStatus = socket.onStatus((s) => {
      if (cancelled) return;
      setStatus(s);
      if (s === "open") requestStream();
    });

    const offMsg = socket.onMessage((msg) => {
      if (cancelled) return;
      if (msg.error) {
        setError(msg.error.message ?? "Stream error");
        return;
      }
      if (msg.msg_type === "history" && msg.echo_req?.ticks_history === symbol) {
        subIdRef.current = msg.subscription?.id ?? null;
        const { times = [], prices = [] } = msg.history ?? {};
        setTicks(times.map((t: number, i: number) => ({ epoch: t, quote: Number(prices[i]) })));
        if (msg.pip_size) setPipSize(msg.pip_size);
      }
      if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
        subIdRef.current = msg.subscription?.id ?? subIdRef.current;
        setPipSize(msg.tick.pip_size ?? 2);
        setTicks((prev) => {
          const next = [...prev, { epoch: msg.tick.epoch, quote: Number(msg.tick.quote) }];
          return next.length > MAX_TICKS ? next.slice(next.length - MAX_TICKS) : next;
        });
      }
    });

    if (socket.status === "open") requestStream();

    return () => {
      cancelled = true;
      if (subIdRef.current) socket.send({ forget: subIdRef.current });
      subIdRef.current = null;
      offStatus();
      offMsg();
    };
  }, [symbol]);

  return { ticks, status, pipSize, error };
}
