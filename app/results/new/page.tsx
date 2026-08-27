"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Target from "@/components/Target";

type EquipmentDistance = {
  distance_m: number;
};

type EquipmentPosition = {
  position: string;
};

type Equipment = {
  id: string;
  name: string;
  category: string | null;

  iris_min: number | null;
  iris_max: number | null;

  front_sight_min: number | null;
  front_sight_max: number | null;

  equipment_distances: EquipmentDistance[];
  equipment_positions: EquipmentPosition[];
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

  const [trainingSessionId, setTrainingSessionId] =
    useState<string | null>(null);
  const [trainingProgramId, setTrainingProgramId] =
    useState<string | null>(null);
  const [trainingParamsReady, setTrainingParamsReady] =
    useState(false);

  const isTrainingMode =
    !!trainingSessionId && !!trainingProgramId;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [selectedDistance, setSelectedDistance] =
  useState<number | null>(null);

const [selectedPosition, setSelectedPosition] =
  useState("");

const [irisSetting, setIrisSetting] =
  useState("");

const [frontSightSetting, setFrontSightSetting] =
  useState("");
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
  const [trainingProgramLoaded, setTrainingProgramLoaded] = useState(false);

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
  const params = new URLSearchParams(window.location.search);

  setTrainingSessionId(
    params.get("trainingSessionId")
  );
  setTrainingProgramId(
    params.get("trainingProgramId")
  );
  setTrainingParamsReady(true);
}, []);

useEffect(() => {
  let wakeLock: WakeLockSentinel | null = null;

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        console.log("Bildschirm bleibt während der Resultaterfassung aktiv.");
      }
    } catch (error) {
      console.error("Wake Lock konnte nicht aktiviert werden:", error);
    }
  }

  async function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      await requestWakeLock();
    }
  }

  requestWakeLock();

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  };
}, []);

