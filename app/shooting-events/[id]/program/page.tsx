"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import PayoutSettingsSection from "./PayoutSettingsSection";

type Program = {
  id: string;
  code: string;
  name: string;
  scoring_type: "A5" | "A10" | "A100" | "SPECIAL";
  single_shots: number;
  series_shots: number;
  ranking_type: "total" | "best" | "best_n" | "section" | "special";
  best_n: number | null;
  special_code: string | null;
};

type Stitch = {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  scoring_type: string;
  shots_per_pass: number | null;
  max_passes: number | null;
  ranking_mode: string;
  active: boolean;
  program_id: string | null;
  price_chf: number;
  additional_pass_price_chf: number;
};

const emptyForm = {
  name: "",
  programId: "",
  price: "0.00",
  additionalPassPrice: "0.00",
  maxPasses: "1",
  active: true,
};

export default function ShootingEventProgramPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStitches() {
    const { data, error } = await supabase
      .from("shooting_event_stitches")
      .select(
        "id, name, code, sort_order, scoring_type, shots_per_pass, max_passes, ranking_mode, active, program_id, price_chf, additional_pass_price_chf"
      )
      .eq("shooting_event_id", eventId)
      .order("sort_order");

    if (error) {
      setMessage(`Stiche konnten nicht geladen werden: ${error.message}`);
      return;
    }

    setStitches((data ?? []) as Stitch[]);
  }

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

      const [
        { data: eventData, error: eventError },
        { data: programData, error: programError },
      ] = await Promise.all([
        supabase
          .from("shooting_events")
          .select("id, name")
          .eq("owner_id", user.id)
          .eq("id", eventId)
          .single(),
        supabase
          .from("shooting_programs")
          .select(
            "id, code, name, scoring_type, single_shots, series_shots, ranking_type, best_n, special_code"
          )
          .eq("active", true)
          .order("code"),
      ]);

      if (eventError || !eventData) {
        setMessage(
          `Schiessanlass konnte nicht geladen werden: ${
            eventError?.message ?? "Nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      if (programError) {
        setMessage(`Programme konnten nicht geladen werden: ${programError.message}`);
        setLoading(false);
        return;
      }

      setEventName(eventData.name);
      setPrograms((programData ?? []) as Program[]);
      await loadStitches();
      setLoading(false);
    }

    loadData();
  }, [eventId, router]);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === form.programId) ?? null,
    [programs, form.programId]
  );

  function programShots(program: Program) {
    return program.single_shots + program.series_shots;
  }

  function suggestedMaxPasses(program: Program) {
    return program.ranking_type === "best_n" ? 12 : 1;
  }

  function selectProgram(programId: string) {
    const program = programs.find((item) => item.id === programId);

    setForm((current) => ({
      ...current,
      programId,
      maxPasses:
        editingId || !program
          ? current.maxPasses
          : String(suggestedMaxPasses(program)),
    }));
  }

  function makeCode(name: string) {
    const base = name
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return base || `STICH_${Date.now()}`;
  }

  function startEdit(stitch: Stitch) {
    setEditingId(stitch.id);
    setForm({
      name: stitch.name,
      programId: stitch.program_id ?? "",
      price: Number(stitch.price_chf).toFixed(2),
      additionalPassPrice: Number(stitch.additional_pass_price_chf).toFixed(2),
      maxPasses: String(stitch.max_passes ?? 1),
      active: stitch.active,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const program = programs.find((item) => item.id === form.programId);

    if (!form.name.trim()) {
      setMessage("Bitte einen Stichnamen eingeben.");
      return;
    }

    if (!program) {
      setMessage("Bitte ein Programm auswählen.");
      return;
    }

    const price = Number(form.price);
    const additionalPrice = Number(form.additionalPassPrice);
    const maxPasses = Number(form.maxPasses);

    if (!Number.isFinite(price) || price < 0) {
      setMessage("Bitte einen gültigen Preis eingeben.");
      return;
    }

    if (!Number.isFinite(additionalPrice) || additionalPrice < 0) {
      setMessage("Bitte einen gültigen Zusatzpass-Preis eingeben.");
      return;
    }

    if (!Number.isInteger(maxPasses) || maxPasses < 1) {
      setMessage("Maximale Passen muss mindestens 1 sein.");
      return;
    }

    setSaving(true);
    setMessage("");

    const shotsPerPass = programShots(program);
    const scoringType =
      program.scoring_type === "SPECIAL"
        ? program.special_code === "RUETLI"
          ? "A5"
          : "A10"
        : program.scoring_type;

    const rankingMode =
      program.special_code === "RUETLI"
        ? "total_plus_hits"
        : program.ranking_type === "best_n"
          ? "best_five"
          : program.ranking_type === "best"
            ? "best_shot"
            : program.ranking_type;

    if (editingId) {
      const { error } = await supabase
        .from("shooting_event_stitches")
        .update({
          name: form.name.trim(),
          program_id: program.id,
          scoring_type: scoringType,
          shots_per_pass: shotsPerPass,
          max_passes: maxPasses,
          ranking_mode: rankingMode,
          price_chf: price,
          additional_pass_price_chf: additionalPrice,
          active: form.active,
        })
        .eq("id", editingId);

      if (error) {
        setMessage(`Stich konnte nicht gespeichert werden: ${error.message}`);
        setSaving(false);
        return;
      }
    } else {
      const nextSortOrder =
        stitches.length === 0
          ? 1
          : Math.max(...stitches.map((stitch) => stitch.sort_order)) + 1;

      let code = makeCode(form.name);

      if (stitches.some((stitch) => stitch.code === code)) {
        code = `${code}_${nextSortOrder}`;
      }

      const { error } = await supabase
        .from("shooting_event_stitches")
        .insert({
          shooting_event_id: eventId,
          name: form.name.trim(),
          code,
          sort_order: nextSortOrder,
          scoring_type: scoringType,
          shots_per_pass: shotsPerPass,
          max_passes: maxPasses,
          ranking_mode: rankingMode,
          active: form.active,
          program_id: program.id,
          price_chf: price,
          additional_pass_price_chf: additionalPrice,
        });

      if (error) {
        setMessage(`Stich konnte nicht erstellt werden: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    setEditingId(null);
    setForm(emptyForm);
    await loadStitches();
    setMessage("Programm gespeichert.");
    setSaving(false);
  }

  async function moveStitch(stitch: Stitch, direction: -1 | 1) {
    const index = stitches.findIndex((item) => item.id === stitch.id);
    const other = stitches[index + direction];

    if (!other) return;

    setMessage("");

    const first = await supabase
      .from("shooting_event_stitches")
      .update({ sort_order: other.sort_order })
      .eq("id", stitch.id);

    if (first.error) {
      setMessage(`Reihenfolge konnte nicht geändert werden: ${first.error.message}`);
      return;
    }

    const second = await supabase
      .from("shooting_event_stitches")
      .update({ sort_order: stitch.sort_order })
      .eq("id", other.id);

    if (second.error) {
      await supabase
        .from("shooting_event_stitches")
        .update({ sort_order: stitch.sort_order })
        .eq("id", stitch.id);

      setMessage(`Reihenfolge konnte nicht geändert werden: ${second.error.message}`);
      return;
    }

    await loadStitches();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Programm wird geladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="font-bold text-slate-900">
            EasyShooter
          </Link>

          <Link
            href={`/shooting-events/${eventId}`}
            className="text-sm text-slate-600"
          >
            ← Anlass
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div>
          <p className="text-sm font-semibold text-red-600">{eventName}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Programm</h1>
          <p className="mt-2 text-slate-600">
            Stiche, Schiessprogramme, Preise und Passen des Anlasses verwalten.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? "Stich bearbeiten" : "Stich hinzufügen"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Abbrechen
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="form-label">Stichname</label>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="form-input"
                placeholder="z. B. Kunst"
              />
            </div>

            <div>
              <label className="form-label">Schiessprogramm</label>
              <select
                value={form.programId}
                onChange={(event) => selectProgram(event.target.value)}
                className="form-select"
              >
                <option value="">Programm auswählen...</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.code} · {program.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Preis</label>
        <div className="flex items-center gap-2">
  <span className="font-medium text-slate-600">CHF</span>
  <input
    type="number"
    min="0"
    step="0.05"
    value={form.price}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        price: event.target.value,
      }))
    }
    className="form-input"
  />
