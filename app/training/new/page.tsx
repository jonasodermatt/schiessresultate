"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type EquipmentDistance = {
  distance_m: number;
};

type EquipmentPosition = {
  position: string;
};

type Equipment = {
  id: string;
  name: string;
  iris_min: number | null;
  iris_max: number | null;
  front_sight_min: number | null;
  front_sight_max: number | null;
  equipment_distances: EquipmentDistance[];
  equipment_positions: EquipmentPosition[];
};

type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number | null;
};

type Program = {
  id: string;
  shot_mode: "fixed" | "free";
  planned_shots: number | null;
};

function localDateTimeNow() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function getEquipmentPositionLabel(position: string) {
  const labels: Record<string, string> = {
    lying: "Liegend",
    prone: "Liegend",
    liegend: "Liegend",
    standing: "Stehend",
    stehend: "Stehend",
    kneeling: "Kniend",
    kniend: "Kniend",
  };

  return labels[position.toLowerCase()] ?? position;
}

export default function NewTrainingPage() {
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [selectedDistance, setSelectedDistance] =
    useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [irisSetting, setIrisSetting] = useState("");
  const [frontSightSetting, setFrontSightSetting] = useState("");

  const [shootingRanges, setShootingRanges] = useState<ShootingRange[]>([]);
  const [shootingRangeId, setShootingRangeId] = useState("");
  const [favoriteShootingRangeIds, setFavoriteShootingRangeIds] =
    useState<string[]>([]);
  const [shootingRangeSearch, setShootingRangeSearch] = useState("");

  const [startedAt, setStartedAt] = useState(localDateTimeNow);

  const [programMode, setProgramMode] =
    useState<"fixed" | "free">("fixed");
  const [programShots, setProgramShots] = useState(6);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      const { data: lastResult } = await supabase
        .from("results")
        .select(`
          equipment_id,
          shooting_range_id,
          distance_m,
          shooting_position,
          iris_setting,
          front_sight_setting
        `)
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const {
        data: equipmentData,
        error: equipmentError,
      } = await supabase
        .from("equipment")
        .select(`
          id,
          name,
          iris_min,
          iris_max,
          front_sight_min,
          front_sight_max,
          equipment_distances (
            distance_m
          ),
          equipment_positions (
            position
          )
        `)
        .eq("active", true)
        .order("name");

      if (equipmentError) {
        setMessage(
          `Fehler beim Laden der Sportgeräte: ${equipmentError.message}`
        );
        setLoading(false);
        return;
      }

      const loadedEquipment = (equipmentData ?? []) as Equipment[];
      setEquipment(loadedEquipment);

      if (loadedEquipment.length > 0) {
        const lastEquipment = loadedEquipment.find(
          (item) => item.id === lastResult?.equipment_id
        );

        const initialEquipment = lastEquipment ?? loadedEquipment[0];
        setEquipmentId(initialEquipment.id);

        const distances = initialEquipment.equipment_distances ?? [];
        const positions = initialEquipment.equipment_positions ?? [];

        const validLastDistance =
          lastResult?.distance_m !== null &&
          lastResult?.distance_m !== undefined &&
          distances.some(
            (item) =>
              Number(item.distance_m) === Number(lastResult.distance_m)
          );

        setSelectedDistance(
          validLastDistance
            ? Number(lastResult?.distance_m)
            : distances.length > 0
              ? Number(distances[0].distance_m)
              : null
        );

        const validLastPosition =
          !!lastResult?.shooting_position &&
          positions.some(
            (item) => item.position === lastResult.shooting_position
          );

        setSelectedPosition(
          validLastPosition
            ? lastResult?.shooting_position ?? ""
            : positions[0]?.position ?? ""
        );

        setIrisSetting(
          lastEquipment &&
          lastResult?.iris_setting !== null &&
          lastResult?.iris_setting !== undefined
            ? String(lastResult.iris_setting)
            : ""
        );

        setFrontSightSetting(
          lastEquipment &&
          lastResult?.front_sight_setting !== null &&
          lastResult?.front_sight_setting !== undefined
            ? String(lastResult.front_sight_setting)
            : ""
        );
      }

      const {
        data: shootingRangeData,
        error: shootingRangeError,
      } = await supabase
        .from("shooting_ranges")
        .select("id, name, city, distance_m")
        .order("name");

      if (shootingRangeError) {
        setMessage(
          `Fehler beim Laden der Schiessstände: ${shootingRangeError.message}`
        );
        setLoading(false);
        return;
      }

      const ranges = (shootingRangeData ?? []) as ShootingRange[];
      setShootingRanges(ranges);

      const {
        data: favoriteData,
        error: favoriteError,
      } = await supabase
        .from("shooting_range_favorites")
        .select("shooting_range_id")
        .eq("user_id", user.id);

      if (favoriteError) {
        setMessage(
          `Fehler beim Laden der Favoriten: ${favoriteError.message}`
        );
        setLoading(false);
        return;
      }

      setFavoriteShootingRangeIds(
        (favoriteData ?? []).map(
          (favorite) => favorite.shooting_range_id
        )
      );

      if (
        lastResult?.shooting_range_id &&
        ranges.some((range) => range.id === lastResult.shooting_range_id)
      ) {
        setShootingRangeId(lastResult.shooting_range_id);
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  const selectedEquipment = equipment.find(
    (item) => item.id === equipmentId
  );

  const availableDistances =
    selectedEquipment?.equipment_distances ?? [];

  const availablePositions =
    selectedEquipment?.equipment_positions ?? [];

  const searchedShootingRanges = useMemo(() => {
    const search = shootingRangeSearch.trim().toLowerCase();

    if (!search) {
      return [];
    }

    return shootingRanges.filter(
      (range) =>
        range.name.toLowerCase().includes(search) ||
        (range.city ?? "").toLowerCase().includes(search)
    );
  }, [shootingRanges, shootingRangeSearch]);

  function handleEquipmentChange(newEquipmentId: string) {
    setEquipmentId(newEquipmentId);

    const newEquipment = equipment.find(
      (item) => item.id === newEquipmentId
    );

    if (!newEquipment) {
      setSelectedDistance(null);
      setSelectedPosition("");
      setIrisSetting("");
      setFrontSightSetting("");
      return;
    }

    const distances = newEquipment.equipment_distances ?? [];
    const positions = newEquipment.equipment_positions ?? [];

    setSelectedDistance(
      distances.length > 0 ? Number(distances[0].distance_m) : null
    );
    setSelectedPosition(positions[0]?.position ?? "");
    setIrisSetting("");
    setFrontSightSetting("");
  }

  function addProgram() {
    if (programMode === "fixed" && programShots <= 0) {
      setMessage("Bitte eine gültige Schusszahl eingeben.");
      return;
    }

    setPrograms((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        shot_mode: programMode,
        planned_shots: programMode === "fixed" ? programShots : null,
      },
    ]);

    setMessage("");
  }

  function addQuickProgram(shots: number) {
    setPrograms((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        shot_mode: "fixed",
        planned_shots: shots,
      },
    ]);
  }

  function removeProgram(index: number) {
    setPrograms((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  function moveProgram(index: number, direction: -1 | 1) {
    setPrograms((current) => {
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      [copy[index], copy[targetIndex]] = [
        copy[targetIndex],
        copy[index],
      ];

      return copy;
    });
  }

  async function startTraining() {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!equipmentId) {
      setMessage("Bitte ein Sportgerät auswählen.");
      return;
    }

    if (!startedAt) {
      setMessage("Bitte Datum und Uhrzeit festlegen.");
      return;
    }

    if (programs.length === 0) {
      setMessage("Bitte mindestens ein Programm hinzufügen.");
      return;
    }

    const iris =
      irisSetting === "" ? null : Number(irisSetting);
    const frontSight =
      frontSightSetting === "" ? null : Number(frontSightSetting);

    if (iris !== null && Number.isNaN(iris)) {
      setMessage("Bitte die Irisblende korrekt eingeben.");
      return;
    }

    if (frontSight !== null && Number.isNaN(frontSight)) {
      setMessage("Bitte die Korneinstellung korrekt eingeben.");
      return;
    }

    setSaving(true);

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from("training_sessions")
      .insert({
        user_id: user.id,
        equipment_id: equipmentId,
        shooting_range_id: shootingRangeId || null,
        distance_m: selectedDistance,
        shooting_position: selectedPosition || null,
        iris_setting: iris,
        front_sight_setting: frontSight,
        started_at: new Date(startedAt).toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      setMessage(
        `Trainingseinheit konnte nicht erstellt werden: ${
          sessionError?.message ?? "Unbekannter Fehler"
        }`
      );
      setSaving(false);
      return;
    }

    const programRows = programs.map((program, index) => ({
      training_session_id: session.id,
      sort_order: index + 1,
      shot_mode: program.shot_mode,
      planned_shots: program.planned_shots,
      status: "open",
    }));

    const { error: programError } = await supabase
      .from("training_session_programs")
      .insert(programRows);

    if (programError) {
      // Keine leere Session zurücklassen, falls das Anlegen
      // der Programme fehlschlägt.
      await supabase
        .from("training_sessions")
        .delete()
        .eq("id", session.id);

      setMessage(
        `Programme konnten nicht erstellt werden: ${programError.message}`
      );
      setSaving(false);
      return;
    }

    router.push(`/training/${session.id}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Trainingseinheit wird vorbereitet...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
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
            href="/results/new"
            className="text-sm font-medium text-slate-600"
          >
            ← Abbrechen
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Trainingseinheit planen
        </h1>

        <p className="mt-2 text-slate-600">
          Lege die gemeinsamen Einstellungen fest und erfasse
          anschliessend die geplanten Programme.
        </p>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Angaben zur Trainingseinheit
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sportgerät
              </label>

              <select
                value={equipmentId}
                onChange={(event) =>
                  handleEquipmentChange(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {equipment.length === 0 && (
                  <option value="">
                    Kein Sportgerät vorhanden
                  </option>
                )}

                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="startedAt"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Datum und Startzeit
              </label>

              <input
                id="startedAt"
                type="datetime-local"
                value={startedAt}
                onChange={(event) =>
                  setStartedAt(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Distanz
              </label>

              <select
                value={selectedDistance ?? ""}
                onChange={(event) =>
                  setSelectedDistance(
                    event.target.value
                      ? Number(event.target.value)
                      : null
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {availableDistances.length === 0 && (
                  <option value="">
                    Keine Distanz hinterlegt
                  </option>
                )}

                {[...availableDistances]
                  .sort(
                    (a, b) =>
                      Number(a.distance_m) -
                      Number(b.distance_m)
                  )
                  .map((item) => (
                    <option
                      key={item.distance_m}
                      value={item.distance_m}
                    >
                      {item.distance_m} m
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Stellung
              </label>

              <select
                value={selectedPosition}
                onChange={(event) =>
                  setSelectedPosition(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {availablePositions.length === 0 && (
                  <option value="">
                    Keine Stellung hinterlegt
                  </option>
                )}

                {availablePositions.map((item) => (
                  <option
                    key={item.position}
                    value={item.position}
                  >
                    {getEquipmentPositionLabel(item.position)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Irisblende
              </label>

              <input
                type="number"
                step="0.01"
                min={selectedEquipment?.iris_min ?? undefined}
                max={selectedEquipment?.iris_max ?? undefined}
                value={irisSetting}
                onChange={(event) =>
                  setIrisSetting(event.target.value)
                }
                placeholder={
                  selectedEquipment?.iris_min !== null &&
                  selectedEquipment?.iris_min !== undefined &&
                  selectedEquipment?.iris_max !== null &&
                  selectedEquipment?.iris_max !== undefined
                    ? `${selectedEquipment.iris_min} – ${selectedEquipment.iris_max}`
                    : "Keine Einstellung"
                }
                disabled={
                  selectedEquipment?.iris_min === null &&
                  selectedEquipment?.iris_max === null
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Korneinstellung
              </label>

              <input
                type="number"
                step="0.01"
                min={selectedEquipment?.front_sight_min ?? undefined}
                max={selectedEquipment?.front_sight_max ?? undefined}
                value={frontSightSetting}
                onChange={(event) =>
                  setFrontSightSetting(event.target.value)
                }
                placeholder={
                  selectedEquipment?.front_sight_min !== null &&
                  selectedEquipment?.front_sight_min !== undefined &&
                  selectedEquipment?.front_sight_max !== null &&
                  selectedEquipment?.front_sight_max !== undefined
                    ? `${selectedEquipment.front_sight_min} – ${selectedEquipment.front_sight_max}`
                    : "Keine Einstellung"
                }
                disabled={
                  selectedEquipment?.front_sight_min === null &&
                  selectedEquipment?.front_sight_max === null
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Schiessstand
              </label>

              <select
                value={shootingRangeId}
                onChange={(event) =>
                  setShootingRangeId(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                <option value="">Kein Schiessstand</option>

                {shootingRangeId &&
                  !favoriteShootingRangeIds.includes(shootingRangeId) &&
                  shootingRanges
                    .filter(
                      (range) => range.id === shootingRangeId
                    )
                    .map((range) => (
                      <option key={range.id} value={range.id}>
                        {range.name}
                        {range.city ? ` · ${range.city}` : ""}
                        {range.distance_m !== null
                          ? ` · ${range.distance_m} m`
                          : ""}
                      </option>
                    ))}

                {shootingRanges
                  .filter((range) =>
                    favoriteShootingRangeIds.includes(range.id)
                  )
                  .map((range) => (
                    <option key={range.id} value={range.id}>
                      ★ {range.name}
                      {range.city ? ` · ${range.city}` : ""}
                      {range.distance_m !== null
                        ? ` · ${range.distance_m} m`
                        : ""}
                    </option>
                  ))}
              </select>

              <input
                type="search"
                value={shootingRangeSearch}
                onChange={(event) =>
                  setShootingRangeSearch(event.target.value)
                }
                placeholder="🔍 Anderen Schiessstand suchen..."
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              />

              {searchedShootingRanges.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {searchedShootingRanges.map((range) => (
                    <button
                      key={range.id}
                      type="button"
                      onClick={() => {
                        setShootingRangeId(range.id);
                        setShootingRangeSearch("");
                      }}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-900 last:border-b-0"
                    >
                      {range.name}
                      {range.city ? ` · ${range.city}` : ""}
                      {range.distance_m !== null
                        ? ` · ${range.distance_m} m`
                        : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Programme
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Die Reihenfolge hier dient nur der Übersicht. Beim
            Training kannst du jedes offene Programm frei auswählen.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {[6, 10, 20].map((shots) => (
              <button
                key={shots}
                type="button"
                onClick={() => addQuickProgram(shots)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                + {shots} Schuss
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setPrograms((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    shot_mode: "free",
                    planned_shots: null,
                  },
                ])
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Freies Training
            </button>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Eigenes Programm hinzufügen
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={programMode}
                onChange={(event) =>
                  setProgramMode(
                    event.target.value as "fixed" | "free"
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                <option value="fixed">
                  Feste Anzahl
                </option>
                <option value="free">
                  Freies Training
                </option>
              </select>

              {programMode === "fixed" ? (
                <input
                  type="number"
                  min={1}
                  value={programShots}
                  onChange={(event) =>
                    setProgramShots(Number(event.target.value))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  placeholder="Anzahl Schüsse"
                />
              ) : (
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  Keine feste Schusszahl
                </div>
              )}

              <button
                type="button"
                onClick={addProgram}
                className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
              >
                Hinzufügen
              </button>
            </div>
          </div>

          {programs.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <p className="font-medium text-slate-700">
                Noch keine Programme geplant.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Füge mindestens ein Programm hinzu.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {programs.map((program, index) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700">
                      {index + 1}
                    </span>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {program.shot_mode === "free"
                          ? "Freies Training"
                          : `${program.planned_shots} Schuss`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveProgram(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg px-3 py-2 text-slate-700 hover:bg-white disabled:opacity-30"
                      aria-label="Nach oben"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => moveProgram(index, 1)}
                      disabled={index === programs.length - 1}
                      className="rounded-lg px-3 py-2 text-slate-700 hover:bg-white disabled:opacity-30"
                      aria-label="Nach unten"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => removeProgram(index)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm text-slate-500">
              {programs.length === 1
                ? "1 Programm geplant"
                : `${programs.length} Programme geplant`}
            </p>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={startTraining}
            disabled={saving || programs.length === 0}
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving
              ? "Training wird erstellt..."
              : "Training starten"}
          </button>

          <Link
            href="/results/new"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700"
          >
            Normales Resultat erfassen
          </Link>
        </div>
      </div>
    </main>
  );
}
