"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Stitch = {
  id: string;
  name: string;
  sort_order: number;
};

type RankingRow = {
  shooting_event_id: string;
  registration_stitch_id: string;
  event_stitch_id: string;
  stitch_name: string;
  sort_order: number;
  program_id: string | null;
  program_code: string | null;
  program_name: string | null;
  scoring_type: string | null;
  ranking_type: "total" | "best" | "best_n" | "section" | "special" | null;
  best_n: number | null;
  special_code: string | null;
  registration_id: string;
  shooter_id: string;
  master_number: number;
  first_name: string;
  last_name: string;
  birth_year: number | null;
  weapon_id: string | null;
  weapon_name: string | null;
  status: string;
  registered_passes: number;
  pass_count: number;
  shot_count: number;
  total_score: number;
  series_total: number;
  tie_break_score: number | null;
  hit_count: number;
  ranked_shots: number[];
};

function compareNumbersDesc(
  a: number | null | undefined,
  b: number | null | undefined
) {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;

  if (av === bv) return 0;
  return bv - av;
}

function compareArraysDesc(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? Number.NEGATIVE_INFINITY;
    const bv = b[index] ?? Number.NEGATIVE_INFINITY;

    if (av !== bv) {
      return bv - av;
    }
  }

  return 0;
}

function compareAge(
  a: number | null,
  b: number | null
) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  // Kleineres Geburtsjahr = älter.
  return a - b;
}

function bestNTotal(row: RankingRow) {
  const n = row.best_n ?? 0;

  return row.ranked_shots
    .slice(0, n)
    .reduce((sum, score) => sum + score, 0);
}

function cumulativeShots(
  shots: number[],
  maxScore?: number
) {
  if (shots.length === 0) return "–";

  const counts = new Map<number, number>();

  for (const score of shots) {
    counts.set(
      score,
      (counts.get(score) ?? 0) + 1
    );
  }

  const upper =
    maxScore ??
    Math.max(...shots);

  const parts: string[] = [];

  for (let score = upper; score >= 0; score -= 1) {
    const count = counts.get(score) ?? 0;

    if (count > 0) {
      parts.push(`${count}×${score}`);
    }
  }

  return parts.join(" / ");
}

function rankingTotal(row: RankingRow) {
  if (row.special_code === "RUETLI") {
    return row.total_score + row.hit_count;
  }

  if (row.ranking_type === "best_n") {
    return bestNTotal(row);
  }

  if (row.ranking_type === "best") {
    return row.ranked_shots[0] ?? 0;
  }

  return row.total_score;
}

function compareRankingRows(a: RankingRow, b: RankingRow) {
  let result = 0;

  if (a.special_code === "RUETLI") {
    result = compareNumbersDesc(
      a.total_score + a.hit_count,
      b.total_score + b.hit_count
    );

    if (result !== 0) return result;

    result = compareArraysDesc(
      a.ranked_shots,
      b.ranked_shots
    );

    if (result !== 0) return result;
  } else if (a.ranking_type === "section") {
    result = compareNumbersDesc(
      a.total_score,
      b.total_score
    );

    if (result !== 0) return result;

    result = compareNumbersDesc(
      a.tie_break_score,
      b.tie_break_score
    );

    if (result !== 0) return result;

    result = compareNumbersDesc(
      a.series_total,
      b.series_total
    );

    if (result !== 0) return result;
  } else if (a.ranking_type === "best") {
    result = compareArraysDesc(
      a.ranked_shots,
      b.ranked_shots
    );

    if (result !== 0) return result;
  } else if (a.ranking_type === "best_n") {
    const n = a.best_n ?? 0;

    result = compareNumbersDesc(
      bestNTotal(a),
      bestNTotal(b)
    );

    if (result !== 0) return result;

    result = compareArraysDesc(
      a.ranked_shots.slice(n),
      b.ranked_shots.slice(n)
    );

    if (result !== 0) return result;
  } else {
    result = compareNumbersDesc(
      a.total_score,
      b.total_score
    );

    if (result !== 0) return result;

    result = compareArraysDesc(
      a.ranked_shots,
      b.ranked_shots
    );

    if (result !== 0) return result;
  }

  result = compareAge(
    a.birth_year,
    b.birth_year
  );

  if (result !== 0) return result;

  return a.master_number - b.master_number;
}

function resultText(row: RankingRow) {
  if (row.special_code === "RUETLI") {
    return String(
      row.total_score + row.hit_count
    );
  }

  if (row.ranking_type === "best_n") {
    return String(bestNTotal(row));
  }

  if (row.ranking_type === "best") {
    return String(row.ranked_shots[0] ?? 0);
  }

  return String(row.total_score);
}

function detailText(row: RankingRow) {
  if (row.special_code === "RUETLI") {
    return `${cumulativeShots(
      row.ranked_shots,
      5
    )} + ${row.hit_count} Treffer`;
  }

  if (row.ranking_type === "section") {
    return `TS ${row.tie_break_score ?? "–"} · Serie ${row.series_total}`;
  }

  if (row.program_code === "A10-E10") {
    return cumulativeShots(
      row.ranked_shots,
      10
    );
  }

  if (row.ranking_type === "best") {
    return String(
      row.ranked_shots[1] ?? "–"
    );
  }

  if (row.ranking_type === "best_n") {
    const n = row.best_n ?? 0;

    const nextFive = row.ranked_shots.slice(
      n,
      n + 5
    );

    return nextFive.length > 0
      ? nextFive.join(" / ")
      : "–";
  }

  return row.ranked_shots.join(", ");
}

