"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Fehler: ${error.message}`);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleForgotPassword() {
  setMessage("");

  if (!email.trim()) {
    setMessage(
      "Bitte gib zuerst deine E-Mail-Adresse ein."
    );
    return;
  }

  setLoading(true);

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/update-password`,
      }
    );

  if (error) {
    setMessage(
      `Passwort-Reset konnte nicht gesendet werden: ${error.message}`
    );
    setLoading(false);
    return;
  }

  setMessage(
    "Wir haben dir eine E-Mail zum Zurücksetzen des Passworts gesendet."
  );

  setLoading(false);
}

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md">
   <div className="flex items-center justify-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">
      ◎
    </div>

    <div>
      <p className="text-xl font-bold text-slate-900">
        EasyShooter
      </p>

    
    </div>
  </div>

  <div className="mt-8 text-center">
 
 

          <h1 className="text-3xl font-bold text-slate-900">
            Einloggen
          </h1>

          <p className="mt-2 text-slate-600">
            Melde dich an, um deine Schiessresultate zu verwalten.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              E-Mail
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Passwort
            </label>

            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
            <div className="mt-2 text-right">
  <button
    type="button"
    onClick={handleForgotPassword}
    disabled={loading}
    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
  >
    Passwort vergessen?
  </button>
</div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Anmeldung läuft..." : "Einloggen"}
          </button>

          {message && (
            <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}