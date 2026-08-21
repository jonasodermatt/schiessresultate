"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clubs, setClubs] = useState<string[]>([]);
const [newClub, setNewClub] = useState("");

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
        .select("display_name, clubs")
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
        setClubs(data.clubs ?? []);
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  function addClub() {
  const value = newClub.trim();

  if (!value) {
    return;
  }

  if (clubs.includes(value)) {
    setMessage("Dieser Verein ist bereits eingetragen.");
    return;
  }

  setClubs((current) => [...current, value]);
  setNewClub("");
  setMessage("");
}

function removeClub(index: number) {
  setClubs((current) =>
    current.filter((_, currentIndex) => currentIndex !== index)
  );
}

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
          clubs,
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
      className="flex items-center gap-3"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">
        ◎
      </div>

      <div>
        <p className="font-bold text-slate-900">
          EasyShooter
        </p>

        <p className="hidden text-xs text-slate-500 sm:block">
          Deine Resultate. Deine Entwicklung.
        </p>
      </div>
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
    Vereine
  </label>

  {clubs.length > 0 && (
    <div className="mb-3 space-y-2">
      {clubs.map((club, index) => (
        <div
          key={`${club}-${index}`}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <span className="text-sm text-slate-900">
            {club}
          </span>

          <button
            type="button"
            onClick={() => removeClub(index)}
            className="text-sm font-medium text-red-600"
          >
            Entfernen
          </button>
        </div>
      ))}
    </div>
  )}

  <div className="flex gap-2">
    <input
      value={newClub}
      onChange={(event) =>
        setNewClub(event.target.value)
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addClub();
        }
      }}
      placeholder="z.B. Schützenverein Muster"
      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
    />

    <button
      type="button"
      onClick={addClub}
      className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700"
    >
      + Hinzufügen
    </button>
  </div>
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