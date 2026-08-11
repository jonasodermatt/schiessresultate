"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Equipment = {
  id: string;
  name: string;
};

export default function NewResultPage() {
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [discipline, setDiscipline] = useState("300m");
  const [inputType, setInputType] = useState<"individual" | "total">(
    "individual"
  );
  const [shotMode, setShotMode] = useState<"fixed" | "free">("fixed");
  const [plannedShots, setPlannedShots] = useState(10);
  const [shots, setShots] = useState<number[]>([]);
  const [totalOnlyScore, setTotalOnlyScore] = useState("");
  const [totalOnlyShots, setTotalOnlyShots] = useState(10);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadEquipment() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("equipment")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) {
        setMessage(`Fehler: ${error.message}`);
        return;
      }

      setEquipment(data ?? []);

      if (data && data.length > 0) {
        setEquipmentId(data[0].id);
      }
    }

    loadEquipment();
  }, [router]);

  const totalScore = useMemo(
    () => shots.reduce((sum, shot) => sum + shot, 0),
    [shots]
  );

  const averageScore =
    shots.length > 0 ? totalScore / shots.length : 0;

  function addShot(score: number) {
    if (
      shotMode === "fixed" &&
      shots.length >= plannedShots
    ) {
      return;
    }

    setShots((current) => [...current, score]);
  }

  function removeLastShot() {
    setShots((current) => current.slice(0, -1));
  }

  async function saveResult() {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!equipmentId) {
      setMessage("Bitte zuerst ein Sportgerät auswählen.");
      return;
    }

    if (inputType === "individual" && shots.length === 0) {
      setMessage("Bitte mindestens einen Schuss erfassen.");
      return;
    }

    if (
      inputType === "individual" &&
      shotMode === "fixed" &&
      shots.length !== plannedShots
    ) {
      setMessage(
        `Bitte genau ${plannedShots} Schüsse erfassen.`
      );
      return;
    }

    let actualShots: number;
    let resultTotal: number;
    let resultAverage: number;

    if (inputType === "individual") {
      actualShots = shots.length;
      resultTotal = totalScore;
      resultAverage = averageScore;
    } else {
      actualShots = totalOnlyShots;
      resultTotal = Number(totalOnlyScore);

      if (
        actualShots <= 0 ||
        Number.isNaN(resultTotal)
      ) {
        setMessage(
          "Bitte Anzahl Schüsse und Total korrekt eingeben."
        );
        return;
      }

      resultAverage = resultTotal / actualShots;
    }

    setSaving(true);

    const { data: result, error: resultError } =
      await supabase
        .from("results")
        .insert({
          user_id: user.id,
          equipment_id: equipmentId,
          date: new Date().toISOString(),
          discipline,
          input_type: inputType,
          shot_mode:
            inputType === "individual"
              ? shotMode
              : "fixed",
          planned_shots:
            inputType === "individual" &&
            shotMode === "fixed"
              ? plannedShots
              : inputType === "total"
              ? actualShots
              : null,
          actual_shots: actualShots,
          total_score: resultTotal,
          average_score: resultAverage,
          notes: notes || null,
        })
        .select("id")
        .single();

    if (resultError || !result) {
      setMessage(
        `Fehler beim Resultat: ${
          resultError?.message ?? "Unbekannter Fehler"
        }`
      );
      setSaving(false);
      return;
    }

    if (inputType === "individual") {
      const shotRows = shots.map((score, index) => ({
        result_id: result.id,
        user_id: user.id,
        shot_number: index + 1,
        score,
        x_position: null,
        y_position: null,
      }));

      const { error: shotsError } = await supabase
        .from("result_shots")
        .insert(shotRows);

      if (shotsError) {
        setMessage(
          `Resultat gespeichert, aber Fehler bei den Einzelschüssen: ${shotsError.message}`
        );
        setSaving(false);
        return;
      }
    }

    router.push("/results");
  }

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
            href="/dashboard"
            className="text-sm text-slate-600"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Neues Resultat
        </h1>

        <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Disziplin
              </label>

              <input
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full rounded-lg border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Sportgerät
              </label>

              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full rounded-lg border bg-white px-4 py-3"
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
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">
              Eingabeart
            </p>

            <div className="flex gap-6">
              <label>
                <input
                  type="radio"
                  checked={inputType === "individual"}
                  onChange={() => setInputType("individual")}
                />{" "}
                Einzelschüsse
              </label>

              <label>
                <input
                  type="radio"
                  checked={inputType === "total"}
                  onChange={() => setInputType("total")}
                />{" "}
                Nur Total
              </label>
            </div>
          </div>

          {inputType === "individual" ? (
            <>
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium">
                  Schussmodus
                </p>

                <div className="flex flex-wrap gap-6">
                  <label>
                    <input
                      type="radio"
                      checked={shotMode === "fixed"}
                      onChange={() => setShotMode("fixed")}
                    />{" "}
                    Feste Anzahl
                  </label>

                  <label>
                    <input
                      type="radio"
                      checked={shotMode === "free"}
                      onChange={() => setShotMode("free")}
                    />{" "}
                    Freies Training
                  </label>
                </div>
              </div>

              {shotMode === "fixed" && (
                <div className="mt-5 max-w-xs">
                  <label className="mb-2 block text-sm font-medium">
                    Anzahl Schüsse
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={plannedShots}
                    onChange={(e) =>
                      setPlannedShots(Number(e.target.value))
                    }
                    className="w-full rounded-lg border px-4 py-3"
                  />
                </div>
              )}

              <div className="mt-8 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    Schüsse erfassen
                  </h2>

                  <span className="text-sm text-slate-500">
                    {shotMode === "fixed"
                      ? `${shots.length} / ${plannedShots}`
                      : `${shots.length} Schüsse`}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-11">
                  {Array.from({ length: 11 }, (_, score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => addShot(score)}
                      className="rounded-lg border bg-white px-3 py-3 font-bold hover:bg-slate-100"
                    >
                      {score}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {shots.map((shot, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                    >
                      {index + 1}: {shot}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">
                      Schüsse
                    </p>
                    <p className="text-2xl font-bold">
                      {shots.length}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">
                      Total
                    </p>
                    <p className="text-2xl font-bold">
                      {totalScore}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">
                      Durchschnitt
                    </p>
                    <p className="text-2xl font-bold">
                      {averageScore.toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeLastShot}
                  disabled={shots.length === 0}
                  className="mt-5 rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
                >
                  Letzten Schuss entfernen
                </button>
              </div>
            </>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Anzahl Schüsse
                </label>

                <input
                  type="number"
                  min={1}
                  value={totalOnlyShots}
                  onChange={(e) =>
                    setTotalOnlyShots(Number(e.target.value))
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Total
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={totalOnlyScore}
                  onChange={(e) =>
                    setTotalOnlyScore(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">
              Notiz
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-4 py-3"
            />
          </div>

          {message && (
            <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={saveResult}
            disabled={saving}
            className="mt-6 w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Wird gespeichert..." : "Resultat speichern"}
          </button>
        </div>
      </div>
    </main>
  );
}