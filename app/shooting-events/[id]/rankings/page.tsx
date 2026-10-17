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

type EventGroup = {
  id: string;
  name: string;
  max_members: number | null;
};

type EventGroupMember = {
  id: string;
  group_id: string;
  registration_id: string;
};

type GroupRankingRow = {
  group: EventGroup;
  members: RankingRow[];
  total: number;
  individualResults: number[];
  totalAge: number | null;
};

type Combination = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  tie_break_mode: "age_older" | "age_younger" | "stitch" | "alphabetical";
  tie_break_stitch_id: string | null;
};

type CombinationStitch = {
  id: string;
  combination_id: string;
  event_stitch_id: string;
  weight_percent: number;
  sort_order: number;
};

type CombinationRankingRow = {
  shooterId: string;
  registrationId: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  details: {
    stitchId: string;
    stitchName: string;
    result: number;
    weight: number;
    weighted: number;
  }[];
  total: number;
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

function categoryForBirthYear(birthYear: number | null, eventYear: number | null) {
  if (birthYear === null || eventYear === null) return "–";
  const age = eventYear - birthYear;
  if (age >= 10 && age <= 16) return "JJ";
  if (age <= 20 && age >= 17) return "J";
  if (age <= 45 && age >= 21) return "E";
  if (age <= 59 && age >= 46) return "S";
  if (age <= 69 && age >= 60) return "V";
  if (age >= 70) return "SV";
  return "–";
}

export default function ShootingEventRankingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [eventYear, setEventYear] = useState<number | null>(null);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [selectedStitchId, setSelectedStitchId] = useState("");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"individual" | "groups" | "combinations">("individual");
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<EventGroupMember[]>([]);
  const [groupRows, setGroupRows] = useState<RankingRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupRankingStitchId, setGroupRankingStitchId] = useState<string | null>(null);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [combinationStitches, setCombinationStitches] = useState<CombinationStitch[]>([]);
  const [selectedCombinationId, setSelectedCombinationId] = useState("");
  const [combinationRows, setCombinationRows] = useState<RankingRow[]>([]);
  const [loadingCombination, setLoadingCombination] = useState(false);

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
          .select("id, name, event_date, group_ranking_stitch_id")
          .eq("owner_id", user.id)
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
      setEventYear(eventData.event_date ? Number(eventData.event_date.slice(0, 4)) : null);
      setGroupRankingStitchId(eventData.group_ranking_stitch_id ?? null);

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

      const { data: combinationData, error: combinationError } =
        await supabase
          .from("shooting_event_combinations")
          .select("id, name, description, sort_order, tie_break_mode, tie_break_stitch_id")
          .eq("shooting_event_id", eventId)
          .eq("active", true)
          .order("sort_order")
          .order("name");

      if (combinationError) {
        setMessage(
          `Kombinationen konnten nicht geladen werden: ${combinationError.message}`
        );
        setLoading(false);
        return;
      }

      const loadedCombinations =
        (combinationData ?? []) as Combination[];

      setCombinations(loadedCombinations);

      if (loadedCombinations.length > 0) {
        setSelectedCombinationId(loadedCombinations[0].id);
      }

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

  useEffect(() => {
    async function loadCombinationRanking() {
      if (
        viewMode !== "combinations" ||
        !selectedCombinationId
      ) {
        return;
      }

      setLoadingCombination(true);
      setMessage("");

      const { data: combinationStitchData, error: combinationStitchError } =
        await supabase
          .from("shooting_event_combination_stitches")
          .select(
            "id, combination_id, event_stitch_id, weight_percent, sort_order"
          )
          .eq("combination_id", selectedCombinationId)
          .order("sort_order");

      if (combinationStitchError) {
        setMessage(
          `Kombination konnte nicht geladen werden: ${combinationStitchError.message}`
        );
        setCombinationStitches([]);
        setCombinationRows([]);
        setLoadingCombination(false);
        return;
      }

      const configured =
        ((combinationStitchData ?? []) as CombinationStitch[]).map(
          (row) => ({
            ...row,
            weight_percent: Number(row.weight_percent),
          })
        );

      setCombinationStitches(configured);

      if (configured.length === 0) {
        setCombinationRows([]);
        setLoadingCombination(false);
        return;
      }

      const stitchIds = configured.map(
        (row) => row.event_stitch_id
      );

      const { data, error } = await supabase
        .from("shooting_event_ranking_base")
        .select("*")
        .eq("shooting_event_id", eventId)
        .eq("status", "completed")
        .in("event_stitch_id", stitchIds);

      if (error) {
        setMessage(
          `Kombinationsrangliste konnte nicht geladen werden: ${error.message}`
        );
        setCombinationRows([]);
        setLoadingCombination(false);
        return;
      }

      setCombinationRows(
        ((data ?? []) as RankingRow[]).map((row) => ({
          ...row,
          ranked_shots: row.ranked_shots ?? [],
        }))
      );

      setLoadingCombination(false);
    }

    void loadCombinationRanking();
  }, [eventId, selectedCombinationId, viewMode]);

  useEffect(() => {
    async function loadGroupRanking() {
      if (viewMode !== "groups") return;

      setLoadingGroups(true);
      setMessage("");

      const rankingStitch = groupRankingStitchId
        ? stitches.find(
            (stitch) => stitch.id === groupRankingStitchId
          )
        : null;

      if (!rankingStitch) {
        setGroups([]);
        setGroupMembers([]);
        setGroupRows([]);
        setMessage(
          "Für die Gruppenrangliste ist noch kein Wertungsstich konfiguriert."
        );
        setLoadingGroups(false);
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from("shooting_event_groups")
        .select("id, name, max_members")
        .eq("shooting_event_id", eventId)
        .eq("active", true)
        .order("name");

      if (groupError) {
        setMessage(`Gruppen konnten nicht geladen werden: ${groupError.message}`);
        setLoadingGroups(false);
        return;
      }

      const loadedGroups = (groupData ?? []) as EventGroup[];
      setGroups(loadedGroups);

      if (loadedGroups.length === 0) {
        setGroupMembers([]);
        setGroupRows([]);
        setLoadingGroups(false);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("shooting_event_group_members")
        .select("id, group_id, registration_id")
        .in("group_id", loadedGroups.map((group) => group.id));

      if (memberError) {
        setMessage(`Gruppenmitglieder konnten nicht geladen werden: ${memberError.message}`);
        setLoadingGroups(false);
        return;
      }

      const loadedMembers = (memberData ?? []) as EventGroupMember[];
      setGroupMembers(loadedMembers);

      const registrationIds = Array.from(
        new Set(loadedMembers.map((member) => member.registration_id))
      );

      if (registrationIds.length === 0) {
        setGroupRows([]);
        setLoadingGroups(false);
        return;
      }

      const { data: rankingData, error: rankingError } = await supabase
        .from("shooting_event_ranking_base")
        .select("*")
        .eq("shooting_event_id", eventId)
        .eq("event_stitch_id", rankingStitch.id)
        .eq("status", "completed")
        .in("registration_id", registrationIds);

      if (rankingError) {
        setMessage(`Gruppenresultate konnten nicht geladen werden: ${rankingError.message}`);
        setGroupRows([]);
        setLoadingGroups(false);
        return;
      }

      setGroupRows(
        ((rankingData ?? []) as RankingRow[]).map((row) => ({
          ...row,
          ranked_shots: row.ranked_shots ?? [],
        }))
      );

      setLoadingGroups(false);
    }

    void loadGroupRanking();
  }, [eventId, stitches, viewMode, groupRankingStitchId]);

  const rankedRows = useMemo(() => {
    return [...rows].sort(
      compareRankingRows
    );
  }, [rows]);

  const groupRanking = useMemo<GroupRankingRow[]>(() => {
    const rowByRegistrationId = new Map(
      groupRows.map((row) => [row.registration_id, row])
    );

    return groups
      .map((group) => {
        const memberRows = groupMembers
          .filter((member) => member.group_id === group.id)
          .map((member) => rowByRegistrationId.get(member.registration_id))
          .filter((row): row is RankingRow => Boolean(row))
          .sort((a, b) => {
            const resultDifference =
              b.total_score - a.total_score;

            if (resultDifference !== 0) {
              return resultDifference;
            }

            const lastNameCompare =
              a.last_name.localeCompare(
                b.last_name,
                "de-CH"
              );

            if (lastNameCompare !== 0) {
              return lastNameCompare;
            }

            return a.first_name.localeCompare(
              b.first_name,
              "de-CH"
            );
          });

        const individualResults = memberRows
          .map((row) => row.total_score)
          .sort((a, b) => b - a);

        const total = individualResults.reduce((sum, result) => sum + result, 0);

        const ages = memberRows.map((row) =>
          row.birth_year !== null && eventYear !== null
            ? eventYear - row.birth_year
            : null
        );

        const totalAge =
          ages.length > 0 && ages.every((age) => age !== null)
            ? (ages as number[]).reduce((sum, age) => sum + age, 0)
            : null;

        return {
          group,
          members: memberRows,
          total,
          individualResults,
          totalAge,
        };
      })
      .filter((entry) => entry.members.length > 0)
      .sort((a, b) => {
        let result = compareNumbersDesc(a.total, b.total);
        if (result !== 0) return result;

        result = compareArraysDesc(a.individualResults, b.individualResults);
        if (result !== 0) return result;

        result = compareNumbersDesc(a.totalAge, b.totalAge);
        if (result !== 0) return result;

        return a.group.name.localeCompare(b.group.name, "de-CH");
      });
  }, [groups, groupMembers, groupRows, eventYear]);

  const selectedCombination = combinations.find(
    (combination) =>
      combination.id === selectedCombinationId
  );

  const combinationRanking = useMemo<CombinationRankingRow[]>(() => {
    if (
      !selectedCombinationId ||
      combinationStitches.length === 0
    ) {
      return [];
    }

    const stitchByIdLocal = new Map(
      stitches.map((stitch) => [
        stitch.id,
        stitch,
      ])
    );

    const rowsByRegistration = new Map<
      string,
      RankingRow[]
    >();

    for (const row of combinationRows) {
      const existing =
        rowsByRegistration.get(row.registration_id) ?? [];

      existing.push(row);
      rowsByRegistration.set(
        row.registration_id,
        existing
      );
    }

    const ranking: CombinationRankingRow[] = [];

    for (const [registrationId, registrationRows] of rowsByRegistration) {
      const rowByStitch = new Map(
        registrationRows.map((row) => [
          row.event_stitch_id,
          row,
        ])
      );

      // Nur vollständig geschossene Kombinationen klassieren.
      if (
        combinationStitches.some(
          (configured) =>
            !rowByStitch.has(
              configured.event_stitch_id
            )
        )
      ) {
        continue;
      }

      const firstRow = registrationRows[0];

      const details = combinationStitches
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((configured) => {
          const row = rowByStitch.get(
            configured.event_stitch_id
          )!;

          const result = rankingTotal(row);
          const weight =
            Number(configured.weight_percent);

          return {
            stitchId:
              configured.event_stitch_id,
            stitchName:
              stitchByIdLocal.get(
                configured.event_stitch_id
              )?.name ?? row.stitch_name,
            result,
            weight,
            weighted:
              (result * weight) / 100,
          };
        });

      ranking.push({
        shooterId: firstRow.shooter_id,
        registrationId,
        firstName: firstRow.first_name,
        lastName: firstRow.last_name,
        birthYear: firstRow.birth_year,
        details,
        total: details.reduce(
          (sum, detail) =>
            sum + detail.weighted,
          0
        ),
      });
    }

    return ranking.sort((a, b) => {
      const totalDifference =
        b.total - a.total;

      if (
        Math.abs(totalDifference) >
        0.000001
      ) {
        return totalDifference;
      }

      const mode =
        selectedCombination?.tie_break_mode ??
        "age_older";

      if (
        mode === "stitch" &&
        selectedCombination?.tie_break_stitch_id
      ) {
        const aDetail = a.details.find(
          (detail) =>
            detail.stitchId ===
            selectedCombination.tie_break_stitch_id
        );

        const bDetail = b.details.find(
          (detail) =>
            detail.stitchId ===
            selectedCombination.tie_break_stitch_id
        );

        const stitchDifference =
          (bDetail?.result ?? 0) -
          (aDetail?.result ?? 0);

        if (stitchDifference !== 0) {
          return stitchDifference;
        }
      }

      if (mode === "age_older") {
        const ageCompare = compareAge(
          a.birthYear,
          b.birthYear
        );

        if (ageCompare !== 0) {
          return ageCompare;
        }
      }

      if (mode === "age_younger") {
        const youngerCompare =
          (b.birthYear ?? -1) -
          (a.birthYear ?? -1);

        if (youngerCompare !== 0) {
          return youngerCompare;
        }
      }

      const lastNameCompare =
        a.lastName.localeCompare(
          b.lastName,
          "de-CH"
        );

      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }

      return a.firstName.localeCompare(
        b.firstName,
        "de-CH"
      );
    });
  }, [
    selectedCombinationId,
    combinationStitches,
    combinationRows,
    stitches,
    selectedCombination,
  ]);

  const selectedStitch = stitches.find(
    (stitch) =>
      stitch.id === selectedStitchId
  );

  const groupRankingStitch = groupRankingStitchId
    ? stitches.find(
        (stitch) =>
          stitch.id === groupRankingStitchId
      )
    : undefined;

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode("individual")}
              className={`rounded-lg px-4 py-2 font-semibold ${
                viewMode === "individual"
                  ? "bg-slate-900 text-white"
                  : "border bg-white text-slate-700"
              }`}
            >
              Einzelstiche
            </button>
            <button
              type="button"
              onClick={() => setViewMode("groups")}
              className={`rounded-lg px-4 py-2 font-semibold ${
                viewMode === "groups"
                  ? "bg-slate-900 text-white"
                  : "border bg-white text-slate-700"
              }`}
            >
              Gruppen
            </button>
            <button
              type="button"
              onClick={() => setViewMode("combinations")}
              className={`rounded-lg px-4 py-2 font-semibold ${
                viewMode === "combinations"
                  ? "bg-slate-900 text-white"
                  : "border bg-white text-slate-700"
              }`}
            >
              Kombinationen
            </button>
          </div>

          {viewMode === "individual" && (
            <div className="mt-5">
              <label className="form-label">Stich</label>
              <select
                value={selectedStitchId}
                onChange={(event) => setSelectedStitchId(event.target.value)}
                className="form-select"
              >
                {stitches.map((stitch) => (
                  <option key={stitch.id} value={stitch.id}>
                    {stitch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {viewMode === "combinations" && (
            <div className="mt-5">
              <label className="form-label">
                Kombination
              </label>

              <select
                value={selectedCombinationId}
                onChange={(event) =>
                  setSelectedCombinationId(
                    event.target.value
                  )
                }
                className="form-select"
              >
                {combinations.length === 0 && (
                  <option value="">
                    Keine Kombination vorhanden
                  </option>
                )}

                {combinations.map(
                  (combination) => (
                    <option
                      key={combination.id}
                      value={combination.id}
                    >
                      {combination.name}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </section>

        <div className="print-only mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {eventName}
          </h1>

          <p className="mt-1 text-lg font-semibold text-slate-700">
            {viewMode === "groups"
              ? `Gruppenrangliste · ${groupRankingStitch?.name ?? "nicht konfiguriert"}`
              : viewMode === "combinations"
                ? `Rangliste · ${selectedCombination?.name ?? "Kombination"}`
                : `Rangliste · ${selectedStitch?.name ?? ""}`}
          </p>
        </div>

        {viewMode === "groups" && (
          <section className="ranking-card mt-8 rounded-2xl border bg-white p-6 shadow-sm print:mt-0">
            <div className="no-print">
              <h2 className="text-xl font-bold text-slate-900">
                Gruppenrangliste · {groupRankingStitch?.name ?? "nicht konfiguriert"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Gesamtresultat · höhere Einzelresultate · höheres Gesamtalter als Stichentscheid
              </p>
            </div>

            {loadingGroups ? (
              <p className="mt-5 text-slate-500">Gruppenrangliste wird geladen...</p>
            ) : groupRanking.length === 0 ? (
              <p className="mt-5 text-slate-500">
                Noch keine Gruppen mit abgeschlossenen Resultaten im konfigurierten Wertungsstich.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto print:overflow-visible">
                <table className="ranking-table w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-600">
                      <th className="py-2 pr-3">Rang</th>
                      <th className="py-2 pr-3">Gruppe</th>
                      <th className="py-2 pr-3">Schützen / Resultate</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRanking.map((entry, index) => (
                      <tr key={entry.group.id} className="border-b border-slate-200 align-top">
                        <td className="py-2 pr-3 font-bold">{index + 1}</td>
                        <td className="py-2 pr-3 font-semibold">{entry.group.name}</td>
                        <td className="py-2 pr-3">
                          <div className="space-y-1">
                            {entry.members.map((member) => (
                              <div
                                key={member.registration_id}
                                className="flex min-w-72 items-center justify-between gap-4"
                              >
                                <span>
                                  {member.last_name} {member.first_name}
                                </span>
                                <span className="font-semibold tabular-nums">
                                  {member.total_score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 text-right text-base font-bold">
                          {entry.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {viewMode === "combinations" && (
          <section className="ranking-card mt-8 rounded-2xl border bg-white p-6 shadow-sm print:mt-0">
            <div className="no-print">
              <h2 className="text-xl font-bold text-slate-900">
                {selectedCombination?.name ?? "Kombination"}
              </h2>

              {selectedCombination?.description && (
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCombination.description}
                </p>
              )}

              <p className="mt-1 text-sm text-slate-500">
                Gewichtung wird für das Total intern berücksichtigt
              </p>
            </div>

            {loadingCombination ? (
              <p className="mt-5 text-slate-500">
                Kombinationsrangliste wird geladen...
              </p>
            ) : combinations.length === 0 ? (
              <p className="mt-5 text-slate-500">
                Noch keine Kombination eingerichtet.
              </p>
            ) : combinationStitches.length === 0 ? (
              <p className="mt-5 text-slate-500">
                Dieser Kombination sind noch keine Stiche zugeteilt.
              </p>
            ) : combinationRanking.length === 0 ? (
              <p className="mt-5 text-slate-500">
                Noch kein Schütze hat alle für diese Kombination benötigten Stiche abgeschlossen.
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
                        Kategorie
                      </th>

                      {combinationStitches
                        .slice()
                        .sort(
                          (a, b) =>
                            a.sort_order -
                            b.sort_order
                        )
                        .map((configured) => (
                          <th
                            key={configured.id}
                            className="py-2 pr-3 text-right"
                          >
                            {stitches.find(
                              (stitch) =>
                                stitch.id ===
                                configured.event_stitch_id
                            )?.name ?? "Stich"}
                            <div className="text-xs font-normal text-slate-400">
                              {Number(
                                configured.weight_percent
                              )} %
                            </div>
                          </th>
                        ))}

                      <th className="py-2 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {combinationRanking.map(
                      (entry, index) => (
                        <tr
                          key={
                            entry.registrationId
                          }
                          className="border-b border-slate-200"
                        >
                          <td className="py-2 pr-3 font-bold">
                            {index + 1}
                          </td>

                          <td className="py-2 pr-3 font-medium">
                            {entry.lastName}{" "}
                            {entry.firstName}
                          </td>

                          <td className="py-2 pr-3">
                            {entry.birthYear ?? "–"}
                          </td>

                          <td className="py-2 pr-3 font-medium">
                            {categoryForBirthYear(
                              entry.birthYear,
                              eventYear
                            )}
                          </td>

                          {entry.details.map(
                            (detail) => (
                              <td
                                key={
                                  detail.stitchId
                                }
                                className="py-2 pr-3 text-right"
                              >
                                {detail.result}
                              </td>
                            )
                          )}

                          <td className="py-2 text-right text-base font-bold">
                            {entry.total.toFixed(
                              2
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className={viewMode === "individual" ? "block" : "hidden print:hidden"}>
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
                      Kategorie
                    </th>
                    <th className="py-2 pr-3">
                      Sportgerät
                    </th>
                    <th className="py-2 pr-3 text-right">
                      Resultat
                    </th>
                    <th className="py-2">
                      <span className="sr-only">Rangierungsdetails</span>
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

                      <td className="py-2 pr-3 font-medium">
                        {categoryForBirthYear(row.birth_year, eventYear)}
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
      </div>
    </main>
  );
}
