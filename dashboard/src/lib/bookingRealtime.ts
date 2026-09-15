export type SyncState = "connecting" | "live" | "offline";
const subscriptions = ["bookings/*", "booking_notes/*", "client_preferences/*", "clients/*", "addresses/*", "cleaners/*"];

/** Events invalidate a view; only a successful current authenticated read is data. */
export function connectBookingRealtime(
  pocketBaseUrl: string,
  token: string,
  refreshOrders: () => Promise<boolean | void>,
  setSyncState: (state: SyncState) => void,
) {
  const url = new URL("/api/realtime", pocketBaseUrl);
  let source: EventSource;
  let controller: AbortController;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let accepted = false;
  let generation = 0;
  let refreshId = 0;
  let delay = 1000;

  const refresh = async () => {
    const id = ++refreshId;
    const connection = generation;
    try {
      const current = await refreshOrders();
      if (!closed && id === refreshId && connection === generation && current !== false) {
        setSyncState(accepted ? "live" : "offline");
        if (accepted) delay = 1000;
      }
    } catch {
      if (!closed && id === refreshId) setSyncState("offline");
    }
  };
  const reconnect = () => {
    if (closed) return;
    accepted = false;
    generation++;
    source?.close();
    controller?.abort();
    clearTimeout(timer);
    setSyncState("offline");
    timer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, 30_000);
  };
  const connect = () => {
    if (closed) return;
    const connection = ++generation;
    accepted = false;
    controller = new AbortController();
    source = new EventSource(url);
    setSyncState("connecting");
    // A stream that never produces PB_CONNECT is also a failed connection.
    timer = setTimeout(reconnect, 10_000);
    source.addEventListener("PB_CONNECT", async (event) => {
      if (closed || connection !== generation) return;
      clearTimeout(timer);
      try {
        const response = await fetch(url, {
          body: JSON.stringify({ clientId: (event as MessageEvent).lastEventId, subscriptions }),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (closed || connection !== generation) return;
        if (!response.ok) { reconnect(); return; }
        accepted = true;
        await refresh();
      } catch {
        if (!closed && connection === generation) reconnect();
      }
    });
    for (const subscription of subscriptions) {
      source.addEventListener(subscription, () => {
        if (!closed && accepted && connection === generation) void refresh();
      });
    }
    source.onerror = () => { if (connection === generation) reconnect(); };
  };
  connect();
  const cleanup = () => {
    closed = true;
    generation++;
    clearTimeout(timer);
    controller.abort();
    source.close();
  };
  cleanup.refresh = refresh;
  return cleanup;
}
