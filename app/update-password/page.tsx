"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (password.length < 8) {
      setMessage(
        "Das Passwort muss mindestens 8 Zeichen lang sein."
      );
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(
        `Passwort konnte nicht geändert werden: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setMessage("Passwort wurde erfolgreich geändert.");
    setSaving(false);

    setTimeout(() => {
      router.replace("/dashboard");
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-xl text-white">
            ◎
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Neues Passwort
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Lege ein neues Passwort für dein Konto fest.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Neues Passwort
            </label>

            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Passwort bestätigen
            </label>

            <input
              type="password"
              required
              minLength={8}
              value={passwordConfirm}
              onChange={(event) =>
                setPasswordConfirm(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Wird gespeichert..."
              : "Passwort ändern"}
          </button>

          {message && (
            <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              {message}
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-red-600"
          >
            ← Zurück zum Login
          </Link>
        </div>
      </div>
    </main>
  );
}