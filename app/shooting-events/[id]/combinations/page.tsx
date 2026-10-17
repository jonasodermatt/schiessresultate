"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Combination = {
  id: string;
  shooting_event_id: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  tie_break_mode: "age_older" | "age_younger" | "stitch" | "alphabetical";
  tie_break_stitch_id: string | null;
};

type Stitch = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

type CombinationStitch = {
  id: string;
  combination_id: string;
  event_stitch_id: string;
  weight_percent: number;
  sort_order: number;
};

export default function ShootingEventCombinationsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [combinationStitches, setCombinationStitches] = useState<
    CombinationStitch[]
  >([]);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [selectedStitchByCombination, setSelectedStitchByCombination] =
    useState<Record<string, string>>({});
  const [weightByCombination, setWeightByCombination] =
    useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCombinations() {
    const { data, error } = await supabase
      .from("shooting_event_combinations")
      .select("id, shooting_event_id, name, description, active, sort_order, tie_break_mode, tie_break_stitch_id")
      .eq("shooting_event_id", eventId)
      .order("sort_order")
      .order("name");

    if (error) throw new Error(error.message);
    setCombinations((data ?? []) as Combination[]);
    return (data ?? []) as Combination[];
  }

  async function loadCombinationStitches(combinationIds?: string[]) {
    let ids = combinationIds;

    if (!ids) {
      ids = combinations.map((combination) => combination.id);
    }

    if (ids.length === 0) {
      setCombinationStitches([]);
      return;
    }

    const { data, error } = await supabase
      .from("shooting_event_combination_stitches")
      .select(
        "id, combination_id, event_stitch_id, weight_percent, sort_order"
      )
      .in("combination_id", ids)
      .order("sort_order");

    if (error) throw new Error(error.message);

    setCombinationStitches(
      ((data ?? []) as CombinationStitch[]).map((row) => ({
        ...row,
        weight_percent: Number(row.weight_percent),
      }))
    );
  }

  async function refresh() {
    const loaded = await loadCombinations();
    await loadCombinationStitches(loaded.map((combination) => combination.id));
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
      setMessage("");

      try {
        const { data: eventData, error: eventError } = await supabase
          .from("shooting_events")
          .select("id, name")
          .eq("owner_id", user.id)
          .eq("id", eventId)
          .single();

        if (eventError || !eventData) {
          throw new Error(
            eventError?.message ?? "Schiessanlass nicht gefunden."
          );
        }

        setEventName(eventData.name);

        const { data: stitchData, error: stitchError } = await supabase
          .from("shooting_event_stitches")
          .select("id, name, sort_order, active")
          .eq("shooting_event_id", eventId)
          .eq("active", true)
          .order("sort_order");

        if (stitchError) throw new Error(stitchError.message);

        setStitches((stitchData ?? []) as Stitch[]);

        const loaded = await loadCombinations();
        await loadCombinationStitches(
          loaded.map((combination) => combination.id)
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unbekannter Fehler."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [eventId, router]);

  const stitchById = useMemo(
    () => new Map(stitches.map((stitch) => [stitch.id, stitch])),
    [stitches]
  );

  function rowsForCombination(combinationId: string) {
    return combinationStitches
      .filter((row) => row.combination_id === combinationId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function availableStitches(combinationId: string) {
    const usedIds = new Set(
      rowsForCombination(combinationId).map((row) => row.event_stitch_id)
    );

    return stitches.filter((stitch) => !usedIds.has(stitch.id));
  }

  async function createCombination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newName.trim();

    if (!name) {
      setMessage("Bitte einen Namen für die Kombination erfassen.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const nextSortOrder =
        combinations.length === 0
          ? 1
          : Math.max(...combinations.map((item) => item.sort_order)) + 1;

      const { error } = await supabase
        .from("shooting_event_combinations")
        .insert({
          shooting_event_id: eventId,
          name,
          description: newDescription.trim() || null,
          active: true,
          sort_order: nextSortOrder,
          tie_break_mode: "age_older",
          tie_break_stitch_id: null,
        });

      if (error) throw new Error(error.message);

      setNewName("");
      setNewDescription("");
      await refresh();
      setMessage("Kombination erstellt.");
    } catch (error) {
      setMessage(
        `Kombination konnte nicht erstellt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(combination: Combination) {
    setEditingId(combination.id);
    setEditName(combination.name);
    setEditDescription(combination.description ?? "");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  }

  async function saveCombination(combination: Combination) {
    const name = editName.trim();

    if (!name) {
      setMessage("Bitte einen Namen für die Kombination erfassen.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combinations")
        .update({
          name,
          description: editDescription.trim() || null,
        })
        .eq("id", combination.id);

      if (error) throw new Error(error.message);

      cancelEdit();
      await refresh();
      setMessage("Kombination gespeichert.");
    } catch (error) {
      setMessage(
        `Kombination konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTieBreak(
    combination: Combination,
    mode: Combination["tie_break_mode"],
    stitchId: string | null = combination.tie_break_stitch_id
  ) {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combinations")
        .update({
          tie_break_mode: mode,
          tie_break_stitch_id:
            mode === "stitch" ? stitchId || null : null,
        })
        .eq("id", combination.id);

      if (error) throw new Error(error.message);

      await refresh();
      setMessage("Stichentscheid gespeichert.");
    } catch (error) {
      setMessage(
        `Stichentscheid konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCombination(combination: Combination) {
    if (
      !window.confirm(
        `Kombination "${combination.name}" wirklich löschen?`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combinations")
        .delete()
        .eq("id", combination.id);

      if (error) throw new Error(error.message);

      await refresh();
      setMessage("Kombination gelöscht.");
    } catch (error) {
      setMessage(
        `Kombination konnte nicht gelöscht werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function addStitch(combination: Combination) {
    const stitchId =
      selectedStitchByCombination[combination.id] ?? "";
    const weightText =
      weightByCombination[combination.id] ?? "";
    const weight = Number(weightText);

    if (!stitchId) {
      setMessage("Bitte einen Stich auswählen.");
      return;
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage("Bitte eine gültige Gewichtung grösser als 0 eingeben.");
      return;
    }

    const rows = rowsForCombination(combination.id);
    const nextSortOrder =
      rows.length === 0
        ? 1
        : Math.max(...rows.map((row) => row.sort_order)) + 1;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combination_stitches")
        .insert({
          combination_id: combination.id,
          event_stitch_id: stitchId,
          weight_percent: weight,
          sort_order: nextSortOrder,
        });

      if (error) throw new Error(error.message);

      setSelectedStitchByCombination((current) => ({
        ...current,
        [combination.id]: "",
      }));
      setWeightByCombination((current) => ({
        ...current,
        [combination.id]: "",
      }));

      await loadCombinationStitches(
        combinations.map((item) => item.id)
      );
      setMessage("Stich hinzugefügt.");
    } catch (error) {
      setMessage(
        `Stich konnte nicht hinzugefügt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateWeight(row: CombinationStitch, value: string) {
    const weight = Number(value);

    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage("Die Gewichtung muss grösser als 0 sein.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combination_stitches")
        .update({ weight_percent: weight })
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      await loadCombinationStitches(
        combinations.map((item) => item.id)
      );
      setMessage("Gewichtung gespeichert.");
    } catch (error) {
      setMessage(
        `Gewichtung konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeStitch(row: CombinationStitch) {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_combination_stitches")
        .delete()
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      await loadCombinationStitches(
        combinations.map((item) => item.id)
      );
      setMessage("Stich aus Kombination entfernt.");
    } catch (error) {
      setMessage(
        `Stich konnte nicht entfernt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveCombination(
    combination: Combination,
    direction: -1 | 1
  ) {
    const ordered = [...combinations].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const index = ordered.findIndex(
      (item) => item.id === combination.id
    );
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];

    setSaving(true);
    setMessage("");

    try {
      const { error: firstError } = await supabase
        .from("shooting_event_combinations")
        .update({ sort_order: target.sort_order })
        .eq("id", combination.id);

      if (firstError) throw new Error(firstError.message);

      const { error: secondError } = await supabase
        .from("shooting_event_combinations")
        .update({ sort_order: combination.sort_order })
        .eq("id", target.id);

      if (secondError) throw new Error(secondError.message);

      await refresh();
    } catch (error) {
      setMessage(
        `Reihenfolge konnte nicht geändert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Kombinationen werden geladen...
        </p>
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
          <p className="text-sm font-semibold text-red-600">
            {eventName}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Kombinationen
          </h1>
          <p className="mt-2 text-slate-600">
            Stiche zu Gesamtwertungen wie Tagessieger zusammenfassen. Die Gewichtung bestimmt, welcher Anteil des jeweiligen Stichresultats zählt.
          </p>
        </div>

        <form
          onSubmit={createCombination}
          className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-900">
            Neue Kombination
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">
                Name
              </label>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="form-input"
                placeholder="z. B. Tagessieger"
              />
            </div>

            <div>
              <label className="form-label">
                Beschreibung
              </label>
              <input
                value={newDescription}
                onChange={(event) =>
                  setNewDescription(event.target.value)
                }
                className="form-input"
                placeholder="optional"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary mt-5"
          >
            Kombination erstellen
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {combinations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">
              Noch keine Kombination vorhanden.
            </div>
          ) : (
            combinations.map((combination, index) => {
              const rows = rowsForCombination(combination.id);
              const available = availableStitches(combination.id);
              const editing = editingId === combination.id;

              return (
                <section
                  key={combination.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      {editing ? (
                        <div className="grid max-w-2xl gap-3 md:grid-cols-2">
                          <div>
                            <label className="form-label">
                              Name
                            </label>
                            <input
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                              className="form-input"
                            />
                          </div>

                          <div>
                            <label className="form-label">
                              Beschreibung
                            </label>
                            <input
                              value={editDescription}
                              onChange={(event) =>
                                setEditDescription(event.target.value)
                              }
                              className="form-input"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-xl font-bold text-slate-900">
                            {combination.name}
                          </h2>
                          {combination.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {combination.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving || index === 0}
                        onClick={() =>
                          void moveCombination(combination, -1)
                        }
                        className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving ||
                          index === combinations.length - 1
                        }
                        onClick={() =>
                          void moveCombination(combination, 1)
                        }
                        className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"
                      >
                        ↓
                      </button>

                      {editing ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border px-3 py-2 text-sm font-semibold"
                          >
                            Abbrechen
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void saveCombination(combination)
                            }
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Speichern
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(combination)}
                            className="rounded-lg border px-3 py-2 text-sm font-semibold"
                          >
                            Bearbeiten
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void deleteCombination(combination)
                            }
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            Löschen
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">
                      Stichentscheid bei Punktegleichheit
                    </h3>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="form-label">
                          Rangierungsoption
                        </label>
                        <select
                          value={combination.tie_break_mode}
                          onChange={(event) =>
                            void saveTieBreak(
                              combination,
                              event.target.value as Combination["tie_break_mode"],
                              combination.tie_break_stitch_id
                            )
                          }
                          disabled={saving}
                          className="form-select"
                        >
                          <option value="age_older">
                            Älterer Schütze zuerst
                          </option>
                          <option value="age_younger">
                            Jüngerer Schütze zuerst
                          </option>
                          <option value="stitch">
                            Höheres Resultat in bestimmtem Stich
                          </option>
                          <option value="alphabetical">
                            Alphabetisch
                          </option>
                        </select>
                      </div>

                      {combination.tie_break_mode === "stitch" && (
                        <div>
                          <label className="form-label">
                            Stich für Stichentscheid
                          </label>
                          <select
                            value={combination.tie_break_stitch_id ?? ""}
                            onChange={(event) =>
                              void saveTieBreak(
                                combination,
                                "stitch",
                                event.target.value || null
                              )
                            }
                            disabled={saving}
                            className="form-select"
                          >
                            <option value="">
                              Stich auswählen...
                            </option>
                            {rows.map((row) => {
                              const stitch = stitchById.get(
                                row.event_stitch_id
                              );

                              return (
                                <option
                                  key={row.event_stitch_id}
                                  value={row.event_stitch_id}
                                >
                                  {stitch?.name ?? "Unbekannter Stich"}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500">
                          <th className="py-2 pr-4">Stich</th>
                          <th className="py-2 pr-4">
                            Anteil des Resultats
                          </th>
                          <th className="py-2 text-right">
                            Aktion
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-5 text-center text-slate-500"
                            >
                              Noch keine Stiche zugeteilt.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-slate-100"
                            >
                              <td className="py-3 pr-4 font-medium">
                                {stitchById.get(row.event_stitch_id)
                                  ?.name ?? "Unbekannter Stich"}
                              </td>

                              <td className="py-3 pr-4">
                                <div className="flex max-w-40 items-center gap-2">
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    defaultValue={row.weight_percent}
                                    onBlur={(event) => {
                                      const value = event.target.value;

                                      if (
                                        Number(value) !==
                                        Number(row.weight_percent)
                                      ) {
                                        void updateWeight(row, value);
                                      }
                                    }}
                                    className="form-input"
                                  />
                                  <span>%</span>
                                </div>
                              </td>

                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void removeStitch(row)}
                                  className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700"
                                >
                                  Entfernen
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {available.length > 0 && (
                    <div className="mt-5 border-t pt-5">
                      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
                        <div>
                          <label className="form-label">
                            Stich hinzufügen
                          </label>
                          <select
                            value={
                              selectedStitchByCombination[
                                combination.id
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setSelectedStitchByCombination(
                                (current) => ({
                                  ...current,
                                  [combination.id]:
                                    event.target.value,
                                })
                              )
                            }
                            className="form-select"
                          >
                            <option value="">
                              Stich auswählen...
                            </option>

                            {available.map((stitch) => (
                              <option
                                key={stitch.id}
                                value={stitch.id}
                              >
                                {stitch.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label">
                            Anteil des Resultats %
                          </label>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={
                              weightByCombination[
                                combination.id
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setWeightByCombination(
                                (current) => ({
                                  ...current,
                                  [combination.id]:
                                    event.target.value,
                                })
                              )
                            }
                            className="form-input"
                            placeholder="z. B. 10"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void addStitch(combination)
                          }
                          className="btn-primary"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
