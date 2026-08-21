// Authenticated Deriv WS client. Each instance owns one connection bound to one API token.
// Handles authorize, balance stream, portfolio, proposal stream, buy, sell, transactions.

export type DerivMsg = Record<string, any>;

export const DERIV_APP_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_DERIV_APP_ID) || "1089";

export const DERIV_OAUTH_URL = (redirect: string) =>
  `https://oauth.deriv.com/oauth2/authorize?app_id=${DERIV_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}`;

const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

type Pending = { resolve: (v: any) => void; reject: (e: any) => void };
type SubHandler = (msg: DerivMsg) => void;

export class DerivClient {
  private ws: WebSocket | null = null;
  private reqId = 1;
  private pending = new Map<number, Pending>();
  private subs = new Map<string, SubHandler>(); // subscription id -> handler
  private authorized = false;
  private token: string;
  private onStatusCb?: (s: "connecting" | "open" | "closed" | "error") => void;
  private queue: string[] = [];
  private closedByUser = false;

  constructor(token: string) {
    this.token = token;
  }

  onStatus(cb: (s: "connecting" | "open" | "closed" | "error") => void) {
    this.onStatusCb = cb;
  }

  connect(): Promise<DerivMsg> {
    this.closedByUser = false;
    this.onStatusCb?.("connecting");
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;
      ws.onopen = () => {
        this.onStatusCb?.("open");
        for (const q of this.queue) ws.send(q);
        this.queue = [];
        this.send({ authorize: this.token })
          .then((r) => {
            this.authorized = true;
            resolve(r);
          })
          .catch(reject);
      };
      ws.onerror = () => {
        this.onStatusCb?.("error");
        reject(new Error("Deriv WS error"));
      };
      ws.onclose = () => {
        this.onStatusCb?.("closed");
        this.authorized = false;
        this.pending.forEach((p) => p.reject(new Error("WS closed")));
        this.pending.clear();
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
    });
  }

  close() {
    this.closedByUser = true;
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }

  private handleMessage(raw: string) {
    let msg: DerivMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const reqId = msg.req_id as number | undefined;
    const subId = msg.subscription?.id as string | undefined;
    if (subId && this.subs.has(subId)) this.subs.get(subId)!(msg);
    if (reqId && this.pending.has(reqId)) {
      const p = this.pending.get(reqId)!;
      this.pending.delete(reqId);
      if (msg.error) p.reject(new Error(msg.error.message || "Deriv error"));
      else p.resolve(msg);
    }
  }

  send(payload: DerivMsg): Promise<DerivMsg> {
    return new Promise((resolve, reject) => {
      const reqId = this.reqId++;
      const body = JSON.stringify({ ...payload, req_id: reqId });
      this.pending.set(reqId, { resolve, reject });
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(body);
      else this.queue.push(body);
    });
  }

  subscribe(payload: DerivMsg, handler: SubHandler): Promise<{ subId: string; first: DerivMsg }> {
    return new Promise((resolve, reject) => {
      const reqId = this.reqId++;
      const body = JSON.stringify({ ...payload, subscribe: 1, req_id: reqId });
      let subIdCaptured: string | null = null;
      this.pending.set(reqId, {
        resolve: (msg: DerivMsg) => {
          const sid = msg.subscription?.id;
          if (sid) {
            subIdCaptured = sid;
            this.subs.set(sid, handler);
          }
          handler(msg);
          resolve({ subId: subIdCaptured || "", first: msg });
        },
        reject,
      });
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(body);
      else this.queue.push(body);
    });
  }

  async forget(subId: string) {
    if (!subId) return;
    this.subs.delete(subId);
    try {
      await this.send({ forget: subId });
    } catch {}
  }
}
