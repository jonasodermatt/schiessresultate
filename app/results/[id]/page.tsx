"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Target from "../../../components/Target";

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
  distance_m: number | null;
  shooting_position: string | null;
  iris_setting: number | null;
  front_sight_setting: number | null;
  input_type: string;
  shot_mode: string;
  planned_shots: number | null;
  actual_shots: number;
  total_score: number;
  average_score: number;
  notes: string | null;
  shooting_range_id: string | null;
  equipment: Equipment | Equipment[] | null;
  shooting_ranges:
    | { name: string; city: string | null; distance_m: number | null }
    | { name: string; city: string | null; distance_m: number | null }[]
    | null;
  weather_temperature: number | null;
  weather_humidity: number | null;
  weather_pressure: number | null;
  weather_wind_speed: number | null;
  weather_wind_direction: number | null;
  weather_code: number | null;
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
          distance_m,
          shooting_position,
          iris_setting,
          front_sight_setting,
          input_type,
          shot_mode,
          planned_shots,
          actual_shots,
          total_score,
          average_score,
          notes,
          shooting_range_id,
          weather_temperature,
          weather_humidity,
          weather_pressure,
          weather_wind_speed,
          weather_wind_direction,
          weather_code,
          equipment (name, manufacturer, model),
          shooting_ranges (name, city, distance_m),
          result_shots (id, shot_number, score, x_position, y_position)
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
    if (!result?.equipment) return null;
    return Array.isArray(result.equipment)
      ? result.equipment[0] ?? null
      : result.equipment;
  }

  function getShootingRange() {
    if (!result?.shooting_ranges) return null;
    return Array.isArray(result.shooting_ranges)
      ? result.shooting_ranges[0] ?? null
      : result.shooting_ranges;
  }

  function getEquipmentPositionLabel(position: string | null) {
    if (!position) return null;

    const labels: Record<string, string> = {
      prone: "Liegend",
      standing: "Stehend",
      kneeling: "Kniend",
      sitting: "Sitzend",
      supported: "Aufgelegt",
      other: "Andere",
    };

    return labels[position] ?? position;
  }

  function getWeatherDescription(code: number | null) {
    if (code === null) return null;
    if (code === 0) return "Klar";
    if (code === 1) return "Überwiegend klar";
    if (code === 2) return "Teilweise bewölkt";
    if (code === 3) return "Bewölkt";
    if (code === 45 || code === 48) return "Nebel";
    if (code >= 51 && code <= 57) return "Nieselregen";
    if (code >= 61 && code <= 67) return "Regen";
    if (code >= 71 && code <= 77) return "Schnee";
    if (code >= 80 && code <= 82) return "Regenschauer";
    if (code >= 85 && code <= 86) return "Schneeschauer";
    if (code >= 95 && code <= 99) return "Gewitter";
    return "Unbekannt";
  }

  function getWeatherIcon(code: number | null) {
    if (code === null) return "❓";
    if (code === 0) return "☀️";
    if (code === 1) return "🌤️";
    if (code === 2) return "⛅";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 57) return "🌦️";
    if (code >= 61 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "🌨️";
    if (code >= 80 && code <= 82) return "🌦️";
    if (code >= 85 && code <= 86) return "🌨️";
    if (code >= 95 && code <= 99) return "⛈️";
    return "❓";
  }

  function getWindDirection(degrees: number | null) {
    if (degrees === null) return null;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(degrees / 45) % 8];
  }

  async function deleteResult() {
    if (!result) return;

    const confirmed = window.confirm(
      "Möchtest du dieses Resultat wirklich löschen? Die Einzelschüsse werden ebenfalls gelöscht."
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    const { error } = await supabase.from("results").delete().eq("id", result.id);

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
        <p className="text-slate-600">Resultat wird geladen...</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-white p-8">
            <h1 className="text-xl font-bold text-slate-900">Resultat nicht gefunden</h1>
            <p className="mt-2 text-slate-600">
              {message || "Dieses Resultat ist nicht verfügbar."}
            </p>
            <Link href="/results" className="mt-5 inline-block font-semibold text-red-600">
              ← Zurück zu meinen Resultaten
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const equipment = getEquipment();
  const shootingRange = getShootingRange();
  const isCrossbow30m =
  result.distance_m === 30 &&
  equipment?.name.toLowerCase().includes("armbrust");

const targetType = isCrossbow30m
  ? "crossbow30m"
  : "default";
  const shots = [...(result.result_shots ?? [])].sort(
    (a, b) => a.shot_number - b.shot_number
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">
              ◎
            </div>
            <div>
              <p className="font-bold text-slate-900">EasyShooter</p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Deine Resultate. Deine Entwicklung.
              </p>
            </div>
          </Link>
          <Link href="/results" className="text-sm font-medium text-slate-600">
            ← Meine Resultate
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6">
          <p className="text-sm text-slate-500">{formatDate(result.date)}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{result.discipline}</h1>

          {shootingRange && (
            <p className="mt-2 text-slate-600">
              📍 {shootingRange.name}
              {shootingRange.city ? ` · ${shootingRange.city}` : ""}
              {shootingRange.distance_m !== null
                ? ` · ${shootingRange.distance_m} m`
                : ""}
            </p>
          )}

          {result.weather_temperature !== null && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-700 sm:grid-cols-3">
              <div className="flex items-center gap-2"><span className="text-xl">🌡️</span><span>Temperatur: {result.weather_temperature} °C</span></div>
              <div className="flex items-center gap-2"><span className="text-xl">💧</span><span>Luftfeuchtigkeit: {result.weather_humidity} %</span></div>
              <div className="flex items-center gap-2"><span className="text-xl">🔵</span><span>Luftdruck: {result.weather_pressure} hPa</span></div>
              <div className="flex items-center gap-2"><span className="text-xl">💨</span><span>Wind: {result.weather_wind_speed} km/h</span></div>
              <div className="flex items-center gap-2"><span className="text-xl">🧭</span><span>Windrichtung: {getWindDirection(result.weather_wind_direction)} ({result.weather_wind_direction}°)</span></div>
              <div className="flex items-center gap-2"><span className="text-xl">{getWeatherIcon(result.weather_code)}</span><span>Wetter: {getWeatherDescription(result.weather_code)}</span></div>
            </div>
          )}

          {equipment && (
            <p className="mt-2 text-slate-600">
              🔫 { [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || equipment.name }
            </p>
          )}
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{Number(result.total_score).toFixed(0)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">Schüsse</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{result.actual_shots}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-slate-500">Durchschnitt</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{Number(result.average_score).toFixed(2)}</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Training</h2>
          <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Distanz</p><p className="mt-1 font-medium text-slate-900">{result.distance_m !== null ? `${result.distance_m} m` : "–"}</p></div>
            <div><p className="text-xs text-slate-500">Stellung</p><p className="mt-1 font-medium text-slate-900">{getEquipmentPositionLabel(result.shooting_position) ?? "–"}</p></div>
            <div><p className="text-xs text-slate-500">Irisblende</p><p className="mt-1 font-medium text-slate-900">{result.iris_setting !== null ? `${result.iris_setting} mm` : "–"}</p></div>
            <div><p className="text-xs text-slate-500">Korneinstellung</p><p className="mt-1 font-medium text-slate-900">{result.front_sight_setting !== null ? `${result.front_sight_setting} mm` : "–"}</p></div>
            <div><p className="text-xs text-slate-500">Erfassung</p><p className="mt-1 font-medium text-slate-900">{result.input_type === "individual" ? "Einzelschüsse" : "Nur Total"}</p></div>
            <div><p className="text-xs text-slate-500">Modus</p><p className="mt-1 font-medium text-slate-900">{result.shot_mode === "free" ? "Freies Training" : "Feste Schusszahl"}</p></div>
          </div>
        </section>

        {shots.some((shot) => shot.x_position !== null && shot.y_position !== null) && (
          <section className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Schussbild</h2>
            <p className="mt-1 text-sm text-slate-500">Alle Treffer mit gespeicherter Position.</p>
            <div className="mt-6">
              <Target
  selectedX={null}
  selectedY={null}
  selectedScore={null}
  targetType={targetType}
  readOnly
  shots={shots}
/>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Die Zahl im Treffer entspricht der Schussnummer.
            </p>
          </section>
        )}

        <div className="mt-5 border-t pt-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full bg-white text-sm text-slate-900">
              <thead className="bg-white text-left text-slate-900">
                <tr>
                  <th className="px-6 py-3 font-normal" style={{ textAlign: "right" }}>Schuss</th>
                  <th className="px-6 py-3 font-normal" style={{ textAlign: "right" }}>Wert</th>
                  <th className="px-6 py-3 font-normal" style={{ textAlign: "left" }}>Bemerkung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
                {shots.map((shot) => (
                  <tr key={shot.id}>
                    <td className="px-6 py-2" style={{ textAlign: "right" }}>{shot.shot_number}</td>
                    <td className="px-6 py-2" style={{ textAlign: "right" }}>{Number(shot.score)}</td>
                    <td className="px-6 py-2" style={{ textAlign: "left" }}>{shot.x_position === null || shot.y_position === null ? "ohne Position" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {result.notes && (
          <section className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Notiz</h2>
            <p className="mt-3 whitespace-pre-wrap text-slate-600">{result.notes}</p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-dashed bg-white p-6">
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="font-bold text-slate-900">Resultat verwalten</h2>
            <p className="mt-1 text-sm text-slate-500">Du kannst dieses Resultat bearbeiten oder löschen.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href={`/results/${result.id}/edit`} className="rounded-lg border-2 border-slate-900 bg-white px-5 py-3 text-center text-sm font-bold text-slate-900 hover:bg-slate-100">
                ✏️ Resultat bearbeiten
              </Link>
              <button type="button" onClick={deleteResult} disabled={deleting} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                {deleting ? "Wird gelöscht..." : "Resultat löschen"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
