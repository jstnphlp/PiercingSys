"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { eyebrow, field, formError, studioButton } from "@/components/ui/studio-styles";
import { login, type LoginState } from "./actions";
import { loginCard, loginDivider } from "./login-styles";

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
  return <div className={loginCard}>
    <p className={eyebrow}>STAFF ACCESS</p><h1>Welcome back.</h1><p>Sign in with the email attached to your Piercing Corner invitation.</p>
    <form className="mt-7 flex flex-col gap-[15px]" action={action}>
      <label className={field}>Email address<input name="email" type="email" required autoComplete="email" /></label>
      <label className={field}>Password<input name="password" type="password" required autoComplete="current-password" /></label>
      {state.error && <p className={formError} role="alert">{state.error}</p>}
      <button className={`${studioButton({ variant: "primary" })} mt-1 w-full`} disabled={pending}>{pending ? <LoaderCircle className="animate-[spin_1.6s_linear_infinite]" size={17} /> : null}{pending ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
    </form>
    <div className={loginDivider}><span>or</span></div>
    <button className="flex min-h-[45px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-studio-line bg-white text-xs font-[750] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:text-base [&>span]:font-black [&>span]:text-[#4285f4]" type="button" disabled={!googleEnabled || googleLoading} onClick={googleLogin}><span>G</span>{googleLoading ? "Opening Google…" : "Continue with Google"}</button>
    {!googleEnabled && <small className="mt-2.5 block text-center leading-[1.45] text-studio-muted">Google sign-in will be available after the studio configures OAuth.</small>}
  </div>;
}
