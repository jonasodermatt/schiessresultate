"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import Target from "../../../../components/Target";

type Equipment = {
  id: string;
  name: string;
};
type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number | null;
  latitude: number | null;
  longitude: number | null;
   active: boolean;
};
type Shot = {
  id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};
type Result = {
  id: string;
  date: string;
  discipline: string;
  equipment_id: string;
  shooting_range_id: string | null;
  notes: string | null;
  input_type: string;

  shooting_ranges:
    | {
        name: string;
        city: string | null;
        distance_m: number | null;
      }
    | {
        name: string;
        city: string | null;
        distance_m: number | null;
      }[]
    | null;
};

export default function EditResultPage() {
  const params = useParams();
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [shootingRanges, setShootingRanges] = useState<ShootingRange[]>([]);
const [shootingRangeId, setShootingRangeId] = useState("");
  const [discipline, setDiscipline] = useState("");
 
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [shots, setShots] = useState<Shot[]>([]);
  const [inputType, setInputType] = useState("");
  const [editingShotIndex, setEditingShotIndex] = useState<number | null>(null);
  const [shootingDate, setShootingDate] = useState("");
  const [favoriteShootingRangeIds, setFavoriteShootingRangeIds] =
  useState<string[]>([]);

const [shootingRangeSearch, setShootingRangeSearch] = useState("");

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
const {
  data: shootingRangeData,
  error: shootingRangeError,
} = await supabase
  .from("shooting_ranges")
  .select(
    "id, name, city, distance_m, latitude, longitude, active"
  )
  .eq("active", true)
  .order("name");

if (shootingRangeError) {
  setMessage(
    `Fehler beim Laden der Schiessstände: ${shootingRangeError.message}`
  );
  setLoading(false);
  return;
}

setShootingRanges(shootingRangeData ?? []);
console.log("Schiessstände:", shootingRangeData);
const { data: favoriteData, error: favoriteError } =
  await supabase
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
      const { data: resultData, error: resultError } =
        await supabase
          .from("results")
          .select(`
  id,
  date,
  discipline,
  equipment_id,
  shooting_range_id,
  notes,
  input_type,
  shooting_ranges (
    name,
    city,
    distance_m
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
      const loadedDate = new Date(resultData.date);
const offset = loadedDate.getTimezoneOffset();

const localDate = new Date(
  loadedDate.getTime() - offset * 60 * 1000
);

setShootingDate(localDate.toISOString().slice(0, 16));
      setEquipmentId(resultData.equipment_id);
      setShootingRangeId(
  resultData.shooting_range_id ?? ""
);
if (
  resultData.shooting_range_id &&
  !shootingRangeData?.some(
    (range) => range.id === resultData.shooting_range_id
  )
) {
  const {
    data: historicalRange,
    error: historicalRangeError,
  } = await supabase
    .from("shooting_ranges")
    .select(
      "id, name, city, distance_m, latitude, longitude, active"
    )
    .eq("id", resultData.shooting_range_id)
    .single();

  if (!historicalRangeError && historicalRange) {
    setShootingRanges((current) => [
      historicalRange,
      ...current,
    ]);
  }
}
      setNotes(resultData.notes ?? "");
      setInputType(resultData.input_type);

const loadedShots = [...(resultData.result_shots ?? [])]
  .sort((a, b) => a.shot_number - b.shot_number)
  .map((shot) => ({
    id: shot.id,
    shot_number: shot.shot_number,
    score: Number(shot.score),
    x_position:
      shot.x_position !== null
        ? Number(shot.x_position)
        : null,
    y_position:
      shot.y_position !== null
        ? Number(shot.y_position)
        : null,
  }));

setShots(loadedShots);
      const resultDate = new Date(resultData.date);

setShootingDate(
  new Date(
    resultDate.getTime() -
      resultDate.getTimezoneOffset() * 60 * 1000
  )
    .toISOString()
    .slice(0, 16)
);
            setLoading(false);
    }

    loadData();
  }, [params.id, router]);
  function changeShot(index: number, score: number) {
  setShots((current) =>
    current.map((shot, shotIndex) =>
      shotIndex === index
        ? {
            ...shot,
            score,
            x_position: null,
            y_position: null,
          }
        : shot
    )
  );
}

async function loadWeather() {
  if (!shootingRangeId || !shootingDate) {
    return null;
  }

  const range = shootingRanges.find(
    (item) => item.id === shootingRangeId
  );

  if (
    !range ||
    range.latitude === null ||
    range.longitude === null
  ) {
    return null;
  }

  const shootingDay = shootingDate.slice(0, 10);
  const shootingHour =
    shootingDate.slice(0, 13) + ":00";

  const params = new URLSearchParams({
    latitude: String(range.latitude),
    longitude: String(range.longitude),
    start_date: shootingDay,
    end_date: shootingDay,
    hourly:
      "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code",
    timezone: "auto",
  });

  const response = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  const index = data.hourly?.time?.findIndex(
    (time: string) => time === shootingHour
  );

  if (index === undefined || index < 0) {
    return null;
  }

  return {
    temperature: data.hourly.temperature_2m[index],
    humidity: data.hourly.relative_humidity_2m[index],
    pressure: data.hourly.surface_pressure[index],
    windSpeed: data.hourly.wind_speed_10m[index],
    windDirection:
      data.hourly.wind_direction_10m[index],
    weatherCode: data.hourly.weather_code[index],
  };
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

   if (!shootingDate) {
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
let weather = null;

try {
  weather = await loadWeather();
} catch (error) {
  console.error(
    "Wetter konnte nicht aktualisiert werden:",
    error
  );
}
const { error } = await supabase
  .from("results")
  .update({
    discipline: discipline.trim(),
    equipment_id: equipmentId,
    shooting_range_id: shootingRangeId || null,
    date: new Date(shootingDate).toISOString(),
    notes: notes.trim() || null,

    weather_temperature: weather?.temperature ?? null,
weather_humidity: weather?.humidity ?? null,
weather_pressure: weather?.pressure ?? null,
weather_wind_speed: weather?.windSpeed ?? null,
weather_wind_direction: weather?.windDirection ?? null,
weather_code: weather?.weatherCode ?? null,

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
    x_position: shot.x_position,
    y_position: shot.y_position,
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Resultat wird geladen...
        </p>
      </main>
    );
  }
  const searchedShootingRanges = shootingRanges.filter((range) => {
      const search = shootingRangeSearch.trim().toLowerCase();


  

  if (!search) {
    return false;
  }
    if (!range.active) {
    return false;
  }

  return (
    range.name.toLowerCase().includes(search) ||
    (range.city ?? "").toLowerCase().includes(search)
  );
});
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
         
          <div className="mt-5 max-w-xs">
  <label
    htmlFor="shootingDate"
    className="mb-2 block text-sm font-medium text-slate-700"
  >
    Datum und Uhrzeit
  </label>

  <input
    id="shootingDate"
    type="datetime-local"
    value={shootingDate}
    onChange={(e) => setShootingDate(e.target.value)}
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
        <div className="mt-5">
  <label
    htmlFor="shootingRange"
    className="mb-2 block text-sm font-medium text-slate-700"
  >
    Schiessstand
  </label>

  <select
    id="shootingRange"
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
        .filter((range) => range.id === shootingRangeId)
        .map((range) => (
        <option key={range.id} value={range.id}>
  {!range.active ? "⛔ " : ""}
  {range.name}
  {range.city ? ` · ${range.city}` : ""}
  {range.distance_m !== null
    ? ` · ${range.distance_m} m`
    : ""}
  {!range.active ? " · deaktiviert" : ""}
</option>
        ))}

    {shootingRanges
  .filter(
    (range) =>
      range.active &&
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

  <div className="mt-3">
    <input
      type="search"
      value={shootingRangeSearch}
      onChange={(event) =>
        setShootingRangeSearch(event.target.value)
      }
      placeholder="🔍 Anderen Schiessstand suchen..."
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
    />
  </div>

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
  {inputType === "individual" && shots.length > 0 && (
  <div className="mt-7 border-t pt-6">
    <h2 className="text-lg font-bold text-slate-900">
      Einzelschüsse bearbeiten
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Korrigiere den Wert oder die Position eines Schusses.
    </p>

    <div className="mt-5 grid gap-4">
      {shots.map((shot, index) => (
        <div
          key={shot.id}
          className="rounded-xl bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between gap-4">
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

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500">
              {shot.x_position !== null &&
              shot.y_position !== null
                ? "Position vorhanden"
                : "Keine Position gespeichert"}
            </div>

            <button
              type="button"
              onClick={() =>
                setEditingShotIndex(
                  editingShotIndex === index ? null : index
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              {editingShotIndex === index
                ? "Position schließen"
                : "Position bearbeiten"}
            </button>
          </div>

          {editingShotIndex === index && (
            <div className="mt-5 border-t pt-5">
              <h3 className="font-bold text-slate-900">
                Position für Schuss {shot.shot_number}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Aktueller Wert: {shot.score}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {shot.x_position !== null &&
                shot.y_position !== null
                  ? `x: ${shot.x_position} · y: ${shot.y_position}`
                  : "Für diesen Schuss ist noch keine Position gespeichert."}
              </p>

              <Target
                selectedX={shot.x_position}
                selectedY={shot.y_position}
                selectedScore={shot.score}
                onSelect={(x, y, score) => {
                  setShots((current) =>
                    current.map(
                      (currentShot, shotIndex) =>
                        shotIndex === index
                          ? {
                              ...currentShot,
                              score,
                              x_position: x,
                              y_position: y,
                            }
                          : currentShot
                    )
                  );
                }}
              />
            </div>
          )}
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