"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PerformanceChart from "../../components/PerformanceChart";
import ShotDistributionChart from "../../components/ShotDistributionChart";
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
  bestAverage: number;
  bestTotal: number | null;
};

type PersonalBest = {
  key: string;
  equipment_id: string | null;
  equipmentName: string;
  distance_m: number | null;
  shooting_position: string | null;
  modeLabel: string;
  average_score: number;
  total_score: number;
  actual_shots: number;
  date: string;
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

type ShotTargetGroup = {
  key: string;
  label: string;
  targetType: TargetType;
  projectileDiameterMm?: number;
  shots: ResultShot[];
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

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [period, setPeriod] = useState<Period>("3m");
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

      // Resultate laden
      const { data, error } = await supabase
        .from("results")
        .select(`
          id,
          date,
          discipline,
          distance_m,
          shooting_position,
          shot_mode,
          planned_shots,
          actual_shots,
          total_score,
          average_score,
          equipment_id
        `)
        .order("date", { ascending: true });

      if (error) {
        setMessage(
          `Fehler beim Laden: ${error.message}`
        );
        setLoading(false);
        return;
      }

      setResults((data ?? []) as Result[]);

      // Sportgeräte separat laden
      const {
        data: equipmentData,
        error: equipmentError,
      } = await supabase
        .from("equipment")
        .select("id, name, category")
        .order("name", { ascending: true });

      if (equipmentError) {
        console.error(
          "Fehler beim Laden der Sportgeräte:",
          equipmentError.message
        );
      } else {
        setEquipment(
          (equipmentData ?? []) as Equipment[]
        );
      }

      // Einzelschüsse laden
      const {
        data: shotsData,
        error: shotsError,
      } = await supabase
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
        setResultShots(
          (shotsData ?? []) as ResultShot[]
        );
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
  const filteredResults = useMemo(() => {
    let filtered = results;

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

      const bestAverage = Math.max(
        ...groupResults.map((result) => Number(result.average_score))
      );

      const bestTotal = isFree
        ? null
        : Math.max(
            ...groupResults.map((result) => Number(result.total_score))
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
        bestAverage,
        bestTotal,
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
  const overallAverage = useMemo(() => {
    const shots =
      filteredResults.reduce(
        (sum, result) =>
          sum +
          Number(
            result.actual_shots
          ),
        0
      );

    const points =
      filteredResults.reduce(
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
  }, [filteredResults]);

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
  ]);

  const averageTrend =
    overallAverage !== null &&
    previousAverage !== null
      ? overallAverage -
        previousAverage
      : null;

  // Persönliche Bestleistungen pro Sportgerät, Distanz,
  // Stellung und Schussmodus/Schusszahl
  const personalBests = useMemo(() => {
    const equipmentNames = new Map(
      equipment.map((item) => [item.id, item.name])
    );

    const map = new Map<string, Result[]>();

    for (const result of filteredResults) {
      const equipmentKey =
        result.equipment_id ?? "unassigned";
      const distanceKey =
        result.distance_m ?? "unassigned";
      const positionKey =
        result.shooting_position ?? "unassigned";
      const modeKey =
        result.shot_mode === "free"
          ? "free"
          : `fixed-${result.actual_shots}`;

      const key = `${equipmentKey}|${distanceKey}|${positionKey}|${modeKey}`;

      const existing = map.get(key) ?? [];
      existing.push(result);
      map.set(key, existing);
    }

    const bests: PersonalBest[] = [];

    for (const [key, groupResults] of map.entries()) {
      const best = [...groupResults].sort((a, b) => {
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

      bests.push({
        key,
        equipment_id: best.equipment_id,
        equipmentName: best.equipment_id
          ? equipmentNames.get(best.equipment_id) ??
            "Unbekanntes Sportgerät"
          : "Sportgerät nicht zugeordnet",
        distance_m: best.distance_m,
        shooting_position: best.shooting_position,
        modeLabel:
          best.shot_mode === "free"
            ? "Freies Training"
            : `${best.actual_shots} Schüsse`,
        average_score: Number(best.average_score),
        total_score: Number(best.total_score),
        actual_shots: Number(best.actual_shots),
        date: best.date,
      });
    }

    return bests.sort((a, b) => {
      const distanceA =
        a.distance_m ?? Number.MAX_SAFE_INTEGER;
      const distanceB =
        b.distance_m ?? Number.MAX_SAFE_INTEGER;

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      const positionCompare =
        getPositionLabel(
          a.shooting_position
        ).localeCompare(
          getPositionLabel(
            b.shooting_position
          ),
          "de"
        );

      if (positionCompare !== 0) {
        return positionCompare;
      }

      const equipmentCompare =
        a.equipmentName.localeCompare(
          b.equipmentName,
          "de"
        );

      if (equipmentCompare !== 0) {
        return equipmentCompare;
      }

      return a.modeLabel.localeCompare(
        b.modeLabel,
        "de"
      );
    });
  }, [filteredResults, equipment]);

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

  // Treffer passend zu den gefilterten Resultaten.
  // Unterschiedliche Scheibentypen werden bewusst getrennt,
  // damit z.B. Armbrust 30 m und Gewehr 300 m nicht
  // auf dieselbe Scheibe gelegt werden.
  const shotTargetGroups = useMemo<ShotTargetGroup[]>(() => {
    const equipmentById = new Map(
      equipment.map((item) => [item.id, item])
    );

    const filteredResultsById = new Map(
      filteredResults.map((result) => [result.id, result])
    );

    const groupsByTarget = new Map<TargetType, ResultShot[]>();

    for (const shot of resultShots) {
      if (
        shot.x_position === null ||
        shot.y_position === null
      ) {
        continue;
      }

      const result = filteredResultsById.get(shot.result_id);

      if (!result) {
        continue;
      }

      const targetType = getTargetTypeForResult(
        result,
        equipmentById
      );

      const current = groupsByTarget.get(targetType) ?? [];
      current.push(shot);
      groupsByTarget.set(targetType, current);
    }

    const order: TargetType[] = [
      "crossbow10m",
      "crossbow30m",
      "rifle10m",
      "rifle50m",
      "rifle300m",
      "default",
    ];

    return order
      .filter((targetType) => (groupsByTarget.get(targetType)?.length ?? 0) > 0)
      .map((targetType) => ({
        key: targetType,
        label: getTargetLabel(targetType),
        targetType,
        projectileDiameterMm:
          targetType === "rifle300m" ? 5.6 : undefined,
        shots: groupsByTarget.get(targetType) ?? [],
      }));
  }, [
    resultShots,
    filteredResults,
    equipment,
  ]);

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
            {/* Performance */}
            <section className="mt-8">
              <PerformanceChart
                results={
                  filteredResults
                }
              />
            </section>

            {/* Trefferlage */}
            {shotTargetGroups.length > 0 && (
              <section className="mt-8 grid gap-6">
                {shotTargetGroups.map((group) => (
                  <ShotDistributionChart
                    key={group.key}
                    shots={group.shots}
                    targetType={group.targetType}
                    title={
                      shotTargetGroups.length > 1
                        ? group.label
                        : undefined
                    }
                    projectileDiameterMm={
                      group.projectileDiameterMm
                    }
                  />
                ))}
              </section>
            )}

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

            {/* Persönliche Bestleistungen */}
            {personalBests.length > 0 && (
              <section className="mt-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    🏆 Persönliche Bestleistungen
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Beste Resultate pro Sportgerät, Distanz,
                    Stellung und Schusszahl für die gewählten Filter.
                  </p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {personalBests.map((best) => (
                    <article
                      key={best.key}
                      className="rounded-2xl border bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            {best.distance_m !== null
                              ? `${best.distance_m} m`
                              : "Distanz nicht zugeordnet"}
                            {" · "}
                            {getPositionLabel(
                              best.shooting_position
                            )}
                          </h3>

                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {best.equipmentName}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          {best.modeLabel}
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            Bester Ø
                          </p>

                          <p className="mt-1 text-2xl font-bold text-red-600">
                            {best.average_score.toFixed(2)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Total
                          </p>

                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {best.total_score.toFixed(0)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Schüsse
                          </p>

                          <p className="mt-1 font-semibold text-slate-900">
                            {best.actual_shots}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Datum
                          </p>

                          <p className="mt-1 font-semibold text-slate-900">
                            {formatDate(best.date)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
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
                            Bester Ø
                          </p>

                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {group.bestAverage.toFixed(
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

                        <div>
                          <p className="text-xs text-slate-500">
                            {group.isFree
                              ? "Bestes Total"
                              : "Bestes Resultat"}
                          </p>

                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {group.bestTotal !==
                            null
                              ? group.bestTotal.toFixed(
                                  0
                                )
                              : "–"}
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
      </div>
    </main>
  );
}
