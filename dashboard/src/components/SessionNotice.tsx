"use client";
import { useEffect } from "react";

/** Announce sign-in/sign-out across tabs without persisting credentials. */
export default function SessionNotice({token, cleanerId}: {token:string | null; cleanerId:string}) {
  useEffect(() => {
    const channel = new BroadcastChannel("yoshida-session");
    channel.postMessage({token});
    try { localStorage.setItem("yoshida-active-account", cleanerId); } catch { /* Cookie reconciliation remains authoritative. */ }
    return () => channel.close();
  }, [token, cleanerId]);
  return null;
}
