"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Club = {
  id: string;
  name: string;
  city: string | null;
};

type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number | null;
};

export default function NewShootingEventPage() {
  const router = useRouter();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [ranges, setRanges] = useState<ShootingRange[]>([]);

  const [clubId, setClubId] = useState("");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [shootingRangeId, setShootingRangeId] = useState("");
  const [distanceM, setDistanceM] = useState("300");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");

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

      setLoading(true);
      setMessage("");

      const [
        { data: clubData, error: clubError },
        { data: rangeData, error: rangeError },
      ] = await Promise.all([
        supabase
          .from("clubs")
          .select("id, name, city")
          .order("name"),
        supabase
          .from("shooting_ranges")
          .select("id, name, city, distance_m")
          .eq("active", true)
          .order("name"),
      ]);

      if (clubError) {
        setMessage(
          `Vereine konnten nicht geladen werden: ${clubError.message}`
        );
        setLoading(false);
        return;
      }

      if (rangeError) {
        setMessage(
          `Schiessstände konnten nicht geladen werden: ${rangeError.message}`
        );
        setLoading(false);
        return;
      }

      const loadedClubs = (clubData ?? []) as Club[];
      const loadedRanges = (rangeData ?? []) as ShootingRange[];

      setClubs(loadedClubs);
      setRanges(loadedRanges);

      if (loadedClubs.length === 1) {
        setClubId(loadedClubs[0].id);
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  const selectedRange = useMemo(
    () => ranges.find((range) => range.id === shootingRangeId),
    [ranges, shootingRangeId]
  );

  function handleRangeChange(value: string) {
    setShootingRangeId(value);

    const selected = ranges.find((range) => range.id === value);

    if (selected?.distance_m) {
      setDistanceM(String(selected.distance_m));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clubId) {
      setMessage("Bitte einen Verein auswählen.");
      return;
    }

    if (!name.trim()) {
      setMessage("Bitte einen Namen für den Schiessanlass eingeben.");
      return;
    }

    if (!eventDate) {
      setMessage("Bitte ein Datum auswählen.");
      return;
    }

    const parsedDistance = Number(distanceM);

    if (
      !Number.isInteger(parsedDistance) ||
      parsedDistance <= 0
    ) {
      setMessage("Bitte eine gültige Distanz eingeben.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("shooting_events")
      .insert({
        club_id: clubId,
        name: name.trim(),
        event_date: eventDate,
        shooting_range_id: shootingRangeId || null,
        distance_m: parsedDistance,
        notes: notes.trim() || null,
        status,
      })
      .select("id")
      .single();

    if (error || !data) {
      setMessage(
        `Schiessanlass konnte nicht erstellt werden: ${
          error?.message ?? "Unbekannter Fehler"
        }`
      );
      setSaving(false);
      return;
    }

    router.push(`/shooting-events/${data.id}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Neuer Schiessanlass wird vorbereitet...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
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

      <div className="mx-auto max-w-4xl px-5 py-8">
        <div>
          <p className="text-sm font-semibold text-red-600">
            Schiessanlass
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Neuer Schiessanlass
          </h1>

          <p className="mt-2 text-slate-600">
            Erfasse zuerst die Stammdaten. Danach richtest du
            Stiche, Kombinationen und Gruppen ein.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="form-label">
                Verein
              </label>

              <select
                value={clubId}
                onChange={(event) =>
                  setClubId(event.target.value)
                }
                className="form-select"
              >
                <option value="">
                  Verein auswählen...
                </option>

                {clubs.map((club) => (
                  <option
                    key={club.id}
                    value={club.id}
                  >
                    {club.name}
                    {club.city ? ` · ${club.city}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                Status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className="form-select"
              >
                <option value="draft">
                  Entwurf
                </option>
                <option value="open">
                  Offen
                </option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="form-label">
                Name des Schiessanlasses
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                className="form-input"
                placeholder="z. B. Ausschiessen 2027"
              />
            </div>

            <div>
              <label className="form-label">
                Datum
              </label>

              <input
                type="date"
                value={eventDate}
                onChange={(event) =>
                  setEventDate(event.target.value)
                }
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                Distanz
              </label>

              <div className="relative">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={distanceM}
                  onChange={(event) =>
                    setDistanceM(event.target.value)
                  }
                  className="form-input pr-12"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">
                  m
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="form-label">
                Schiessstand
              </label>

              <select
                value={shootingRangeId}
                onChange={(event) =>
                  handleRangeChange(event.target.value)
                }
                className="form-select"
              >
                <option value="">
                  Kein Schiessstand ausgewählt
                </option>

                {ranges.map((range) => (
                  <option
                    key={range.id}
                    value={range.id}
                  >
                    {range.name}
                    {range.city ? ` · ${range.city}` : ""}
                    {range.distance_m
                      ? ` · ${range.distance_m} m`
                      : ""}
                  </option>
                ))}
              </select>

              {selectedRange && (
                <p className="mt-2 text-xs text-slate-500">
                  Die hinterlegte Distanz des Schiessstands wird
                  beim Auswählen vorgeschlagen und kann angepasst
                  werden.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="form-label">
                Notizen
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                className="form-input min-h-28"
                placeholder="Optionale interne Bemerkungen..."
              />
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Wird erstellt..."
                : "Schiessanlass erstellen"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
