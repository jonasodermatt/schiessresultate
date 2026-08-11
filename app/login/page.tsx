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

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-2xl text-white">
            ◎
          </div>

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