</div>
            </div>

            <div>
              <label className="form-label">Preis zusätzliche Passe</label>
      <div className="flex items-center gap-2">
  <span className="font-medium text-slate-600">CHF</span>
  <input
    type="number"
    min="0"
    step="0.05"
    value={form.additionalPassPrice}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        additionalPassPrice: event.target.value,
      }))
    }
    className="form-input"
  />
</div>
            </div>

            <div>
              <label className="form-label">Maximale Passen</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxPasses}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxPasses: event.target.value,
                  }))
                }
                className="form-input"
              />
            </div>

            <label className="flex items-center gap-3 self-end rounded-xl border p-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <span className="font-medium text-slate-800">Stich aktiv</span>
            </label>
          </div>

          {selectedProgram && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <span className="font-semibold">Programm:</span>{" "}
              {selectedProgram.code} · Wertung {selectedProgram.scoring_type} ·{" "}
              {programShots(selectedProgram)} Schüsse
              {selectedProgram.series_shots > 0
                ? ` (${selectedProgram.single_shots} Einzel + ${selectedProgram.series_shots} Serie)`
                : ""}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving
                ? "Wird gespeichert..."
                : editingId
                  ? "Änderungen speichern"
                  : "Stich hinzufügen"}
            </button>
          </div>
        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        {editingId && (
          <div className="mt-8">
            <PayoutSettingsSection
              supabase={supabase}
              stitchId={editingId}
              stitchPriceChf={Number(form.price) || 0}
            />
          </div>
        )}

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Stiche
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Die Reihenfolge wird auch im Anlass verwendet.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
              {stitches.length}
            </span>
          </div>

          {stitches.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed p-6 text-slate-500">
              Noch keine Stiche vorhanden.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Stich</th>
                    <th className="py-2 pr-3">Programm</th>
                    <th className="py-2 pr-3 text-right">Preis</th>
                    <th className="py-2 pr-3 text-right">Zusatzpass</th>
                    <th className="py-2 pr-3 text-right">Passen</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Aktionen</th>
                  </tr>
                </thead>

                <tbody>
                  {stitches.map((stitch, index) => {
                    const program = programs.find(
                      (item) => item.id === stitch.program_id
                    );

                    return (
                      <tr key={stitch.id} className="border-b border-slate-100">
                        <td className="py-3 pr-3">{index + 1}</td>
                        <td className="py-3 pr-3 font-semibold text-slate-900">
                          {stitch.name}
                        </td>
                        <td className="py-3 pr-3">{program?.code ?? "–"}</td>
                        <td className="py-3 pr-3 text-right">
                          CHF {Number(stitch.price_chf).toFixed(2)}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          CHF {Number(stitch.additional_pass_price_chf).toFixed(2)}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          {stitch.max_passes ?? 1}
                        </td>
                        <td className="py-3 pr-3">
                          {stitch.active ? "Aktiv" : "Inaktiv"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => moveStitch(stitch, -1)}
                              disabled={index === 0}
                              className="rounded border px-2 py-1 disabled:opacity-30"
                              title="Nach oben"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStitch(stitch, 1)}
                              disabled={index === stitches.length - 1}
                              className="rounded border px-2 py-1 disabled:opacity-30"
                              title="Nach unten"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(stitch)}
                              className="rounded border px-3 py-1 font-semibold"
                            >
                              Bearbeiten
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
