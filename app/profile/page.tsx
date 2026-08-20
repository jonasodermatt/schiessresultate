"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [club, setClub] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, club")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(
          `Fehler beim Laden des Profils: ${error.message}`
        );
        setLoading(false);
        return;
      }

      if (data) {
        setDisplayName(data.display_name ?? "");
        setClub(data.club ?? "");
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: displayName.trim() || null,
          club: club.trim() || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      setMessage(
        `Fehler beim Speichern: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setMessage("Profil wurde gespeichert.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Profil wird geladen...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            ◎ Schiessresultate
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Mein Profil
          </h1>

          <p className="mt-2 text-slate-600">
            Verwalte deine persönlichen Angaben.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                E-Mail
              </label>

              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
              />

              <p className="mt-1 text-xs text-slate-400">
                Die E-Mail-Adresse stammt aus deinem Benutzerkonto.
              </p>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Anzeigename
              </label>

              <input
                value={displayName}
                onChange={(event) =>
                  setDisplayName(event.target.value)
                }
                placeholder="z.B. Max Muster"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              />
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Verein
              </label>

              <input
                value={club}
                onChange={(event) =>
                  setClub(event.target.value)
                }
                placeholder="z.B. Schützenverein Muster"
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
                : "Profil speichern"}
            </button>

            {message && (
              <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}