useEffect(() => {
  if (!trainingParamsReady) {
    return;
  }

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    // Sportgeräte laden
    const {
      data: equipmentData,
      error: equipmentError,
    } = await supabase
      .from("equipment")
      .select(`
        id,
        name,
        category,
        iris_min,
        iris_max,
        front_sight_min,
        front_sight_max,
        equipment_distances (
          distance_m
        ),
        equipment_positions (
          position
        )
      `)
      .eq("active", true)
      .order("name");

    if (equipmentError) {
      setMessage(`Fehler: ${equipmentError.message}`);
      return;
    }

    const loadedEquipment =
      (equipmentData ?? []) as Equipment[];

    setEquipment(loadedEquipment);

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

    const {
      data: favoriteData,
      error: favoriteError,
    } = await supabase
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

    // ---------------------------------------------------------
    // TRAININGSMODUS
    // ---------------------------------------------------------
    if (trainingSessionId && trainingProgramId) {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase
        .from("training_sessions")
        .select(`
          id,
          user_id,
          equipment_id,
          shooting_range_id,
          distance_m,
          shooting_position,
          iris_setting,
          front_sight_setting,
          status
        `)
        .eq("id", trainingSessionId)
        .eq("user_id", user.id)
        .single();

      if (sessionError || !sessionData) {
        setMessage(
          `Trainingseinheit konnte nicht geladen werden: ${
            sessionError?.message ?? "Nicht gefunden"
          }`
        );
        return;
      }

      if (sessionData.status !== "active") {
        setMessage("Diese Trainingseinheit ist nicht mehr aktiv.");
        return;
      }

      const {
        data: programData,
        error: programError,
      } = await supabase
        .from("training_session_programs")
        .select(`
          id,
          training_session_id,
          shot_mode,
          planned_shots,
          status
        `)
        .eq("id", trainingProgramId)
        .eq("training_session_id", trainingSessionId)
        .single();

      if (programError || !programData) {
        setMessage(
          `Trainingsprogramm konnte nicht geladen werden: ${
            programError?.message ?? "Nicht gefunden"
          }`
        );
        return;
      }

      if (programData.status === "completed") {
        router.replace(`/training/${trainingSessionId}`);
        return;
      }

      const sessionEquipment = loadedEquipment.find(
        (item) => item.id === sessionData.equipment_id
      );

      if (!sessionEquipment) {
        setMessage(
          "Das Sportgerät dieser Trainingseinheit ist nicht mehr verfügbar."
        );
        return;
      }

      setEquipmentId(sessionData.equipment_id);
      setSelectedDistance(
        sessionData.distance_m !== null
          ? Number(sessionData.distance_m)
          : null
      );
      setSelectedPosition(
        sessionData.shooting_position ?? ""
      );
      setIrisSetting(
        sessionData.iris_setting !== null
          ? String(sessionData.iris_setting)
          : ""
      );
      setFrontSightSetting(
        sessionData.front_sight_setting !== null
          ? String(sessionData.front_sight_setting)
          : ""
      );
      setShootingRangeId(
        sessionData.shooting_range_id ?? ""
      );

      setInputType("individual");
      setShotMode(
        programData.shot_mode === "free"
          ? "free"
          : "fixed"
      );

      if (
        programData.shot_mode === "fixed" &&
        programData.planned_shots !== null
      ) {
        setPlannedShots(
          Number(programData.planned_shots)
        );
      }

      // Der Zeitpunkt des Resultats entspricht dem Start
      // des ausgewählten Programms.
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(
        now.getTime() - offset * 60 * 1000
      );

      setShootingDate(
        localDate.toISOString().slice(0, 16)
      );

      if (programData.status === "open") {
        await supabase
          .from("training_session_programs")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .eq("id", trainingProgramId);
      }

      setTrainingProgramLoaded(true);
      return;
    }

    // ---------------------------------------------------------
    // NORMALE RESULTATERFASSUNG
    // ---------------------------------------------------------
    const {
      data: lastResult,
      error: lastResultError,
    } = await supabase
      .from("results")
      .select(`
        discipline,
        equipment_id,
        shooting_range_id,
        distance_m,
        shooting_position,
        iris_setting,
        front_sight_setting
      `)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastResultError) {
      console.error(
        "Letztes Resultat konnte nicht geladen werden:",
        lastResultError.message
      );
    }

    if (loadedEquipment.length > 0) {
      const lastEquipment =
        loadedEquipment.find(
          (item) =>
            item.id === lastResult?.equipment_id
        );

      const selectedEquipment =
        lastEquipment ?? loadedEquipment[0];

      setEquipmentId(selectedEquipment.id);

      const availableDistances =
        selectedEquipment.equipment_distances ?? [];

      const availablePositions =
        selectedEquipment.equipment_positions ?? [];

      const lastDistanceIsValid =
        lastResult?.distance_m !== null &&
        lastResult?.distance_m !== undefined &&
        availableDistances.some(
          (item) =>
            Number(item.distance_m) ===
            Number(lastResult.distance_m)
        );

      setSelectedDistance(
        lastDistanceIsValid
          ? Number(lastResult?.distance_m)
          : availableDistances.length > 0
            ? Number(
                availableDistances[0].distance_m
              )
            : null
      );

      const lastPositionIsValid =
        !!lastResult?.shooting_position &&
        availablePositions.some(
          (item) =>
            item.position ===
            lastResult.shooting_position
        );

      setSelectedPosition(
        lastPositionIsValid
          ? lastResult?.shooting_position ?? ""
          : availablePositions[0]?.position ?? ""
      );

      setIrisSetting(
        lastEquipment &&
        lastResult?.iris_setting !== null &&
        lastResult?.iris_setting !== undefined
          ? String(lastResult.iris_setting)
          : ""
      );

      setFrontSightSetting(
        lastEquipment &&
        lastResult?.front_sight_setting !== null &&
        lastResult?.front_sight_setting !== undefined
          ? String(lastResult.front_sight_setting)
          : ""
      );
    }

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
}, [
  router,
  trainingSessionId,
  trainingProgramId,
  trainingParamsReady,
]);


