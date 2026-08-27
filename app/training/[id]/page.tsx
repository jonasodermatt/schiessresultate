"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type TrainingSession = {
  id: string;
  equipment_id: string;
  shooting_range_id: string | null;
  distance_m: number | null;
  shooting_position: string | null;
  iris_setting: number | null;
  front_sight_setting: number | null;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "cancelled";
};

type TrainingProgram = {
  id: string;
  training_session_id: string;
  sort_order: number;
  shot_mode: "fixed" | "free";
  planned_shots: number | null;
  status: "open" | "in_progress" | "completed";
  started_at: string | null;
  completed_at: string | null;
};

type Equipment = {
  id: string;
  name: string;
};

type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number | null;
};

function getPositionLabel(position: string | null) {
  if (!position) {
    return "–";
  }

  const labels: Record<string, string> = {
    lying: "Liegend",
    prone: "Liegend",
    liegend: "Liegend",
    standing: "Stehend",
    stehend: "Stehend",
    kneeling: "Kniend",
    kniend: "Kniend",
    sitting: "Sitzend",
    supported: "Aufgelegt",
    other: "Andere",
  };

  return labels[position.toLowerCase()] ?? position;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TrainingSessionPage() {
  const params = useParams();
  const router = useRouter();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [shootingRange, setShootingRange] =
    useState<ShootingRange | null>(null);

  const [loading, setLoading] = useState(true);
  const [startingProgramId, setStartingProgramId] =
    useState<string | null>(null);
  const [endingTraining, setEndingTraining] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTraining() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const id = params.id;

      if (!id || Array.isArray(id)) {
        setMessage("Ungültige Trainingseinheit.");
        setLoading(false);
        return;
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase
        .from("training_sessions")
        .select(`
          id,
          equipment_id,
          shooting_range_id,
          distance_m,
          shooting_position,
          iris_setting,
          front_sight_setting,
          started_at,
          completed_at,
          status
        `)
        .eq("id", id)
        .single();

      if (sessionError || !sessionData) {
        setMessage(
          `Trainingseinheit konnte nicht geladen werden: ${
            sessionError?.message ?? "Nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      const loadedSession = sessionData as TrainingSession;
      setSession(loadedSession);

      const {
        data: programData,
        error: programError,
      } = await supabase
        .from("training_session_programs")
        .select(`
          id,
          training_session_id,
          sort_order,
          shot_mode,
          planned_shots,
          status,
          started_at,
          completed_at
        `)
        .eq("training_session_id", id)
        .order("sort_order", { ascending: true });

      if (programError) {
        setMessage(
          `Programme konnten nicht geladen werden: ${programError.message}`
        );
        setLoading(false);
        return;
      }

      setPrograms(
        (programData ?? []) as TrainingProgram[]
      );

      const {
        data: equipmentData,
        error: equipmentError,
      } = await supabase
        .from("equipment")
        .select("id, name")
        .eq("id", loadedSession.equipment_id)
        .maybeSingle();

      if (!equipmentError && equipmentData) {
        setEquipment(equipmentData as Equipment);
      }

      if (loadedSession.shooting_range_id) {
        const {
          data: rangeData,
          error: rangeError,
        } = await supabase
          .from("shooting_ranges")
          .select("id, name, city, distance_m")
          .eq("id", loadedSession.shooting_range_id)
          .maybeSingle();

        if (!rangeError && rangeData) {
          setShootingRange(rangeData as ShootingRange);
        }
      }

      setLoading(false);
    }

    loadTraining();
  }, [params.id, router]);

  const openPrograms = useMemo(
    () =>
      programs.filter(
        (program) =>
          program.status === "open" ||
          program.status === "in_progress"
      ),
    [programs]
  );

  const completedPrograms = useMemo(
    () =>
      programs.filter(
        (program) => program.status === "completed"
      ),
    [programs]
  );

  const progressText =
    programs.length > 0
      ? `${completedPrograms.length} von ${programs.length} Programmen abgeschlossen`
      : "Keine Programme";

  async function startProgram(program: TrainingProgram) {
    if (!session || session.status !== "active") {
      return;
    }

    setMessage("");
    setStartingProgramId(program.id);

    if (program.status === "open") {
      const { error } = await supabase
        .from("training_session_programs")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", program.id);

      if (error) {
        setMessage(
          `Programm konnte nicht gestartet werden: ${error.message}`
        );
        setStartingProgramId(null);
        return;
      }
    }

    router.push(
      `/results/new?trainingSessionId=${session.id}&trainingProgramId=${program.id}`
    );
  }

  async function endTraining() {
    if (!session) {
      return;
    }

    const confirmed = window.confirm(
      "Trainingseinheit wirklich beenden? Nicht abgeschlossene Programme werden gelöscht. Bereits gespeicherte Resultate bleiben erhalten."
    );

    if (!confirmed) {
      return;
    }

    setEndingTraining(true);
    setMessage("");

    const unfinishedProgramIds = programs
      .filter(
        (program) =>
          program.status === "open" ||
          program.status === "in_progress"
      )
      .map((program) => program.id);

    if (unfinishedProgramIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("training_session_programs")
        .delete()
        .in("id", unfinishedProgramIds);

      if (deleteError) {
        setMessage(
          `Offene Programme konnten nicht gelöscht werden: ${deleteError.message}`
        );
        setEndingTraining(false);
        return;
      }
    }

    const { error: sessionError } = await supabase
      .from("training_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (sessionError) {
      setMessage(
        `Trainingseinheit konnte nicht beendet werden: ${sessionError.message}`
      );
      setEndingTraining(false);
      return;
    }

    router.push("/results");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Trainingseinheit wird geladen...
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-white p-8">
            <h1 className="text-xl font-bold text-slate-900">
              Trainingseinheit nicht gefunden
            </h1>

            <p className="mt-2 text-slate-600">
              {message || "Diese Trainingseinheit ist nicht verfügbar."}
            </p>

            <Link
              href="/results"
              className="mt-5 inline-block font-semibold text-red-600"
            >
              ← Zurück zu meinen Resultaten
            </Link>
          </div>
        </div>
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
            href="/results"
            className="text-sm font-medium text-slate-600"
          >
            ← Resultate
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">
              Trainingseinheit
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {equipment?.name ?? "Sportgerät"}
            </h1>

            <p className="mt-2 text-slate-600">
              {session.distance_m !== null
                ? `${session.distance_m} m`
                : "Keine Distanz"}
              {" · "}
              {getPositionLabel(session.shooting_position)}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Gestartet: {formatDateTime(session.started_at)}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              session.status === "active"
                ? "bg-green-50 text-green-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {session.status === "active"
              ? "Aktiv"
              : "Abgeschlossen"}
          </span>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Training
          </h2>

          <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">
                Sportgerät
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {equipment?.name ?? "–"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Schiessstand
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {shootingRange
                  ? `${shootingRange.name}${
                      shootingRange.city
                        ? ` · ${shootingRange.city}`
                        : ""
                    }`
                  : "–"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Distanz
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {session.distance_m !== null
                  ? `${session.distance_m} m`
                  : "–"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Stellung
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {getPositionLabel(session.shooting_position)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Irisblende
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {session.iris_setting !== null
                  ? `${session.iris_setting} mm`
                  : "–"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Korneinstellung
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {session.front_sight_setting !== null
                  ? `${session.front_sight_setting} mm`
                  : "–"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Programme
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Wähle frei, welches offene Programm du als Nächstes schiessen möchtest.
              </p>
            </div>

            <p className="text-sm font-medium text-slate-600">
              {progressText}
            </p>
          </div>

          {openPrograms.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {openPrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => startProgram(program)}
                  disabled={
                    session.status !== "active" ||
                    startingProgramId !== null
                  }
                  className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {program.shot_mode === "free"
                          ? "Freies Training"
                          : `${program.planned_shots} Schuss`}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {program.status === "in_progress"
                          ? "Bereits begonnen"
                          : "Offen"}
                      </p>
                    </div>

                    <span className="text-xl text-red-600">
                      →
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-red-600">
                    {startingProgramId === program.id
                      ? "Wird geöffnet..."
                      : "Programm auswählen"}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-green-50 p-6 text-center">
              <p className="text-lg font-bold text-slate-900">
                ✓ Alle Programme abgeschlossen
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Du kannst die Trainingseinheit jetzt beenden.
              </p>
            </div>
          )}

          {completedPrograms.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h3 className="font-bold text-slate-900">
                Abgeschlossen
              </h3>

              <div className="mt-3 space-y-2">
                {completedPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {program.shot_mode === "free"
                          ? "Freies Training"
                          : `${program.planned_shots} Schuss`}
                      </p>

                      {program.completed_at && (
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(program.completed_at)}
                        </p>
                      )}
                    </div>

                    <span className="font-bold text-green-600">
                      ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {session.status === "active" && (
            <button
              type="button"
              onClick={endTraining}
              disabled={endingTraining}
              className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {endingTraining
                ? "Training wird beendet..."
                : openPrograms.length > 0
                  ? "Training beenden & offene Programme verwerfen"
                  : "Training abschliessen"}
            </button>
          )}

          <Link
            href="/results"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700"
          >
            Zu meinen Resultaten
          </Link>
        </div>
      </div>
    </main>
  );
}
