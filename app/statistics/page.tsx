"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { StatisticsPerformance, StatisticsTendencies, type TendencyGroup } from "./StatisticsCharts";
import { averageOf, bestOf, validResult, type ScoringType } from "./statistics-data";
import type { TargetType } from "../../components/Target";

type Result = {
  id: string;
  date: string;
  discipline: string;
  distance_m: number | null;
  shooting_position: string | null;
  shot_mode: string;
  planned_shots: number | null;
  actual_shots: number;
  total_score: number;
  average_score: number;
  equipment_id: string | null;
  scoring_type: ScoringType | null;
};

type Equipment = {
  id: string;
  name: string;
  category: string | null;
};

type StatisticGroup = {
  key: string;
  distance_m: number | null;
  shooting_position: string | null;
  label: string;
  isFree: boolean;
  resultCount: number;
  totalShots: number;
  averagePerShot: number;
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

function getTargetTypeForResult(
  result: Result,
  equipmentById: Map<string, Equipment>
): TargetType {
  const selectedEquipment = result.equipment_id
    ? equipmentById.get(result.equipment_id)
    : undefined;

  const equipmentCategory =
    selectedEquipment?.category?.toLowerCase() ?? "";

  const equipmentName =
    selectedEquipment?.name.toLowerCase() ?? "";

  const isCrossbow =
    equipmentCategory.includes("armbrust") ||
    equipmentName.includes("armbrust");

  const isRifle =
    equipmentCategory.includes("gewehr") ||
    equipmentName.includes("gewehr");

  if (isCrossbow && result.distance_m === 10) return "crossbow10m";
  if (isCrossbow && result.distance_m === 30) return "crossbow30m";
  if (isRifle && result.distance_m === 10) return "rifle10m";
  if (isRifle && result.distance_m === 50) return "rifle50m";
  if (isRifle && result.distance_m === 300) return "rifle300m";

  return "default";
}

function getTargetLabel(targetType: TargetType) {
  const labels: Record<TargetType, string> = {
    default: "Weitere Scheiben",
    crossbow10m: "Armbrust 10 m",
    crossbow30m: "Armbrust 30 m",
    rifle10m: "Gewehr 10 m",
    rifle50m: "Gewehr 50 m",
    rifle300m: "Gewehr 300 m",
  };

  return labels[targetType];
}

function getPositionLabel(position: string | null) {
  if (!position) return "Nicht zugeordnet";

  const labels: Record<string, string> = {
    prone: "Liegend",
    standing: "Stehend",
    kneeling: "Kniend",
    sitting: "Sitzend",
    supported: "Aufgelegt",
    other: "Andere",
  };

  return labels[position] ?? position;
}

export default function StatisticsPage() {
  const router = useRouter();

  const [results, setResults] = useState<Result[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [resultShots, setResultShots] = useState<ResultShot[]>([]);

  const [scoringFilter, setScoringFilter] = useState<ScoringType>("A10");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [period, setPeriod] = useState<Period>("30d");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] =
    useState("all");

  useEffect(() => {
    async function loadResults() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Load every page: Supabase's default row limit must not truncate statistics.
      try {
        const allResults: Result[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("results")
            .select("id,date,discipline,shooting_position,shot_mode,planned_shots,actual_shots,total_score,average_score,equipment_id,distance_m,scoring_type")
            .eq("user_id", user.id).order("date", { ascending: true }).order("id")
            .range(from, from + 999);
          if (error) throw error;
          allResults.push(...((data ?? []) as Result[]));
          if (!data || data.length < 1000) break;
        }
        const { data: equipmentData, error: equipmentError } = await supabase
          .from("equipment").select("id,name,category").order("name");
        if (equipmentError) throw equipmentError;
        const allShots: ResultShot[] = [];
        for (let offset = 0; offset < allResults.length; offset += 100) {
          const ids = allResults.slice(offset, offset + 100).map((result) => result.id);
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase.from("result_shots")
              .select("id,result_id,shot_number,score,x_position,y_position")
              .in("result_id", ids).order("id").range(from, from + 999);
            if (error) throw error;
            allShots.push(...((data ?? []) as ResultShot[]));
            if (!data || data.length < 1000) break;
          }
        }
        setResults(allResults);
        setEquipment((equipmentData ?? []) as Equipment[]);
        setResultShots(allShots);
      } catch (error) {
        const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "Unbekannter Fehler";
        setMessage(`Statistik konnte nicht vollständig geladen werden: ${detail}`);
      }
      setLoading(false);
    }

    loadResults();
  }, [router]);

  // Verfügbare Distanzen aus den Resultaten
  const distances = useMemo(() => {
    return Array.from(
      new Set(
        results
          .map((result) => result.distance_m)
          .filter((distance): distance is number => distance !== null)
      )
    ).sort((a, b) => a - b);
  }, [results]);

  // Verfügbare Stellungen aus den Resultaten
  const positions = useMemo(() => {
    return Array.from(
      new Set(
        results
          .map((result) => result.shooting_position)
          .filter((position): position is string => position !== null && position !== "")
      )
    ).sort((a, b) =>
      getPositionLabel(a).localeCompare(getPositionLabel(b), "de")
    );
  }, [results]);

  const hasUnassignedDistance = results.some(
    (result) => result.distance_m === null
  );

  const hasUnassignedPosition = results.some(
    (result) => !result.shooting_position
  );

  // Nur Sportgeräte anzeigen, die in mindestens
  // einem Resultat verwendet wurden
  const equipmentOptions = useMemo(() => {
    const usedEquipmentIds = new Set(
      results
        .map(
          (result) => result.equipment_id
        )
        .filter(
          (id): id is string =>
            id !== null
        )
    );

    return equipment
      .filter((item) =>
        usedEquipmentIds.has(item.id)
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, "de")
      );
  }, [equipment, results]);

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

  // Resultate anhand der gewählten Filter
  const positionResults = useMemo(() => {
    let filtered = results.filter((result) => Number.isFinite(new Date(result.date).getTime()));

    if (period !== "all") {
      const from = new Date();

      if (period === "30d") {
        from.setDate(
          from.getDate() - 30
        );
      }

      if (period === "3m") {
        from.setMonth(
          from.getMonth() - 3
        );
      }

      if (period === "6m") {
        from.setMonth(
          from.getMonth() - 6
        );
      }

      if (period === "12m") {
        from.setMonth(
          from.getMonth() - 12
        );
      }

      filtered = filtered.filter(
        (result) =>
          new Date(result.date) >= from
      );
    }

    if (distanceFilter !== "all") {
      filtered = filtered.filter((result) =>
        distanceFilter === "unassigned"
          ? result.distance_m === null
          : result.distance_m === Number(distanceFilter)
      );
    }

    if (positionFilter !== "all") {
      filtered = filtered.filter((result) =>
        positionFilter === "unassigned"
          ? !result.shooting_position
          : result.shooting_position === positionFilter
      );
    }

    if (equipmentFilter !== "all") {
      filtered = filtered.filter(
        (result) =>
          result.equipment_id ===
          equipmentFilter
      );
    }

    return filtered;
  }, [
    results,
    period,
    distanceFilter,
    positionFilter,
    equipmentFilter,
  ]);

  const filteredResults = useMemo(() => positionResults.filter((result) =>
    (result.scoring_type ?? "A10") === scoringFilter && validResult(result)
  ), [positionResults, scoringFilter]);

  const positionedTotalShots = useMemo(() => positionResults.reduce((sum, result) => {
    const count = Number(result.actual_shots);
    return sum + (Number.isInteger(count) && count > 0 ? count : 0);
  }, 0), [positionResults]);

  // Statistikgruppen nach Distanz, Stellung und Schusszahl
  const groups = useMemo(() => {
    const map = new Map<string, Result[]>();

    for (const result of filteredResults) {
      const isFree = result.shot_mode === "free";
      const distanceKey = result.distance_m ?? "unassigned";
      const positionKey = result.shooting_position ?? "unassigned";
      const shotKey = isFree ? "free" : result.actual_shots;
      const key = `${distanceKey}|${positionKey}|${shotKey}`;

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

      statistics.push({
        key,
        distance_m: first.distance_m,
        shooting_position: first.shooting_position,
        label: isFree ? "Freies Training" : `${first.actual_shots} Schüsse`,
        isFree,
        resultCount: groupResults.length,
        totalShots,
        averagePerShot: totalShots > 0 ? totalPoints / totalShots : 0,
      });
    }

    return statistics.sort((a, b) => {
      const resultCountDifference = b.resultCount - a.resultCount;
      if (resultCountDifference !== 0) return resultCountDifference;

      const distanceA = a.distance_m ?? Number.MAX_SAFE_INTEGER;
      const distanceB = b.distance_m ?? Number.MAX_SAFE_INTEGER;
      if (distanceA !== distanceB) return distanceA - distanceB;

      const positionCompare = getPositionLabel(a.shooting_position).localeCompare(
        getPositionLabel(b.shooting_position),
        "de"
      );
      if (positionCompare !== 0) return positionCompare;

      return a.label.localeCompare(b.label, "de");
    });
  }, [filteredResults]);

  // Gesamtdurchschnitt
  const overallAverage = useMemo(() => averageOf(filteredResults), [filteredResults]);

  // Vergleich mit vorherigem Zeitraum
  const previousAverage = useMemo(() => {
    if (period === "all") {
      return null;
    }

    const now = new Date();

    const currentStart =
      getPeriodStart(
        now,
        period
      );

    const previousStart =
      getPeriodStart(
        currentStart,
        period
      );

    let previousResults =
      results.filter((result) => {
        const date =
          new Date(result.date);

        return (
          validResult(result) &&
          (result.scoring_type ?? "A10") === scoringFilter &&
          date >= previousStart &&
          date < currentStart
        );
      });

    if (distanceFilter !== "all") {
      previousResults = previousResults.filter((result) =>
        distanceFilter === "unassigned"
          ? result.distance_m === null
          : result.distance_m === Number(distanceFilter)
      );
    }

    if (positionFilter !== "all") {
      previousResults = previousResults.filter((result) =>
        positionFilter === "unassigned"
          ? !result.shooting_position
          : result.shooting_position === positionFilter
      );
    }

    if (
      equipmentFilter !== "all"
    ) {
      previousResults =
        previousResults.filter(
          (result) =>
            result.equipment_id ===
            equipmentFilter
        );
    }

    const shots =
      previousResults.reduce(
        (sum, result) =>
          sum +
          Number(
            result.actual_shots
          ),
        0
      );

    const points =
      previousResults.reduce(
        (sum, result) =>
          sum +
          Number(
            result.total_score
          ),
        0
      );

    return shots > 0
      ? points / shots
      : null;
  }, [
    results,
    period,
    distanceFilter,
    positionFilter,
    equipmentFilter,
    scoringFilter,
  ]);

  const averageTrend =
    overallAverage !== null &&
    previousAverage !== null
      ? overallAverage -
        previousAverage
      : null;

  const bestResult = useMemo(() => bestOf(filteredResults), [filteredResults]);

  // Anzahl Schüsse
  const totalShots = useMemo(() => {
    return filteredResults.reduce(
      (sum, result) =>
        sum +
        Number(
          result.actual_shots
        ),
      0
    );
  }, [filteredResults]);

  const tendencyGroups = useMemo(() => {
    const byResult = new Map(positionResults.map((result) => [result.id, result]));
    const byEquipment = new Map(equipment.map((item) => [item.id, item]));
    const groups = new Map<string, TendencyGroup>();
    for (const shot of resultShots) {
      if (shot.x_position === null || shot.y_position === null ||
          !Number.isFinite(Number(shot.x_position)) || !Number.isFinite(Number(shot.y_position)) ||
          Math.abs(Number(shot.x_position)) > 1 || Math.abs(Number(shot.y_position)) > 1) continue;
      const result = byResult.get(shot.result_id);
      if (!result) continue;
      const item = result.equipment_id ? byEquipment.get(result.equipment_id) : undefined;
      const targetType = getTargetTypeForResult(result, byEquipment);
      const key = targetType === "default" ? `default|${result.equipment_id}|${result.distance_m}|${result.discipline}` : targetType;
      const title = targetType === "default" ? `${item?.name ?? "Sportgerät"} · ${result.discipline}` : getTargetLabel(targetType);
      const group = groups.get(key) ?? { key, title, targetType, shots: [] };
      group.shots.push(shot);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [positionResults, resultShots, equipment]);

  function formatDate(
    date: string
  ) {
    return new Intl.DateTimeFormat(
      "de-CH",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    ).format(new Date(date));
  }

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
                Deine Resultate.
                Deine Entwicklung.
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
            Vergleiche deine Leistungen nach Distanz, Stellung,
            Sportgerät und Schusszahl.
          </p>
        </div>

        {/* Zeitraum */}
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Zeitraum
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "30d",
                label: "30 Tage",
              },
              {
                value: "3m",
                label: "3 Monate",
              },
              {
                value: "6m",
                label: "6 Monate",
              },
              {
                value: "12m",
                label: "12 Monate",
              },
              {
                value: "all",
                label: "Alles",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setPeriod(
                    option.value as Period
                  )
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  period ===
                  option.value
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distanz und Stellung */}
        <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Distanz
            </label>

            <select
              value={distanceFilter}
              onChange={(event) => setDistanceFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="all">Alle Distanzen</option>
              {distances.map((distance) => (
                <option key={distance} value={String(distance)}>
                  {distance} m
                </option>
              ))}
              {hasUnassignedDistance && (
                <option value="unassigned">Nicht zugeordnet</option>
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Stellung
            </label>

            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="all">Alle Stellungen</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {getPositionLabel(position)}
                </option>
              ))}
              {hasUnassignedPosition && (
                <option value="unassigned">Nicht zugeordnet</option>
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 max-w-sm">
          <label htmlFor="scoringFilter" className="mb-2 block text-sm font-medium text-slate-700">Wertungsart</label>
          <select id="scoringFilter" value={scoringFilter} onChange={(event) => setScoringFilter(event.target.value as ScoringType)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900">
            <option value="A10">A10</option><option value="A100">A100</option><option value="A5">A5</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Bestleistung und Punktedurchschnitt gelten für die gewählte Wertungsart. Die Trefferlage umfasst immer A5, A10 und A100.</p>
        </div>

        {/* Sportgerät */}
        <div className="mt-4 max-w-sm">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Sportgerät
          </label>

          <select
            value={
              equipmentFilter
            }
            onChange={(event) =>
              setEquipmentFilter(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          >
            <option value="all">
              Alle Sportgeräte
            </option>

            {equipmentOptions.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              )
            )}
          </select>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-slate-500">
            Statistiken werden
            geladen...
          </p>
        ) : results.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <div className="mb-4 text-4xl">
              📊
            </div>

            <h2 className="font-bold text-slate-900">
              Noch keine Statistik
              verfügbar
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Erfasse zuerst einige
              Resultate.
            </p>
          </div>
        ) : filteredResults.length ===
          0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <div className="mb-4 text-4xl">
              🔍
            </div>

            <h2 className="font-bold text-slate-900">
              Keine Resultate
              gefunden
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Für die gewählten
              Filter sind keine
              Resultate vorhanden.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <StatisticsPerformance results={filteredResults} scoringType={scoringFilter} />
            </section>

            {/* Kennzahlen */}
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-sm text-slate-500">
                  Resultate
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {
                    filteredResults.length
                  }
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
                  {overallAverage !==
                  null
                    ? overallAverage.toFixed(
                        2
                      )
                    : "–"}
                </p>

                {period !== "all" && (
                  <div className="mt-2 text-sm">
                    {averageTrend !==
                    null ? (
                      <p
                        className={
                          averageTrend >
                          0
                            ? "font-medium text-green-600"
                            : averageTrend <
                                0
                              ? "font-medium text-red-600"
                              : "font-medium text-slate-600"
                        }
                      >
                        {averageTrend >
                        0
                          ? "↑ "
                          : averageTrend <
                              0
                            ? "↓ "
                            : "→ "}
                        {averageTrend >
                        0
                          ? "+"
                          : ""}
                        {averageTrend.toFixed(
                          2
                        )}{" "}
                        gegenüber
                        vorherigem
                        Zeitraum
                      </p>
                    ) : (
                      <p className="text-slate-500">
                        Kein
                        Vergleichszeitraum
                        vorhanden
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Bestleistung */}
            {bestResult && (
              <section className="mt-6">
                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        🏆 Bestleistung der Filterauswahl
                      </p>

                      <p className="mt-1 text-xs text-slate-500">Bester Schnitt pro Schuss · {scoringFilter}. Bei Gleichstand zählt zuerst die Schusszahl, dann das neuere Datum.</p>
                      <h3 className="mt-2 text-xl font-bold text-slate-900">
                        {
                          `${bestResult.distance_m ?? "–"} m · ${getPositionLabel(bestResult.shooting_position)}`
                        }
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{equipment.find((item) => item.id === bestResult.equipment_id)?.name ?? "Sportgerät nicht zugeordnet"}</p>

                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(
                          bestResult.date
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:text-right">
                      <div>
                        <p className="text-xs text-slate-500">
                          Durchschnitt
                        </p>

                        <p className="mt-1 text-2xl font-bold text-red-600">
                          {Number(
                            bestResult.total_score / bestResult.actual_shots
                          ).toFixed(
                            2
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Schüsse
                        </p>

                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {
                            bestResult.actual_shots
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Total
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {Number(
                            bestResult.total_score
                          ).toFixed(
                            0
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Datum
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {formatDate(
                            bestResult.date
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Gruppen */}
            <section className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">
                Nach Distanz, Stellung und Schusszahl
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {groups.map(
                  (group) => (
                    <article
                      key={
                        group.key
                      }
                      className="rounded-2xl border bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            {group.distance_m !== null
                              ? `${group.distance_m} m`
                              : "Distanz nicht zugeordnet"}
                            {" · "}
                            {getPositionLabel(group.shooting_position)}
                          </h3>

                          <p className="mt-1 font-medium text-red-600">
                            {
                              group.label
                            }
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          {
                            group.resultCount
                          }{" "}
                          {group.resultCount ===
                          1
                            ? "Resultat"
                            : "Resultate"}
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            Ø pro
                            Schuss
                          </p>

                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {group.averagePerShot.toFixed(
                              2
                            )}
                          </p>
                        </div>



                        <div>
                          <p className="text-xs text-slate-500">
                            Schüsse
                            insgesamt
                          </p>

                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {
                              group.totalShots
                            }
                          </p>
                        </div>


                      </div>
                    </article>
                  )
                )}
              </div>
            </section>
          </>
        )}
        {!loading && positionResults.length > 0 && (
          <section className="mt-8">
            <StatisticsTendencies groups={tendencyGroups} totalShots={positionedTotalShots} />
          </section>
        )}
      </div>
    </main>
  );
}