// Aktuell ausgewähltes Sportgerät
const selectedEquipment = equipment.find(
  (item) => item.id === equipmentId
);

const isCrossbow30m =
  selectedDistance === 30 &&
  (
    selectedEquipment?.category
      ?.toLowerCase()
      .includes("armbrust") ||
    selectedEquipment?.name
      .toLowerCase()
      .includes("armbrust")
  );

const targetType =
  isCrossbow30m
    ? "crossbow30m"
    : "default";

// Distanzen des ausgewählten Sportgeräts
const availableDistances =
  selectedEquipment?.equipment_distances ?? [];

// Stellungen des ausgewählten Sportgeräts
const availablePositions =
  selectedEquipment?.equipment_positions ?? [];

  function handleEquipmentChange(newEquipmentId: string) {
  setEquipmentId(newEquipmentId);

  const newEquipment = equipment.find(
    (item) => item.id === newEquipmentId
  );

  if (!newEquipment) {
    setSelectedDistance(null);
    setSelectedPosition("");
    setIrisSetting("");
    setFrontSightSetting("");
    return;
  }

  const distances =
    newEquipment.equipment_distances ?? [];

  const positions =
    newEquipment.equipment_positions ?? [];

  setSelectedDistance(
    distances.length > 0
      ? Number(distances[0].distance_m)
      : null
  );

  setSelectedPosition(
    positions.length > 0
      ? positions[0].position
      : ""
  );

  setIrisSetting("");
  setFrontSightSetting("");
}

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

