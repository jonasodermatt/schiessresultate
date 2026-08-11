"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Equipment = {
  id: string;
  name: string;
};
type Shot = {
  id: string;
  shot_number: number;
  score: number;
};

export default function EditResultPage() {
  const params = useParams();
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [shots, setShots] = useState<Shot[]>([]);
  const [inputType, setInputType] = useState("");

  useEffect(() => {
    async function loadData() {
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

      const { data: equipmentData, error: equipmentError } =
        await supabase
          .from("equipment")
          .select("id, name")
          .eq("active", true)
          .order("name");

      if (equipmentError) {
        setMessage(
          `Fehler beim Laden der Sportgeräte: ${equipmentError.message}`
        );
        setLoading(false);
        return;
      }

      setEquipment(equipmentData ?? []);

      const { data: resultData, error: resultError } =
        await supabase
          .from("results")
          .select(`id, date, discipline, equipment_id, notes, input_type, result_shots (id, shot_number, score)`)
          .eq("id", id)
          .single();

      if (resultError || !resultData) {
        setMessage(
          `Fehler beim Laden: ${
            resultError?.message ?? "Resultat nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      setDiscipline(resultData.discipline);
      setEquipmentId(resultData.equipment_id);
      setNotes(resultData.notes ?? "");
      setInputType(resultData.input_type);

const loadedShots = [...(resultData.result_shots ?? [])]
  .sort((a, b) => a.shot_number - b.shot_number)
  .map((shot) => ({
    id: shot.id,
    shot_number: shot.shot_number,
    score: Number(shot.score),
  }));

setShots(loadedShots);
      const resultDate = new Date(resultData.date);

      const offset = resultDate.getTimezoneOffset();
      const localDate = new Date(
        resultDate.getTime() - offset * 60 * 1000
      );

      setDate(localDate.toISOString().slice(0, 16));

      setLoading(false);
    }

    loadData();
  }, [params.id, router]);
  function changeShot(index: number, score: number) {
  setShots((current) =>
    current.map((shot, shotIndex) =>
      shotIndex === index
        ? { ...shot, score }
        : shot
    )
  );
}
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const id = params.id;

    if (!id || Array.isArray(id)) {
      return;
    }

    if (!discipline.trim()) {
      setMessage("Bitte eine Disziplin eingeben.");
      return;
    }

    if (!equipmentId) {
      setMessage("Bitte ein Sportgerät auswählen.");
      return;
    }

    if (!date) {
      setMessage("Bitte Datum und Uhrzeit eingeben.");
      return;
    }

    setSaving(true);
    setMessage("");

let totalScore: number | undefined;
let averageScore: number | undefined;

if (inputType === "individual") {
  totalScore = shots.reduce(
    (sum, shot) => sum + Number(shot.score),
    0
  );

  averageScore =
    shots.length > 0 ? totalScore / shots.length : 0;
}

const { error } = await supabase
  .from("results")
  .update({
    discipline: discipline.trim(),
    equipment_id: equipmentId,
    date: new Date(date).toISOString(),
    notes: notes.trim() || null,

    ...(inputType === "individual"
      ? {
          total_score: totalScore,
          average_score: averageScore,
          actual_shots: shots.length,
        }
      : {}),
  })
  .eq("id", id);

if (error) {
  setMessage(`Fehler beim Speichern: ${error.message}`);
  setSaving(false);
  return;
}

if (inputType === "individual") {
  for (const shot of shots) {
    const { error: shotError } = await supabase
      .from("result_shots")
      .update({
        score: shot.score,
      })
      .eq("id", shot.id);

    if (shotError) {
      setMessage(
        `Fehler beim Speichern der Schüsse: ${shotError.message}`
      );
      setSaving(false);
      return;
    }
  }
}

router.push(`/results/${id}`);

    if (error) {
      setMessage(`Fehler beim Speichern: ${error.message}`);
      setSaving(false);
      return;
    }

    router.push(`/results/${id}`);
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

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            ◎ Schiessresultate
          </Link>

          <Link
            href={`/results/${params.id}`}
            className="text-sm font-medium text-slate-600"
          >
            ← Abbrechen
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Resultat bearbeiten
        </h1>

        <p className="mt-2 text-slate-600">
          Passe die Angaben zu diesem Resultat an.
        </p>

        {message && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="date"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Datum und Uhrzeit
            </label>

            <input
              id="date"
              type="datetime-local"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="discipline"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Disziplin
            </label>

            <input
              id="discipline"
              required
              value={discipline}
              onChange={(event) =>
                setDiscipline(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="equipment"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Sportgerät
            </label>

            <select
              id="equipment"
              required
              value={equipmentId}
              onChange={(event) =>
                setEquipmentId(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="">
                Sportgerät auswählen
              </option>

              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {inputType === "individual" && shots.length > 0 && (
  <div className="mt-7 border-t pt-6">
    <h2 className="text-lg font-bold text-slate-900">
      Einzelschüsse bearbeiten
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Klicke auf einen Wert, um einen falsch erfassten
      Schuss zu korrigieren.
    </p>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {shots.map((shot, index) => (
        <div
          key={shot.id}
          className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
        >
          <label
            htmlFor={`shot-${shot.id}`}
            className="font-medium text-slate-700"
          >
            Schuss {shot.shot_number}
          </label>

          <select
            id={`shot-${shot.id}`}
            value={shot.score}
            onChange={(event) =>
              changeShot(index, Number(event.target.value))
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-900"
          >
            {Array.from({ length: 11 }, (_, score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          Schüsse
        </p>

        <p className="mt-1 text-xl font-bold">
          {shots.length}
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          Neues Total
        </p>

        <p className="mt-1 text-xl font-bold">
          {shots.reduce(
            (sum, shot) => sum + Number(shot.score),
            0
          )}
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          Neuer Durchschnitt
        </p>

        <p className="mt-1 text-xl font-bold">
          {(
            shots.reduce(
              (sum, shot) => sum + Number(shot.score),
              0
            ) / shots.length
          ).toFixed(2)}
        </p>
      </div>
    </div>
  </div>
)}
          <div className="mt-5">
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Notiz
            </label>

            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              placeholder="Optional..."
            />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving
                ? "Wird gespeichert..."
                : "Änderungen speichern"}
            </button>

            <Link
              href={`/results/${params.id}`}
              className="rounded-lg border border-slate-300 px-6 py-3 text-center font-semibold text-slate-700"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}