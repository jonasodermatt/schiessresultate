"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Result = {
  id: string;
  discipline: string;
  shot_mode: string;
  planned_shots: number | null;
  actual_shots: number;
  total_score: number;
  average_score: number;
};

type StatisticGroup = {
  key: string;
  discipline: string;
  label: string;
  isFree: boolean;
  resultCount: number;
  totalShots: number;
  averagePerShot: number;
  bestAverage: number;
  bestTotal: number | null;
};

export default function StatisticsPage() {
  const router = useRouter();

  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadResults() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("results")
        .select(`
          id,
          discipline,
          shot_mode,
          planned_shots,
          actual_shots,
          total_score,
          average_score
        `);

      if (error) {
        setMessage(`Fehler beim Laden: ${error.message}`);
        setLoading(false);
        return;
      }

      setResults((data ?? []) as Result[]);
      setLoading(false);
    }

    loadResults();
  }, [router]);

  const groups = useMemo(() => {
    const map = new Map<string, Result[]>();

    for (const result of results) {
      const isFree = result.shot_mode === "free";

      const key = isFree
        ? `${result.discipline}|free`
        : `${result.discipline}|${result.actual_shots}`;

      const existing = map.get(key) ?? [];
      existing.push(result);
      map.set(key, existing);
    }

    const statistics: StatisticGroup[] = [];

    for (const [key, groupResults] of map.entries()) {
      const first = groupResults[0];
      const isFree = first.shot_mode === "free";

      const totalShots = groupResults.reduce(
        (sum, result) => sum + Number(result.actual_shots),
        0
      );

      const totalPoints = groupResults.reduce(
        (sum, result) => sum + Number(result.total_score),
        0
      );

      const bestAverage = Math.max(
        ...groupResults.map((result) =>
          Number(result.average_score)
        )
      );

      const bestTotal = isFree
        ? null
        : Math.max(
            ...groupResults.map((result) =>
              Number(result.total_score)
            )
          );

      statistics.push({
        key,
        discipline: first.discipline,
        label: isFree
          ? "Freies Training"
          : `${first.actual_shots} Schüsse`,
        isFree,
        resultCount: groupResults.length,
        totalShots,
        averagePerShot:
          totalShots > 0 ? totalPoints / totalShots : 0,
        bestAverage,
        bestTotal,
      });
    }

    return statistics.sort((a, b) => {
      const disciplineCompare = a.discipline.localeCompare(
        b.discipline,
        "de"
      );

      if (disciplineCompare !== 0) {
        return disciplineCompare;
      }

      return a.label.localeCompare(b.label, "de");
    });
  }, [results]);

  const overallAverage = useMemo(() => {
    const shots = results.reduce(
      (sum, result) => sum + Number(result.actual_shots),
      0
    );

    const points = results.reduce(
      (sum, result) => sum + Number(result.total_score),
      0
    );

    return shots > 0 ? points / shots : null;
  }, [results]);

  const totalShots = useMemo(
    () =>
      results.reduce(
        (sum, result) => sum + Number(result.actual_shots),
        0
      ),
    [results]
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
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

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Statistiken
          </h1>

          <p className="mt-2 text-slate-600">
            Vergleiche deine Leistungen nach Disziplin und
            Schusszahl.
          </p>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-slate-500">
            Statistiken werden geladen...
          </p>
        ) : results.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <div className="mb-4 text-4xl">📊</div>

            <h2 className="font-bold text-slate-900">
              Noch keine Statistik verfügbar
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Erfasse zuerst einige Resultate.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-sm text-slate-500">
                  Resultate
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {results.length}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-sm text-slate-500">
                  Schüsse insgesamt
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalShots}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-sm text-slate-500">
                  Ø pro Schuss
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {overallAverage !== null
                    ? overallAverage.toFixed(2)
                    : "–"}
                </p>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">
                Nach Disziplin und Schusszahl
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {groups.map((group) => (
                  <article
                    key={group.key}
                    className="rounded-2xl border bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {group.discipline}
                        </h3>

                        <p className="mt-1 font-medium text-red-600">
                          {group.label}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {group.resultCount}{" "}
                        {group.resultCount === 1
                          ? "Resultat"
                          : "Resultate"}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          Ø pro Schuss
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {group.averagePerShot.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Bester Ø
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {group.bestAverage.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Schüsse insgesamt
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {group.totalShots}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          {group.isFree
                            ? "Bestes Total"
                            : "Bestes Resultat"}
                        </p>

                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {group.bestTotal !== null
                            ? group.bestTotal.toFixed(0)
                            : "–"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}