function getEquipmentPositionLabel(position: string) {
  const labels: Record<string, string> = {
    lying: "Liegend",
    prone: "Liegend",
    liegend: "Liegend",
    standing: "Stehend",
    stehend: "Stehend",
    kneeling: "Kniend",
    kniend: "Kniend",
  };

  return labels[position.toLowerCase()] ?? position;
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
          discipline:
            selectedDistance !== null && selectedPosition
              ? `${selectedDistance}m ${getEquipmentPositionLabel(selectedPosition)}`
              : selectedDistance !== null
                ? `${selectedDistance}m`
                : selectedPosition
                  ? getEquipmentPositionLabel(selectedPosition)
                  : discipline,
          distance_m: selectedDistance,
          shooting_position: selectedPosition || null,
          iris_setting: irisSetting === "" ? null : Number(irisSetting),
          front_sight_setting:
            frontSightSetting === "" ? null : Number(frontSightSetting),
          training_session_id:
            trainingSessionId || null,
          training_session_program_id:
            trainingProgramId || null,
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

    if (
      trainingSessionId &&
      trainingProgramId
    ) {
      const {
        error: completeProgramError,
      } = await supabase
        .from("training_session_programs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", trainingProgramId)
        .eq(
          "training_session_id",
          trainingSessionId
        );

      if (completeProgramError) {
        setMessage(
          `Resultat gespeichert, aber das Trainingsprogramm konnte nicht abgeschlossen werden: ${completeProgramError.message}`
        );
        setSaving(false);
        return;
      }

      router.push(
        `/training/${trainingSessionId}`
      );
      return;
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
          {isTrainingMode
            ? "Trainingsprogramm erfassen"
            : "Neues Resultat"}
        </h1>

        {isTrainingMode && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-red-700">
              Trainingseinheit aktiv
            </p>
            <p className="mt-1">
              Die gemeinsamen Trainingsangaben und das Programm
              wurden aus der Trainingseinheit übernommen.
            </p>
          </div>
        )}

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

  {!isTrainingMode && (
    <button
      type="button"
      onClick={() =>
        setShowResultDetails((current) => !current)
      }
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
    >
      {showResultDetails ? "▲ Einklappen" : "▼ Anzeigen"}
    </button>
  )}
</div>
{showResultDetails && (
  <>
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Sportgerät
        </label>

        <select
          value={equipmentId}
          onChange={(e) => handleEquipmentChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        >
          {equipment.length === 0 && (
            <option value="">Kein Sportgerät vorhanden</option>
          )}

          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div>
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
          Distanz
        </label>

        <select
          value={selectedDistance ?? ""}
          disabled={isTrainingMode}
          onChange={(e) =>
            setSelectedDistance(
              e.target.value ? Number(e.target.value) : null
            )
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        >
          {availableDistances.length === 0 && (
            <option value="">Keine Distanz hinterlegt</option>
          )}

          {[...availableDistances]
            .sort(
              (a, b) =>
                Number(a.distance_m) - Number(b.distance_m)
            )
            .map((item) => (
              <option key={item.distance_m} value={item.distance_m}>
                {item.distance_m} m
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Stellung
        </label>

        <select
          value={selectedPosition}
          disabled={isTrainingMode}
          onChange={(e) => setSelectedPosition(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        >
          {availablePositions.length === 0 && (
            <option value="">Keine Stellung hinterlegt</option>
          )}

          {availablePositions.map((item) => (
            <option key={item.position} value={item.position}>
              {getEquipmentPositionLabel(item.position)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Irisblende
        </label>

        <input
          type="number"
          step="0.01"
          min={selectedEquipment?.iris_min ?? undefined}
          readOnly={isTrainingMode}
          max={selectedEquipment?.iris_max ?? undefined}
          value={irisSetting}
          onChange={(e) => setIrisSetting(e.target.value)}
          placeholder={
            selectedEquipment?.iris_min !== null &&
            selectedEquipment?.iris_min !== undefined &&
            selectedEquipment?.iris_max !== null &&
            selectedEquipment?.iris_max !== undefined
              ? `${selectedEquipment.iris_min} – ${selectedEquipment.iris_max}`
              : "Keine Einstellung"
          }
          disabled={
            selectedEquipment?.iris_min === null &&
            selectedEquipment?.iris_max === null
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Korneinstellung
        </label>

        <input
          type="number"
          step="0.01"
          min={selectedEquipment?.front_sight_min ?? undefined}
          readOnly={isTrainingMode}
          max={selectedEquipment?.front_sight_max ?? undefined}
          value={frontSightSetting}
          onChange={(e) => setFrontSightSetting(e.target.value)}
          placeholder={
            selectedEquipment?.front_sight_min !== null &&
            selectedEquipment?.front_sight_min !== undefined &&
            selectedEquipment?.front_sight_max !== null &&
            selectedEquipment?.front_sight_max !== undefined
              ? `${selectedEquipment.front_sight_min} – ${selectedEquipment.front_sight_max}`
              : "Keine Einstellung"
          }
          disabled={
            selectedEquipment?.front_sight_min === null &&
            selectedEquipment?.front_sight_max === null
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Schiessstand
        </label>

        <select
          value={shootingRangeId}
          disabled={isTrainingMode}
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

        {!isTrainingMode && (
          <div>
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
        )}
      </div>
    </div>

    {!isTrainingMode && (
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
    )}
  </>
)}

          {inputType === "individual" ? (
            <>
            {showResultDetails && (
  <>
              {!isTrainingMode && (
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
              )}

              {shotMode === "fixed" && (
                <div className="mt-5 max-w-xs">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Anzahl Schüsse
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={plannedShots}
                    readOnly={isTrainingMode}
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
  targetType={targetType}
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

        {!isTrainingMode && (
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
        )}
        <button
  type="button"
  onClick={() => saveResult(true)}
  disabled={saving}
  className="rounded-lg border border-red-600 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
>
  {saving
    ? "Wird gespeichert..."
    : isTrainingMode
      ? "Resultat speichern & zur Programmauswahl"
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