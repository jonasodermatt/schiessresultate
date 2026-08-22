"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Target from "@/components/Target";

type Equipment = {
  id: string;
  name: string;
};

type Shot = {
  score: number;
  x: number | null;
  y: number | null;
};
type ShootingRange = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number | null;
  latitude: number | null;
  longitude: number | null;
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
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const [selectedY, setSelectedY] = useState<number | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [totalOnlyScore, setTotalOnlyScore] = useState("");
  const [totalOnlyShots, setTotalOnlyShots] = useState(10);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const [shootingDate, setShootingDate] = useState(() => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
});
const [shootingRanges, setShootingRanges] = useState<
  ShootingRange[]
>([]);

const [shootingRangeId, setShootingRangeId] = useState("");
const [favoriteShootingRangeIds, setFavoriteShootingRangeIds] =
  useState<string[]>([]);
  const [shootingRangeSearch, setShootingRangeSearch] = useState("");
  const [showResultDetails, setShowResultDetails] = useState(true);
  const resultComplete =
  inputType === "individual" &&
  shotMode === "fixed" &&
  plannedShots > 0 &&
  shots.length >= plannedShots;

const showResultActions =
  inputType === "individual" &&
  shots.length > 0 &&
  (
    shotMode === "free" ||
    resultComplete
  );

  function handleShotModeChange(
    newMode: "fixed" | "free"
  ) {
    setShotMode(newMode);

 
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
    // Letztes Resultat laden
const { data: lastResult, error: lastResultError } =
  await supabase
    .from("results")
    .select("discipline, equipment_id, shooting_range_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

if (lastResultError) {
  console.error(
    "Letztes Resultat konnte nicht geladen werden:",
    lastResultError.message
  );
}if (lastResult?.discipline) {
  setDiscipline(lastResult.discipline);
}
    // Sportgeräte laden
    const { data: equipmentData, error: equipmentError } =
      await supabase
        .from("equipment")
        .select("id, name")
        .eq("active", true)
        .order("name");

    if (equipmentError) {
      setMessage(`Fehler: ${equipmentError.message}`);
      return;
    }

    setEquipment(equipmentData ?? []);

   if (equipmentData && equipmentData.length > 0) {
  const lastEquipmentStillExists = equipmentData.some(
    (item) => item.id === lastResult?.equipment_id
  );

  if (lastEquipmentStillExists && lastResult?.equipment_id) {
    setEquipmentId(lastResult.equipment_id);
  } else {
    setEquipmentId(equipmentData[0].id);
  }
}

    // Schiessstände laden
    const {
      data: shootingRangeData,
      error: shootingRangeError,
    } = await supabase
      .from("shooting_ranges")
.select(
  "id, name, city, distance_m, latitude, longitude"
)
.order("name"); 

    if (shootingRangeError) {
      setMessage(
        `Fehler beim Laden der Schiessstände: ${shootingRangeError.message}`
      );
      return;
    }

    setShootingRanges(shootingRangeData ?? []);
    const { data: favoriteData, error: favoriteError } =
  await supabase
    .from("shooting_range_favorites")
    .select("shooting_range_id")
    .eq("user_id", user.id);

if (favoriteError) {
  setMessage(
    `Fehler beim Laden der Favoriten: ${favoriteError.message}`
  );
  return;
}

setFavoriteShootingRangeIds(
  (favoriteData ?? []).map(
    (favorite) => favorite.shooting_range_id
  )
);
if (
  lastResult?.shooting_range_id &&
  shootingRangeData?.some(
    (range) =>
      range.id === lastResult.shooting_range_id
  )
) {
  setShootingRangeId(
    lastResult.shooting_range_id
  );
} else {
  setShootingRangeId("");
}
  }

  loadData();
  }, [router]);