export default function ShootingEventRankingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [selectedStitchId, setSelectedStitchId] = useState("");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setLoading(true);

      const { data: eventData, error: eventError } =
        await supabase
          .from("shooting_events")
          .select("id, name")
          .eq("id", eventId)
          .single();

      if (eventError || !eventData) {
        setMessage(
          `Anlass konnte nicht geladen werden: ${
            eventError?.message ?? "Nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      setEventName(eventData.name);

      const { data: stitchData, error: stitchError } =
        await supabase
          .from("shooting_event_stitches")
          .select("id, name, sort_order")
          .eq("shooting_event_id", eventId)
          .eq("active", true)
          .order("sort_order");

      if (stitchError) {
        setMessage(
          `Stiche konnten nicht geladen werden: ${stitchError.message}`
        );
        setLoading(false);
        return;
      }

      const loadedStitches =
        (stitchData ?? []) as Stitch[];

      setStitches(loadedStitches);

      if (loadedStitches.length > 0) {
        setSelectedStitchId(
          loadedStitches[0].id
        );
      }

      setLoading(false);
    }

    loadData();
  }, [eventId, router]);

  useEffect(() => {
    async function loadRanking() {
      if (!selectedStitchId) {
        setRows([]);
        return;
      }

      setLoadingRanking(true);
      setMessage("");

      const { data, error } = await supabase
        .from("shooting_event_ranking_base")
        .select("*")
        .eq("shooting_event_id", eventId)
        .eq("event_stitch_id", selectedStitchId)
        .eq("status", "completed");

      if (error) {
        setMessage(
          `Rangliste konnte nicht geladen werden: ${error.message}`
        );
        setRows([]);
        setLoadingRanking(false);
        return;
      }

      setRows(
        ((data ?? []) as RankingRow[]).map(
          (row) => ({
            ...row,
            ranked_shots:
              row.ranked_shots ?? [],
          })
        )
      );

      setLoadingRanking(false);
    }

    loadRanking();
  }, [eventId, selectedStitchId]);

  const rankedRows = useMemo(() => {
    return [...rows].sort(
      compareRankingRows
    );
  }, [rows]);

  const selectedStitch = stitches.find(
    (stitch) =>
      stitch.id === selectedStitchId
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-600">
          Ranglisten werden geladen...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 print:bg-white">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .ranking-card {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .ranking-table {
            font-size: 10pt;
          }

          .ranking-table thead {
            display: table-header-group;
          }

          .ranking-table tr {
            break-inside: avoid;
          }
        }

        .print-only {
          display: none;
        }
      `}</style>

      <header className="no-print border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            EasyShooter
          </Link>

          <Link
            href="/dashboard"
            className="text-sm text-slate-600"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="no-print flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {eventName}
            </h1>

            <p className="mt-1 text-slate-600">
              Ranglisten
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50"
          >
            Rangliste drucken
          </button>
        </div>

        <section className="no-print mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <label className="form-label">
            Stich
          </label>

          <select
            value={selectedStitchId}
            onChange={(event) =>
              setSelectedStitchId(
                event.target.value
              )
            }
            className="form-select"
          >
            {stitches.map((stitch) => (
              <option
                key={stitch.id}
                value={stitch.id}
              >
                {stitch.name}
              </option>
            ))}
          </select>
        </section>

        <div className="print-only mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {eventName}
          </h1>

          <p className="mt-1 text-lg font-semibold text-slate-700">
            Rangliste · {selectedStitch?.name ?? ""}
          </p>
        </div>

        <section className="ranking-card mt-8 rounded-2xl border bg-white p-6 shadow-sm print:mt-0">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedStitch?.name ?? "Rangliste"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {rankedRows.length} klassierte Schützen
              </p>
            </div>
          </div>

          {loadingRanking ? (
            <p className="mt-5 text-slate-500">
              Rangliste wird geladen...
            </p>
          ) : rankedRows.length === 0 ? (
            <p className="mt-5 text-slate-500">
              Noch keine abgeschlossenen Resultate.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto print:overflow-visible">
              <table className="ranking-table w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600">
                    <th className="py-2 pr-3">
                      Rang
                    </th>
                    <th className="py-2 pr-3">
                      Schütze
                    </th>
                    <th className="py-2 pr-3">
                      Jg.
                    </th>
                    <th className="py-2 pr-3">
                      Sportgerät
                    </th>
                    <th className="py-2 pr-3 text-right">
                      Resultat
                    </th>
                    <th className="py-2">
                      Rangierung
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rankedRows.map((row, index) => (
                    <tr
                      key={row.registration_stitch_id}
                      className="border-b border-slate-200"
                    >
                      <td className="py-2 pr-3 font-bold">
                        {index + 1}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {row.last_name}{" "}
                        {row.first_name}
                      </td>

                      <td className="py-2 pr-3">
                        {row.birth_year ?? "–"}
                      </td>

                      <td className="py-2 pr-3">
                        {row.weapon_name ?? "–"}
                      </td>

                      <td className="py-2 pr-3 text-right text-base font-bold">
                        {resultText(row)}
                      </td>

                      <td className="py-2 text-xs text-slate-600">
                        {detailText(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {message && (
            <div className="no-print mt-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
