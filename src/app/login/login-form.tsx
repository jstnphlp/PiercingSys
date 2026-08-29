"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: "" };

export function LoginForm({ googleEnabled, appUrl }: { googleEnabled: boolean; appUrl: string }) {
  const [state, action, pending] = useActionState(login, initialState);
  const [googleLoading, setGoogleLoading] = useState(false);
  async function googleLogin() {
    if (!googleEnabled) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${appUrl}/auth/callback` } });
    if (error) setGoogleLoading(false);
  }
  return <div className="login-card">
    <p className="eyebrow">STAFF ACCESS</p><h1>Welcome back.</h1><p>Sign in with the email attached to your Piercing Corner invitation.</p>
    <form action={action}>
      <label className="field">Email address<input name="email" type="email" required autoComplete="email" /></label>
      <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : null}{pending ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
    </form>
    <div className="login-divider"><span>or</span></div>
    <button className="google-button" type="button" disabled={!googleEnabled || googleLoading} onClick={googleLogin}><span>G</span>{googleLoading ? "Opening Google…" : "Continue with Google"}</button>
    {!googleEnabled && <small className="oauth-note">Google sign-in will be available after the studio configures OAuth.</small>}
  </div>;
}
