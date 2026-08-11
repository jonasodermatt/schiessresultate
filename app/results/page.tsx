"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Shot = {
  id: string;
  shot_number: number;
  score: number;
};

type Equipment = {
  name: string;
};

type Result = {
  id: string;
  date: string;
  discipline: string;
  input_type: string;
  shot_mode: string;
  planned_shots: number | null;
  actual_shots: number;
  total_score: number;
  average_score: number;
  notes: string | null;
  equipment: Equipment | Equipment[] | null;
  result_shots: Shot[];
};

export default function ResultsPage() {
  const router = useRouter();

  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadResults = useCallback(async () => {
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
        date,
        discipline,
        input_type,
        shot_mode,
        planned_shots,
        actual_shots,
        total_score,
        average_score,
        notes,
        equipment (
          name
        ),
        result_shots (
          id,
          shot_number,
          score
        )
      `)
      .order("date", { ascending: false });

    if (error) {
      setMessage(`Fehler beim Laden: ${error.message}`);
      setLoading(false);
      return;
    }

    setResults((data ?? []) as Result[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  function getEquipmentName(result: Result) {
    if (!result.equipment) return "Kein Sportgerät";

    if (Array.isArray(result.equipment)) {
      return result.equipment[0]?.name ?? "Kein Sportgerät";
    }

    return result.equipment.name;
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
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

      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Meine Resultate
            </h1>

            <p className="mt-2 text-slate-600">
              Deine bisherigen Trainings und Resultate.
            </p>
          </div>

          <Link
            href="/results/new"
            className="rounded-xl bg-red-600 px-5 py-3 text-center font-semibold text-white hover:bg-red-700"
          >
            + Neues Resultat
          </Link>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-slate-500">
            Resultate werden geladen...
          </p>
        ) : results.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <div className="mb-4 text-4xl">🎯</div>

            <h2 className="font-bold text-slate-900">
              Noch keine Resultate
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Erfasse dein erstes Schiessresultat.
            </p>

            <Link
              href="/results/new"
              className="mt-5 inline-block rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
            >
              Resultat erfassen
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {results.map((result) => {
              const shots = [...(result.result_shots ?? [])].sort(
                (a, b) => a.shot_number - b.shot_number
              );

              return (
                <article
                  key={result.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">
                        {formatDate(result.date)}
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        {result.discipline}
                      </h2>

                      <p className="mt-1 text-sm text-slate-600">
                        🔫 {getEquipmentName(result)}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-3xl font-bold text-slate-900">
                        {Number(result.total_score).toFixed(0)}
                      </p>

                      <p className="text-sm text-slate-500">
                        {result.actual_shots} Schüsse · Ø{" "}
                        {Number(result.average_score).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {result.input_type === "individual" &&
                    shots.length > 0 && (
                      <div className="mt-5 border-t pt-5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Einzelschüsse
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {shots.map((shot) => (
                            <span
                              key={shot.id}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-800"
                              title={`Schuss ${shot.shot_number}`}
                            >
                              {Number(shot.score)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {result.input_type === "total" && (
                    <div className="mt-5 border-t pt-5">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Nur Total erfasst
                      </span>
                    </div>
                  )}

                  {result.shot_mode === "free" && (
                    <p className="mt-4 text-sm font-medium text-slate-500">
                      Freies Training
                    </p>
                  )}

                  {result.notes && (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        {result.notes}
                      </p>
                    </div>
                  )}
                  <div className="mt-5 border-t pt-4">
  <Link
    href={`/results/${result.id}`}
    className="font-semibold text-red-600 hover:text-red-700"
  >
    Details ansehen →
  </Link>
</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}