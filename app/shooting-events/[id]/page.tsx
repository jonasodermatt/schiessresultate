"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type ShootingEvent = {
  id: string;
  club_id: string;
  name: string;
  event_date: string;
  shooting_range_id: string | null;
  distance_m: number;
  notes: string | null;
  status: string;
};

type Club = {
  id: string;
  name: string;
  city: string | null;
};

type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
};

type Stitch = {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  max_passes: number | null;
  price_chf: number;
  additional_pass_price_chf: number;
  program_id: string | null;
};

type Program = {
  id: string;
  code: string;
  name: string;
};

export default function ShootingEventOverviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventId = params.id;

  const [eventData, setEventData] =
    useState<ShootingEvent | null>(null);
  const [club, setClub] =
    useState<Club | null>(null);
  const [shootingRange, setShootingRange] =
    useState<ShootingRange | null>(null);
  const [stitches, setStitches] =
    useState<Stitch[]>([]);
  const [programs, setPrograms] =
    useState<Program[]>([]);

  const [registrationCount, setRegistrationCount] =
    useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
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

      const { data, error } = await supabase
        .from("shooting_events")
        .select(
          "id, club_id, name, event_date, shooting_range_id, distance_m, notes, status"
        )
        .eq("owner_id", user.id)
        .eq("id", eventId)
        .single();

      if (error || !data) {
        setMessage(
          `Schiessanlass konnte nicht geladen werden: ${
            error?.message ?? "Nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      const loadedEvent =
        data as ShootingEvent;

      setEventData(loadedEvent);

      const clubPromise = supabase
        .from("clubs")
        .select("id, name, city")
        .eq("id", loadedEvent.club_id)
        .single();

      const rangePromise = loadedEvent.shooting_range_id
        ? supabase
            .from("shooting_ranges")
            .select("id, name, city")
            .eq(
              "id",
              loadedEvent.shooting_range_id
            )
            .single()
        : Promise.resolve({
            data: null,
            error: null,
          });

      const stitchPromise = supabase
        .from("shooting_event_stitches")
        .select(
          "id, name, code, sort_order, max_passes, price_chf, additional_pass_price_chf, program_id"
        )
        .eq("shooting_event_id", eventId)
        .eq("active", true)
        .order("sort_order");

      const registrationPromise = supabase
        .from("shooting_event_registrations")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("shooting_event_id", eventId);

      const [
        clubResult,
        rangeResult,
        stitchResult,
        registrationResult,
      ] = await Promise.all([
        clubPromise,
        rangePromise,
        stitchPromise,
        registrationPromise,
      ]);

      if (clubResult.data) {
        setClub(clubResult.data as Club);
      }

      if (rangeResult.data) {
        setShootingRange(
          rangeResult.data as ShootingRange
        );
      }

      if (stitchResult.error) {
        setMessage(
          `Stiche konnten nicht geladen werden: ${stitchResult.error.message}`
        );
        setLoading(false);
        return;
      }

      const loadedStitches =
        (stitchResult.data ?? []) as Stitch[];

      setStitches(loadedStitches);
      setRegistrationCount(
        registrationResult.count ?? 0
      );

      const programIds = Array.from(
        new Set(
          loadedStitches
            .map((stitch) => stitch.program_id)
            .filter(
              (value): value is string =>
                Boolean(value)
            )
        )
      );

      if (programIds.length > 0) {
        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("shooting_programs")
          .select("id, code, name")
          .in("id", programIds);

        if (programError) {
          setMessage(
            `Programme konnten nicht geladen werden: ${programError.message}`
          );
          setLoading(false);
          return;
        }

        setPrograms(
          (programData ?? []) as Program[]
        );
      }

      setLoading(false);
    }

    loadData();
  }, [eventId, router]);

  const programById = useMemo(
    () =>
      new Map(
        programs.map((program) => [
          program.id,
          program,
        ])
      ),
    [programs]
  );

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  }

  function statusText(status: string) {
    if (status === "completed") {
      return "Abgeschlossen";
    }

    if (status === "open") {
      return "Offen";
    }

    return "Entwurf";
  }

  async function deleteEvent() {
    if (!eventData) return;

    const firstConfirm = window.confirm(
      `Schiessanlass "${eventData.name}" wirklich vollständig löschen?\n\nDabei werden Teilnehmer-Zuordnungen, Anmeldungen, Resultate, Gruppen, Kombinationen und Stiche dieses Anlasses endgültig gelöscht.`
    );

    if (!firstConfirm) {
      return;
    }

    const typedName = window.prompt(
      `Zur Bestätigung den Anlassnamen exakt eingeben:\n${eventData.name}`
    );

    if (typedName !== eventData.name) {
      setMessage(
        "Löschen abgebrochen. Der eingegebene Anlassname stimmt nicht überein."
      );
      return;
    }

    setDeleting(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "delete_shooting_event",
        {
          p_event_id: eventId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      router.replace("/dashboard");
    } catch (error) {
      setMessage(
        `Schiessanlass konnte nicht gelöscht werden: ${
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler."
        }`
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Schiessanlass wird geladen...
        </p>
      </main>
    );
  }

  if (!eventData) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">
          {message || "Schiessanlass nicht gefunden."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
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

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">
                  {eventData.name}
                </h1>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {statusText(eventData.status)}
                </span>
              </div>

              <p className="mt-2 text-slate-600">
                {club?.name ?? "Verein"}
                {club?.city
                  ? ` · ${club.city}`
                  : ""}
              </p>
            </div>

            <Link
              href={`/shooting-events/${eventId}/registration`}
              className="inline-flex rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
            >
              Anmeldung öffnen
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Datum
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatDate(eventData.event_date)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Schiessstand
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {shootingRange?.name ?? "–"}
              </p>
              {shootingRange?.city && (
                <p className="mt-1 text-xs text-slate-500">
                  {shootingRange.city}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Distanz
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {eventData.distance_m} m
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Teilnehmer
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {registrationCount}
              </p>
            </div>
          </div>

          {eventData.notes && (
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notizen
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {eventData.notes}
              </p>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900">
            Schiessanlass
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/shooting-events/${eventId}/participants`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                👤
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Teilnehmer
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Schützen hinzufügen und Stammdaten verwalten.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/registration`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                📝
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Anmeldung
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Teilnehmer und gelöste Stiche verwalten.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/capture`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                🎯
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Erfassung
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Resultate nach Schütze erfassen.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/rankings`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                🏆
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Ranglisten
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Einzelranglisten anzeigen und drucken.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/program`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                ⚙️
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Programm
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Stiche, Programme, Preise und Passen einrichten.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/groups`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                👥
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Gruppen
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Gruppen anlegen, Teilnehmer zuteilen und Wertungsstich festlegen.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/combinations`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                🧮
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Kombinationen
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Gesamtwertungen wie Tagessieger konfigurieren.
              </p>
            </Link>

            <Link
              href={`/shooting-events/${eventId}/finances`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-2xl">
                💰
              </div>
              <h3 className="mt-3 font-bold text-slate-900">
                Finanzen
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Einnahmen aus Stichen und Zusatzpassen auswerten.
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Stiche
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Aktuelle Konfiguration des Schiessanlasses.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {stitches.length} Stiche
            </span>
          </div>

          {stitches.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-6">
              <p className="font-semibold text-slate-900">
                Noch keine Stiche eingerichtet
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Als Nächstes bauen wir hier die Einrichtung von
                Stichname, Programm, Preis und Passen ein.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">
                      Stich
                    </th>
                    <th className="py-2 pr-4">
                      Programm
                    </th>
                    <th className="py-2 pr-4 text-right">
                      Preis
                    </th>
                    <th className="py-2 pr-4 text-right">
                      Zusatzpass
                    </th>
                    <th className="py-2 text-right">
                      Max. Passen
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stitches.map((stitch) => {
                    const program = stitch.program_id
                      ? programById.get(
                          stitch.program_id
                        )
                      : undefined;

                    return (
                      <tr
                        key={stitch.id}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {stitch.name}
                        </td>

                        <td className="py-3 pr-4 text-slate-600">
                          {program?.code ?? "–"}
                        </td>

                        <td className="py-3 pr-4 text-right">
                          CHF{" "}
                          {Number(
                            stitch.price_chf
                          ).toFixed(2)}
                        </td>

                        <td className="py-3 pr-4 text-right">
                          CHF{" "}
                          {Number(
                            stitch.additional_pass_price_chf
                          ).toFixed(2)}
                        </td>

                        <td className="py-3 text-right">
                          {stitch.max_passes ?? 1}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-red-700">
                Gefahrenbereich
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Löscht diesen Schiessanlass inklusive aller zugehörigen
                Anmeldungen, Resultate, Gruppen, Kombinationen und Stiche.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void deleteEvent()}
              disabled={deleting}
              className="inline-flex rounded-lg border border-red-300 bg-white px-5 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting
                ? "Wird gelöscht..."
                : "Schiessanlass endgültig löschen"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
