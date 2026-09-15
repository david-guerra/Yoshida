"use client";
import type {ReactNode} from "react";
import {logoutAction} from "@/src/app/login/actions";
export default function LogoutForm({children}: {children:ReactNode}) {
  return <form action={logoutAction} onSubmit={() => {
    const channel = new BroadcastChannel("yoshida-session");
    channel.postMessage({token:null});
    try { localStorage.setItem("yoshida-active-account", ""); } catch { /* Continue signing out. */ }
    channel.close();
    window.dispatchEvent(new Event("yoshida-signout"));
  }}>{children}</form>;
}
