"use client";

import { useEffect, useRef, useState } from "react";
import { createBookingReader, BookingReadError, readJson, type OrderDetail, type OrderList, type OrderQuery } from "./orders";
import { createBookingView, type BookingViewState } from "./bookingView";
import { connectBookingRealtime, type SyncState } from "./bookingRealtime";

export type BookingSession = { cleanerId: string; token: string; pocketBaseUrl: string };
type Query = OrderQuery | { kind: "detail"; id: string };

export function useBookingRead<Q extends Query>(session: BookingSession, query: Q) {
  type Data = Q extends {kind: "detail"} ? OrderDetail : OrderList;
  const [snapshot, setSnapshot] = useState<{key:string; value:BookingViewState<Data>}>();
  const [sync, setSync] = useState<SyncState>("connecting");
  const retry = useRef<() => void>(() => {});
  const key = JSON.stringify([session, query]);
  useEffect(() => {
    const [scope, request] = JSON.parse(key) as [BookingSession, Query];
    const view = createBookingView<Data>(async signal => {
      const current = await readJson<{token:string; cleanerId:string}>("/api/cleanvoice/session", {signal});
      if (current.token !== scope.token || current.cleanerId !== scope.cleanerId) throw new BookingReadError("auth");
      const reader = createBookingReader({baseUrl:scope.pocketBaseUrl, token:scope.token, cleanerId:scope.cleanerId, signal});
      const result = request.kind === "detail" ? await reader.detail(request.id) : await reader.list(request);
      return result as Data;
    }, value => {
      setSnapshot({key, value});
      if (value.error?.kind === "auth") stop();
    });
    let stopped = false;
    const realtime = connectBookingRealtime(scope.pocketBaseUrl, scope.token, () => view.refresh(), setSync);
    function stop() { if (!stopped) { stopped = true; realtime(); } }
    const refresh = () => { if (!stopped) void realtime.refresh(); };
    retry.current = refresh;
    // Do not wait for an event stream before attempting an initial read.
    refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    const channel = new BroadcastChannel("yoshida-session");
    const invalidate = () => { view.invalidateSession(); stop(); };
    channel.onmessage = event => { if (event.data?.token !== scope.token) invalidate(); };
    window.addEventListener("yoshida-signout", invalidate);
    const accountChanged = (event: StorageEvent) => {
      if (event.key === "yoshida-active-account" && event.newValue !== scope.cleanerId) invalidate();
    };
    window.addEventListener("storage", accountChanged);
    // Revalidate quiet sessions, too: revoked/expired tokens cannot retain a Live badge indefinitely.
    const timer = setInterval(refresh, 30_000);
    return () => {
      stop(); view.dispose(); clearInterval(timer); channel.close();
      window.removeEventListener("yoshida-signout", invalidate);
      window.removeEventListener("storage", accountChanged);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key]);
  const state: BookingViewState<Data> = snapshot?.key === key ? snapshot.value : {pending:true};
  return { ...state, sync, retry: () => retry.current() };
}
