"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Shot = {
  id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

type Equipment = {
  name: string;
  manufacturer: string | null;
  model: string | null;
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

export default function ResultDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadResult() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const id = params.id;

      if (!id || Array.isArray(id)) {
        setMessage("Ungültiges Resultat.");
        setLoading(false);
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
            name,
            manufacturer,
            model
          ),
          result_shots (
  id,
  shot_number,
  score,
  x_position,
  y_position
)
        `)
        .eq("id", id)
        .single();

      if (error) {
        setMessage(`Fehler beim Laden: ${error.message}`);
        setLoading(false);
        return;
      }

      setResult(data as Result);
      setLoading(false);
    }

    loadResult();
  }, [params.id, router]);

  function getEquipment() {
    if (!result?.equipment) {
      return null;
    }

    if (Array.isArray(result.equipment)) {
      return result.equipment[0] ?? null;
    }

    return result.equipment;
  }

  async function deleteResult() {
  if (!result) return;

  const confirmed = window.confirm(
    "Möchtest du dieses Resultat wirklich löschen? Die Einzelschüsse werden ebenfalls gelöscht."
  );

  if (!confirmed) return;

  setDeleting(true);
  setMessage("");

  const { error } = await supabase
    .from("results")
    .delete()
    .eq("id", result.id);

  if (error) {
    setMessage(`Fehler beim Löschen: ${error.message}`);
    setDeleting(false);
    return;
  }

  router.push("/results");
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Resultat wird geladen...
        </p>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-white p-8">
            <h1 className="text-xl font-bold text-slate-900">
              Resultat nicht gefunden
            </h1>

            <p className="mt-2 text-slate-600">
              {message || "Dieses Resultat ist nicht verfügbar."}
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

  const equipment = getEquipment();

  const shots = [...(result.result_shots ?? [])].sort(
    (a, b) => a.shot_number - b.shot_number
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            ◎ Schiessresultate
          </Link>

          <Link
            href="/results"
            className="text-sm font-medium text-slate-600"
          >
            ← Meine Resultate
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6">
          <p className="text-sm text-slate-500">
            {formatDate(result.date)}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {result.discipline}
          </h1>

          {equipment && (
            <p className="mt-2 text-slate-600">
              🔫{" "}
              {[equipment.manufacturer, equipment.model]
                .filter(Boolean)
                .join(" ") || equipment.name}
            </p>
          )}
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Total
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {Number(result.total_score).toFixed(0)}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Schüsse
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {result.actual_shots}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              Durchschnitt
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {Number(result.average_score).toFixed(2)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Training
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">
                Erfassung
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {result.input_type === "individual"
                  ? "Einzelschüsse"
                  : "Nur Total"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Modus
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {result.shot_mode === "free"
                  ? "Freies Training"
                  : "Feste Schusszahl"}
              </p>
            </div>
          </div>
        </section>

        {result.input_type === "individual" &&
          shots.length > 0 && (
            <section className="mt-6 rounded-2xl border bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Einzelschüsse
                </h2>

                <span className="text-sm text-slate-500">
                  {shots.length} Schüsse
                </span>
              </div>

              <div className="mt-6 grid grid-cols-5 gap-3 sm:grid-cols-10">
                {shots.map((shot) => (
                  <div
                    key={shot.id}
                    className="text-center"
                  >
                    <div className="flex aspect-square items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-900">
                      {Number(shot.score)}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {shot.shot_number}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {result.input_type === "individual" &&
  shots.some(
    (shot) =>
      shot.x_position !== null &&
      shot.y_position !== null
  ) && (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Schussbild
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Positionen der erfassten Einzelschüsse
        </p>
      </div>

      <div
        style={{
          position: "relative",
          width: "300px",
          height: "300px",
          maxWidth: "100%",
          margin: "30px auto 10px",
          border: "4px solid black",
          borderRadius: "50%",
          backgroundColor: "white",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "10%",
            border: "1px solid #94a3b8",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "20%",
            border: "1px solid #94a3b8",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "30%",
            border: "1px solid #94a3b8",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "40%",
            border: "1px solid #94a3b8",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: "1px",
            height: "100%",
            backgroundColor: "#e2e8f0",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: "100%",
            height: "1px",
            backgroundColor: "#e2e8f0",
          }}
        />

        {shots
          .filter(
            (shot) =>
              shot.x_position !== null &&
              shot.y_position !== null
          )
          .map((shot) => (
            <div
              key={shot.id}
              title={`Schuss ${shot.shot_number}: ${shot.score}`}
              style={{
                position: "absolute",
                left: `${
                  ((Number(shot.x_position) + 1) / 2) * 100
                }%`,
                top: `${
                  ((1 - Number(shot.y_position)) / 2) * 100
                }%`,
                width: "24px",
                height: "24px",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                backgroundColor: "#dc2626",
                border: "2px solid white",
                color: "white",
                fontSize: "11px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              {shot.shot_number}
            </div>
          ))}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        Die Zahl im Treffer entspricht der Schussnummer.
      </p>
    </section>
  )}
        {result.notes && (
          <section className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Notiz
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-slate-600">
              {result.notes}
            </p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-dashed bg-white p-6">
          <p className="text-sm font-semibold text-slate-700">
            Für später vorbereitet
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              🎯 Schussposition
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              📍 Schiessstand
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              🌤 Wetter
            </span>
          </div>
<div className="mt-8 border-t border-slate-200 pt-6">
  <h2 className="font-bold text-slate-900">
    Resultat verwalten
  </h2>

  <p className="mt-1 text-sm text-slate-500">
    Du kannst dieses Resultat bearbeiten oder löschen.
  </p>

  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
  <Link
  href={`/results/${result.id}/edit`}
  className="rounded-lg border-2 border-slate-900 bg-white px-5 py-3 text-center text-sm font-bold text-slate-900 hover:bg-slate-100"
>
  ✏️ Resultat bearbeiten
</Link>

    <button
      type="button"
      onClick={deleteResult}
      disabled={deleting}
      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {deleting ? "Wird gelöscht..." : "Resultat löschen"}
    </button>
  </div>
</div>
        </section>
      </div>
    </main>
  );
}