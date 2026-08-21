"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Result = {
  id: string;
  date: string;
  discipline: string;
  actual_shots: number;
  total_score: number;
  average_score: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [resultCount, setResultCount] = useState(0);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [latestResult, setLatestResult] = useState<Result | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("results")
        .select(
          "id, date, discipline, actual_shots, total_score, average_score"
        )
        .order("date", { ascending: false });

      if (error) {
        console.error("Fehler beim Laden der Resultate:", error.message);
        setLoading(false);
        return;
      }

      const results = (data ?? []) as Result[];

      setResultCount(results.length);

      if (results.length > 0) {
        const average =
          results.reduce(
            (sum, result) => sum + Number(result.average_score),
            0
          ) / results.length;

        setAverageScore(average);

        const best = Math.max(
          ...results.map((result) => Number(result.total_score))
        );

        setBestScore(best);

        setLatestResult(results[0]);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Dashboard wird geladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">
              ◎
            </div>

            <div>
              <p className="font-bold text-slate-900">
                Easyshooter
              </p>

              <p className="hidden text-xs text-slate-500 sm:block">
                Deine Resultate. Deine Entwicklung.
              </p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ausloggen
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="mb-8">
          <p className="text-sm text-slate-500">
            Angemeldet als {email}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Mein Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Hier findest du deine Resultate, Sportgeräte und Statistiken.
          </p>
        </section>

        <section className="mb-8">
          <Link
            href="/results/new"
            className="inline-flex rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            + Neues Resultat
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/results"
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 text-3xl">🎯</div>
            <h2 className="font-bold text-slate-900">
              Meine Resultate
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Trainings und Resultate ansehen.
            </p>
          </Link>

          <Link
            href="/equipment"
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 text-3xl">🔫</div>
            <h2 className="font-bold text-slate-900">
              Sportgeräte
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Sportgeräte verwalten.
            </p>
          </Link>

          <Link
            href="/statistics"
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 text-3xl">📊</div>
            <h2 className="font-bold text-slate-900">
              Statistiken
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Deine Entwicklung analysieren.
            </p>
          </Link>

          <Link
            href="/profile"
            className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 text-3xl">👤</div>
            <h2 className="font-bold text-slate-900">
              Profil
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Persönliche Angaben verwalten.
            </p>
          </Link>
          <Link
  href="/shooting-ranges"
  className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
>
  <div className="mb-4 text-3xl">🏟️</div>

  <h2 className="font-bold text-slate-900">
    Schiessstände
  </h2>

  <p className="mt-2 text-sm text-slate-600">
    Schiessstände suchen, favorisieren und verwalten.
  </p>
</Link>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Resultate
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {resultCount}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Durchschnitt
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {averageScore !== null
                ? averageScore.toFixed(2)
                : "–"}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Durchschnitt pro Schuss
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Höchstes Total
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {bestScore !== null
                ? bestScore.toFixed(0)
                : "–"}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Letztes Resultat
          </h2>

          {latestResult ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {formatDate(latestResult.date)}
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    {latestResult.discipline}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    {latestResult.actual_shots} Schüsse
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-3xl font-bold text-slate-900">
                    {Number(latestResult.total_score).toFixed(0)}
                  </p>

                  <p className="text-sm text-slate-500">
                    Ø{" "}
                    {Number(
                      latestResult.average_score
                    ).toFixed(2)}
                  </p>
                </div>
              </div>

              <Link
                href="/results"
                className="mt-5 inline-block text-sm font-semibold text-red-600"
              >
                Alle Resultate ansehen →
              </Link>

            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
              <p className="text-slate-500">
                Noch kein Resultat vorhanden.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}