const totalScore = useMemo(
  () => shots.reduce((sum, shot) => sum + shot.score, 0),
  [shots]
);

  const averageScore =
    shots.length > 0 ? totalScore / shots.length : 0;

  function addShot(
  score: number,
  x: number | null,
  y: number | null
) {
  if (
    shotMode === "fixed" &&
    shots.length >= plannedShots
  ) {
    return;
  }

  setShots((current) => [
    ...current,
    {
      score,
      x,
      y,
    },
  ]);

  setSelectedX(null);
  setSelectedY(null);
  setSelectedScore(null);

 
  setShowResultDetails(false);

}
function handleTargetClick(
  event: React.MouseEvent<HTMLDivElement>
) {
  const rect = event.currentTarget.getBoundingClientRect();

  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const x = (mouseX / rect.width) * 2 - 1;
  const y = -((mouseY / rect.height) * 2 - 1);

  const distance = Math.sqrt(x * x + y * y);

 let score = 0;

if (distance <= 0.09) score = 10;
else if (distance <= 0.18) score = 9;
else if (distance <= 0.27) score = 8;
else if (distance <= 0.36) score = 7;
else if (distance <= 0.45) score = 6;
else if (distance <= 0.54) score = 5;
else if (distance <= 0.63) score = 4;
else if (distance <= 0.72) score = 3;
else if (distance <= 0.81) score = 2;
else if (distance <= 0.90) score = 1;
else score = 0;

  setSelectedX(Number(x.toFixed(3)));
  setSelectedY(Number(y.toFixed(3)));
  setSelectedScore(score);
}
function getPositionLabel(
  x: number,
  y: number
) {
  const distance = Math.sqrt(x * x + y * y);

  // 100 Punkte = exakt im Zentrum
  // 90 Punkte = äußerer Rand des 10er-Bereichs
  const score100 = Math.max(
    0,
    Math.min(100, 100 - distance * 100)
  );

  // Nur 96 oder höher gilt als Mitte
  if (score100 >= 96) {
    return "Mitte";
  }

  const angle = Math.atan2(y, x) * (180 / Math.PI);

  if (angle >= -22.5 && angle < 22.5) {
    return "rechts";
  }

  if (angle >= 22.5 && angle < 67.5) {
    return "rechts oben";
  }

  if (angle >= 67.5 && angle < 112.5) {
    return "oben";
  }

  if (angle >= 112.5 && angle < 157.5) {
    return "links oben";
  }

  if (angle >= 157.5 || angle < -157.5) {
    return "links";
  }

  if (angle >= -157.5 && angle < -112.5) {
    return "links unten";
  }

  if (angle >= -112.5 && angle < -67.5) {
    return "unten";
  }

  return "rechts unten";
}
function removeLastShot() {
  setShots((current) => current.slice(0, -1));

  setSelectedX(null);
  setSelectedY(null);
  setSelectedScore(null);
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
  const shootingHour = shootingDate.slice(0, 13) + ":00";

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
    windDirection: data.hourly.wind_direction_10m[index],
    weatherCode: data.hourly.weather_code[index],
  };
}

  async function saveResult(saveAndNext = false) {
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
    let weather = null;

try {
  weather = await loadWeather();
} catch (error) {
  console.error("Wetter konnte nicht geladen werden:", error);
}
    const { data: result, error: resultError } =
      await supabase
        .from("results")
        .insert({
          user_id: user.id,

          equipment_id: equipmentId,
          shooting_range_id: shootingRangeId || null,
          date: new Date(shootingDate).toISOString(),
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
          weather_temperature: weather?.temperature ?? null,
weather_humidity: weather?.humidity ?? null,
weather_pressure: weather?.pressure ?? null,
weather_wind_speed: weather?.windSpeed ?? null,
weather_wind_direction: weather?.windDirection ?? null,
weather_code: weather?.weatherCode ?? null,
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
    const shotRows = shots.map((shot, index) => ({
  result_id: result.id,
  user_id: user.id,
  shot_number: index + 1,
  score: shot.score,
  x_position: shot.x,
  y_position: shot.y,
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

    if (saveAndNext) {
  setShots([]);
  setSelectedX(null);
  setSelectedY(null);
  setSelectedScore(null);

  setTotalOnlyScore("");
  setNotes("");

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(
    now.getTime() - offset * 60 * 1000
  );

  setShootingDate(
    localDate.toISOString().slice(0, 16)
  );

  setMessage("Resultat gespeichert. Nächstes Resultat kann erfasst werden.");
  setSaving(false);

  setShowResultDetails(false);

  return;
}

router.push("/results");
  }
  const searchedShootingRanges = shootingRanges.filter((range) => {
  const search = shootingRangeSearch.trim().toLowerCase();

  if (!search) {
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
        <div className="mb-6 flex items-center justify-between">
  <div>
    <h2 className="font-bold text-slate-900">
      Angaben zum Resultat
    </h2>

    {!showResultDetails && (
      <p className="mt-1 text-sm text-slate-500">
        {discipline}
        {shootingRangeId
          ? ` · ${
              shootingRanges.find(
                (item) => item.id === shootingRangeId
              )?.name ?? ""
            }`
          : ""}
        {equipmentId
          ? ` · ${
              equipment.find(
                (item) => item.id === equipmentId
              )?.name ?? ""
            }`
          : ""}
      </p>
    )}
  </div>

  <button
    type="button"
    onClick={() =>
      setShowResultDetails((current) => !current)
    }
    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
  >
    {showResultDetails ? "▲ Einklappen" : "▼ Anzeigen"}
  </button>
</div>
{showResultDetails && (
  <>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Disziplin
              </label>

              <input
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
              />
            </div>
                        <div className="mt-5 max-w-xs">
  <label
    htmlFor="shootingDate"
    className="mb-2 block text-sm font-medium text-slate-700"
  >
    Datum
  </label>

  <input
  id="shootingDate"
  type="datetime-local"
  value={shootingDate}
  onChange={(e) => setShootingDate(e.target.value)}
  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
/>
</div>
<div>
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Schiessstand
  </label>

  <select
    value={shootingRangeId}
    onChange={(e) => setShootingRangeId(e.target.value)}
    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
  >
    <option value="">Kein Schiessstand</option>
    {shootingRangeId &&
  !favoriteShootingRangeIds.includes(shootingRangeId) &&
  shootingRanges
    .filter((range) => range.id === shootingRangeId)
    .map((range) => (
      <option key={range.id} value={range.id}>
        {range.name}
        {range.city ? ` · ${range.city}` : ""}
        {range.distance_m !== null
          ? ` · ${range.distance_m} m`
          : ""}
      </option>
    ))}
 {shootingRanges
  .filter((range) =>
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
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sportgerät
              </label>

              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
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
            <p className="mb-3 text-sm font-medium text-slate-700">
              Eingabeart
            </p>

            <div className="flex gap-6">
              <label className="text-slate-900">
                <input
                  type="radio"
                  checked={inputType === "individual"}
                  onChange={() => setInputType("individual")}
                />{" "}
                Einzelschüsse
              </label>

              <label className="text-slate-900">
                <input
                  type="radio"
                  checked={inputType === "total"}
                  onChange={() => setInputType("total")}
                />{" "}
                Nur Total
              </label>
            </div>
          </div>

           </>
      )}

          {inputType === "individual" ? (
            <>
            {showResultDetails && (
  <>
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Schussmodus
                </p>

                <div className="flex flex-wrap gap-6">
                  <label className="text-slate-900">
                    <input
                      type="radio"
                      checked={shotMode === "fixed"}
                      onChange={() => handleShotModeChange("fixed")}
                    />{" "}
                    Feste Anzahl
                  </label>

                  <label className="text-slate-900">
                    <input
                      type="radio"
                      checked={shotMode === "free"}
                      onChange={() => handleShotModeChange("free")}
                    />{" "}
                    Freies Training
                  </label>
                </div>
              </div>

              {shotMode === "fixed" && (
                <div className="mt-5 max-w-xs">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Anzahl Schüsse
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={plannedShots}
                    onChange={(e) =>
                      setPlannedShots(Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  />
                </div>
              )}
               </>
    )}
         
    <div className="mt-8 border-t pt-6">
<div className="flex items-start justify-between gap-4">
  <div>
    <h2 className="text-xl font-bold text-slate-900">
      Schüsse erfassen
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      {shotMode === "fixed"
        ? `${shots.length} / ${plannedShots} Schüsse`
        : `${shots.length} Schüsse`}
    </p>
  </div>

  {shots.length > 0 && (
    <button
      type="button"
      onClick={removeLastShot}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      ↶ Letzten Schuss entfernen
    </button>
  )}
</div>
{!resultComplete && (
<>
<div className="mt-6">
  <p className="mb-3 text-sm font-medium text-slate-700">
    Schussposition{" "}
    <span className="font-normal text-slate-400">
      (optional)
    </span>
  </p>
  <div

>

   
<Target
  selectedX={selectedX}
  selectedY={selectedY}
  selectedScore={selectedScore}
  onSelect={(x, y, score) => {
  if (resultComplete) {
    return;
  }

  setSelectedX(x);
  setSelectedY(y);
  setSelectedScore(score);
}}
/>
</div>
{selectedX !== null &&
selectedY !== null &&
selectedScore !== null ? (
  <div className="mt-4 text-center">
    <p className="text-2xl font-bold text-slate-900">
      {selectedScore} Punkte
    </p>

    <p className="mt-1 font-medium text-slate-700">
      {getPositionLabel(
  selectedX,
  selectedY
)}
    </p>

    <p className="mt-1 text-xs text-slate-400">
      x: {selectedX.toFixed(3)} · y: {selectedY.toFixed(3)}
    </p>

    <div className="mt-4 flex justify-center gap-3">
      <button
        type="button"
        onClick={() =>
          addShot(selectedScore, selectedX, selectedY)
        }
        style={{
          backgroundColor: "#dc2626",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Schuss übernehmen
      </button>

      <button
        type="button"
        onClick={() => {
          setSelectedX(null);
          setSelectedY(null);
          setSelectedScore(null);
        }}
        style={{
          backgroundColor: "white",
          color: "#475569",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          cursor: "pointer",
        }}
      >
        Abbrechen
      </button>
    </div>
  </div>
) : (
   <p className="mt-3 text-center text-sm text-slate-500">
    Tippe oder klicke auf die Scheibe.
  </p>
)}
</div>

 <div className="mt-6 text-center">
  <button
    type="button"
    onClick={() => setShowManualInput((current) => !current)}
    style={{
      backgroundColor: "white",
      color: "#475569",
      padding: "10px 16px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      cursor: "pointer",
    }}
  >
    {showManualInput
      ? "Manuelle Eingabe schließen"
      : "Wert ohne Position manuell erfassen"}
  </button>

  {showManualInput && (
    <div
      style={{
        marginTop: "16px",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {Array.from({ length: 11 }, (_, score) => (
        <button
          key={score}
          type="button"
          onClick={() => addShot(score, null, null)}
          style={{
            width: "44px",
            height: "44px",
            backgroundColor: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {score}
        </button>
      ))}
    </div>
  )}
</div>
  </>
)}


  {showResultActions && ( 
    <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
      <p className="text-lg font-bold text-slate-900">
  {shotMode === "fixed"
    ? "✓ Resultaterfassung abgeschlossen"
    : "✓ Resultaterfassung abschliessen"}
</p>

<p className="mt-1 text-sm text-slate-600">
  {shotMode === "fixed"
    ? `Alle ${plannedShots} Schüsse wurden erfasst.`
    : `${shots.length} Schüsse erfasst. Das Resultat kann gespeichert werden.`}
</p>

      

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={removeLastShot}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↶ Letzten Schuss entfernen
        </button>

        <button
          type="button"
          onClick={() => saveResult(false)}
          disabled={saving}
          className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving
            ? "Wird gespeichert..."
            : "Resultat speichern"}
        </button>
        <button
  type="button"
  onClick={() => saveResult(true)}
  disabled={saving}
  className="rounded-lg border border-red-600 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
>
  {saving
    ? "Wird gespeichert..."
    : "Speichern & nächstes Resultat"}
</button>
      </div>
    </div>
  )}
</div>
</>
) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Anzahl Schüsse
                </label>

                <input
                  type="number"
                  min={1}
                  value={totalOnlyShots}
                  onChange={(e) =>
                    setTotalOnlyShots(Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Total
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={totalOnlyScore}
                  onChange={(e) =>
                    setTotalOnlyScore(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                />
              </div>
            </div>
          )}


  <div className="mt-6 flex flex-wrap gap-2">
    {shots.map((shot, index) => (
      <span
        key={index}
        className="rounded-lg bg-slate-100 px-3 py-2  text-slate-900"
      >
        {index + 1}: {shot.score}
        {shot.x !== null && shot.y !== null && " 🎯"}
      </span>
    ))}
  </div>




  <div className="mt-6 grid gap-4 sm:grid-cols-3">
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        Schüsse
      </p>
      <p className="text-2xl font-bold text-slate-900">
        {shots.length}
      </p>
    </div>

    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        Total
      </p>
      <p className="text-2xl font-bold text-slate-900">
        {totalScore}
      </p>
    </div>

    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        Durchschnitt
      </p>
      <p className="text-2xl font-bold text-slate-900">
        {averageScore.toFixed(2)}
      </p>
    </div>
   </div>



          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Notiz
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {message && (
            <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm">
              {message}
            </div>
          )}

          
        </div>
      </div>
    </main>
  );
}