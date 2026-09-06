/** Subscribe to PocketBase's named SSE events; return cleanup for the React effect. */
export function connectBookingRealtime(
  pocketBaseUrl: string,
  token: string,
  refreshOrders: () => Promise<void>,
  setSyncState: (state: "connecting" | "live" | "offline") => void,
) {
  const realtimeUrl = new URL("/api/realtime", pocketBaseUrl);
  const source = new EventSource(realtimeUrl);
  const controller = new AbortController();
  let closed = false;

  const refresh = async () => {
    try {
      await refreshOrders();
    } catch {
      if (!closed) setSyncState("offline");
    }
  };

  source.addEventListener("PB_CONNECT", async (event) => {
    if (closed) return;
    setSyncState("connecting");
    try {
      const response = await fetch(realtimeUrl, {
        body: JSON.stringify({
          clientId: (event as MessageEvent<string>).lastEventId,
          subscriptions: ["bookings/*"],
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
        signal: controller.signal,
      });
      if (closed) return;
      if (!response.ok) {
        setSyncState("offline");
        return;
      }
      setSyncState("live");
      // Reconcile records that changed before subscription or during a reconnect.
      await refresh();
    } catch {
      if (!closed) setSyncState("offline");
    }
  });

  source.addEventListener("bookings/*", () => {
    if (!closed) void refresh();
  });
  source.onerror = () => {
    if (!closed) setSyncState("offline");
  };

  return () => {
    closed = true;
    controller.abort();
    source.close();
  };
}
