"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Fehler: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage(
      "Konto wurde erstellt. Bitte prüfe deine E-Mails und bestätige deine Adresse."
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
            Konto erstellen
          </h1>

          <p className="mt-2 text-slate-600">
            Starte mit deinen persönlichen Schiessresultaten.
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
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-red-500"
              placeholder="name@beispiel.ch"
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
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-red-500"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Konto wird erstellt..." : "Konto erstellen"}
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