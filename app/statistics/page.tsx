"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PerformanceChart from "../../components/PerformanceChart";
import ShotDistributionChart from "../../components/ShotDistributionChart";

type Result = {
  id: string;
  date: string;
  discipline: string;
  shot_mode: string;
  planned_shots: number | null;
  actual_shots: number;
  total_score: number;
  average_score: number;
  equipment_id: string | null;
  equipment: {
    name: string;
  } | null;
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

type Period = "30d" | "3m" | "6m" | "12m" | "all";

type ResultShot = {
  id: string;
  result_id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

export default function StatisticsPage() {
  const router = useRouter();

  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [period, setPeriod] = useState<Period>("3m");
  const [disciplineFilter, setDisciplineFilter] =
    useState("all");
const [equipmentFilter, setEquipmentFilter] =
  useState("all");
  const [resultShots, setResultShots] =
  useState<ResultShot[]>([]);

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
          date,
          discipline,
          shot_mode,
          planned_shots,
          actual_shots,
          total_score,
          average_score,
          equipment_id,
equipment (
  name
)
        `)
        .order("date", { ascending: true });

      if (error) {
        setMessage(`Fehler beim Laden: ${error.message}`);
        setLoading(false);
        return;
      }

      setResults((data ?? []) as Result[]);

const { data: shotsData, error: shotsError } =
  await supabase
    .from("result_shots")
    .select(`
      id,
      result_id,
      shot_number,
      score,
      x_position,
      y_position
    `);

if (shotsError) {
  console.error(
    "Fehler beim Laden der Einzelschüsse:",
    shotsError.message
  );
} else {
  setResultShots((shotsData ?? []) as ResultShot[]);
}

setLoading(false);
    }

    loadResults();
  }, [router]);

  const disciplines = useMemo(() => {
    return Array.from(
      new Set(results.map((result) => result.discipline))
    ).sort((a, b) => a.localeCompare(b, "de"));
  }, [results]);

  const equipmentOptions = useMemo(() => {
  const map = new Map<string, string>();

  for (const result of results) {
    if (
      result.equipment_id &&
      result.equipment?.name
    ) {
      map.set(
        result.equipment_id,
        result.equipment.name
      );
    }
  }

  return Array.from(map.entries())
    .map(([id, name]) => ({
      id,
      name,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "de")
    );
}, [results]);
function getPeriodStart(
  referenceDate: Date,
  selectedPeriod: Period
) {
  const start = new Date(referenceDate);

  if (selectedPeriod === "30d") {
    start.setDate(start.getDate() - 30);
  }

  if (selectedPeriod === "3m") {
    start.setMonth(start.getMonth() - 3);
  }

  if (selectedPeriod === "6m") {
    start.setMonth(start.getMonth() - 6);
  }

  if (selectedPeriod === "12m") {
    start.setMonth(start.getMonth() - 12);
  }

  return start;
}

  const filteredResults = useMemo(() => {
    let filtered = results;

    if (period !== "all") {
      const from = new Date();

      if (period === "30d") {
        from.setDate(from.getDate() - 30);
      }

      if (period === "3m") {
        from.setMonth(from.getMonth() - 3);
      }

      if (period === "6m") {
        from.setMonth(from.getMonth() - 6);
      }

      if (period === "12m") {
        from.setMonth(from.getMonth() - 12);
      }

      filtered = filtered.filter(
        (result) => new Date(result.date) >= from
      );
    }

    if (disciplineFilter !== "all") {
      filtered = filtered.filter(
        (result) =>
          result.discipline === disciplineFilter
      );
    }
    if (equipmentFilter !== "all") {
  filtered = filtered.filter(
    (result) =>
      result.equipment_id === equipmentFilter
  );
}

    return filtered;
  }, [
  results,
  period,
  disciplineFilter,
  equipmentFilter,
]);



  const groups = useMemo(() => {
    const map = new Map<string, Result[]>();

    for (const result of filteredResults) {
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
        (sum, result) =>
          sum + Number(result.actual_shots),
        0
      );

      const totalPoints = groupResults.reduce(
        (sum, result) =>
          sum + Number(result.total_score),
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
          totalShots > 0
            ? totalPoints / totalShots
            : 0,
        bestAverage,
        bestTotal,
      });
    }

    return statistics.sort((a, b) => {
      const disciplineCompare =
        a.discipline.localeCompare(
          b.discipline,
          "de"
        );

      if (disciplineCompare !== 0) {
        return disciplineCompare;
      }

      return a.label.localeCompare(b.label, "de");
    });
  }, [filteredResults]);

const overallAverage = useMemo(() => {
  const shots = filteredResults.reduce(
    (sum, result) =>
      sum + Number(result.actual_shots),
    0
  );

  const points = filteredResults.reduce(
    (sum, result) =>
      sum + Number(result.total_score),
    0
  );

  return shots > 0 ? points / shots : null;
}, [filteredResults]);

const previousAverage = useMemo(() => {
  if (period === "all") {
    return null;
  }

  const now = new Date();
  const currentStart = getPeriodStart(now, period);
  const previousStart = getPeriodStart(
    currentStart,
    period
  );

  let previousResults = results.filter((result) => {
    const date = new Date(result.date);

    return (
      date >= previousStart &&
      date < currentStart
    );
  });

  if (disciplineFilter !== "all") {
    previousResults = previousResults.filter(
      (result) =>
        result.discipline === disciplineFilter
    );
  }

  if (equipmentFilter !== "all") {
    previousResults = previousResults.filter(
      (result) =>
        result.equipment_id === equipmentFilter
    );
  }

  const shots = previousResults.reduce(
    (sum, result) =>
      sum + Number(result.actual_shots),
    0
  );

  const points = previousResults.reduce(
    (sum, result) =>
      sum + Number(result.total_score),
    0
  );

  return shots > 0 ? points / shots : null;
}, [
  results,
  period,
  disciplineFilter,
  equipmentFilter,
]);

const averageTrend =
  overallAverage !== null &&
  previousAverage !== null
    ? overallAverage - previousAverage
    : null;

    const bestResult = useMemo(() => {
  if (filteredResults.length === 0) {
    return null;
  }

  return [...filteredResults].sort((a, b) => {
    const averageDifference =
      Number(b.average_score) -
      Number(a.average_score);

    if (averageDifference !== 0) {
      return averageDifference;
    }

    const shotDifference =
      Number(b.actual_shots) -
      Number(a.actual_shots);

    if (shotDifference !== 0) {
      return shotDifference;
    }

    return (
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
    );
  })[0];
}, [filteredResults]);

  const totalShots = useMemo(() => {
    return filteredResults.reduce(
      (sum, result) =>
        sum + Number(result.actual_shots),
      0
    );
  }, [filteredResults]);

  function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
const filteredShots = useMemo(() => {
  const resultIds = new Set(
    filteredResults.map((result) => result.id)
  );

  return resultShots.filter(
    (shot) =>
      resultIds.has(shot.result_id) &&
      shot.x_position !== null &&
      shot.y_position !== null
  );
}, [resultShots, filteredResults]);
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
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

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Zeitraum
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "30d", label: "30 Tage" },
              { value: "3m", label: "3 Monate" },
              { value: "6m", label: "6 Monate" },
              { value: "12m", label: "12 Monate" },
              { value: "all", label: "Alles" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setPeriod(option.value as Period)
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  period === option.value
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 max-w-sm">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Disziplin
          </label>

          <select
            value={disciplineFilter}
            onChange={(event) =>
              setDisciplineFilter(event.target.value)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          >
            <option value="all">
              Alle Disziplinen
            </option>

            {disciplines.map((discipline) => (
              <option
                key={discipline}
                value={discipline}
              >
                {discipline}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 max-w-sm">
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Sportgerät
  </label>

  <select
    value={equipmentFilter}
    onChange={(event) =>
      setEquipmentFilter(event.target.value)
    }
    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
  >
    <option value="all">
      Alle Sportgeräte
    </option>

    {equipmentOptions.map((equipment) => (
      <option
        key={equipment.id}
        value={equipment.id}
      >
        {equipment.name}
      </option>
    ))}
  </select>
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
            <div className="mb-4 text-4xl">
              📊
            </div>

            <h2 className="font-bold text-slate-900">
              Noch keine Statistik verfügbar
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Erfasse zuerst einige Resultate.
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <div className="mb-4 text-4xl">
              🔍
            </div>

            <h2 className="font-bold text-slate-900">
              Keine Resultate gefunden
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Für den gewählten Zeitraum und die
              ausgewählte Disziplin sind keine Resultate
              vorhanden.
            </p>
          </div>
        ) : (
          <>
                      <section className="mt-8">
  <PerformanceChart results={filteredResults} />
</section>
{filteredShots.length > 0 && (
  <section className="mt-8">
    <ShotDistributionChart shots={filteredShots} />
  </section>
)}

            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-sm text-slate-500">
                  Resultate
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {filteredResults.length}
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

  {period !== "all" && (
    <div className="mt-2 text-sm">
      {averageTrend !== null ? (
        <p
          className={
            averageTrend > 0
              ? "font-medium text-green-600"
              : averageTrend < 0
              ? "font-medium text-red-600"
              : "font-medium text-slate-600"
          }
        >
          {averageTrend > 0
            ? "↑ "
            : averageTrend < 0
            ? "↓ "
            : "→ "}
          {averageTrend > 0 ? "+" : ""}
          {averageTrend.toFixed(2)}
          {" "}gegenüber vorherigem Zeitraum
        </p>
      ) : (
        <p className="text-slate-500">
          Kein Vergleichszeitraum vorhanden
        </p>
      )}
    </div>


  )}
</div>

{bestResult && (
  <section className="mt-6">
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            🏆 Persönliche Bestleistung
          </p>

          <h3 className="mt-2 text-xl font-bold text-slate-900">
            {bestResult.discipline}
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            {formatDate(bestResult.date)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:text-right">
          <div>
            <p className="text-xs text-slate-500">
              Durchschnitt
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {Number(
                bestResult.average_score
              ).toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Schüsse
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {bestResult.actual_shots}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Total
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {Number(
                bestResult.total_score
              ).toFixed(0)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Datum
            </p>

            <p className="mt-1 font-semibold text-slate-900">
              {formatDate(bestResult.date)}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
)}
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