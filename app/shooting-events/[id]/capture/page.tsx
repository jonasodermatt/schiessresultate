"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Shooter = {
  id: string;
  master_number: number;
  first_name: string;
  last_name: string;
  birth_year: number | null;
};

type Registration = {
  id: string;
  shooter_id: string;
  weapon_id: string | null;
};

type Weapon = {
  id: string;
  name: string;
};

type ShootingProgram = {
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
  shots_per_pass: number;
  max_passes: number;
  program_id: string | null;
};

type RegistrationStitch = {
  id: string;
  registration_id: string;
  event_stitch_id: string;
  weapon_id_override: string | null;
  status: string;
  registered_passes: number;
};

type Block = {
  id: string;
  event_stitch_id: string;
  block_number: number;
  block_type: "single" | "series";
  shot_count: number;
};

type PassRow = {
  id: string;
  registration_stitch_id: string;
  pass_number: number;
  status: string;
  completed_at: string | null;
};

type ShotRow = {
  id: string;
  pass_id: string;
  shot_number: number;
  score: number;
  tie_break_score: number | null;
  block_id: string | null;
};

type StitchWithRegistration = {
  stitch: Stitch;
  program: ShootingProgram | null;
  registrationStitch: RegistrationStitch;
  passes: PassRow[];
};

function maxScoreForProgram(program: ShootingProgram | null) {
  if (!program) return 100;
  if (program.scoring_type === "A5") return 5;
  if (program.scoring_type === "A10") return 10;
  return 100;
}

export default function ShootingEventCapturePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [programs, setPrograms] = useState<ShootingProgram[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [registrationId, setRegistrationId] = useState("");
  const [registeredStitches, setRegisteredStitches] = useState<
    StitchWithRegistration[]
  >([]);

  const [activeStitchId, setActiveStitchId] = useState("");
  const [activePassNumber, setActivePassNumber] = useState(1);
  const [shotValues, setShotValues] = useState<string[]>([]);
  const [seriesTieBreak, setSeriesTieBreak] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingShooter, setLoadingShooter] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
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

      const { data: eventData, error: eventError } = await supabase
        .from("shooting_events")
        .select("id, name")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        setMessage(
          `Anlass konnte nicht geladen werden: ${
            eventError?.message ?? "Nicht gefunden"
          }`
        );
        setLoading(false);
        return;
      }

      setEventName(eventData.name);

      const { data: registrationData, error: registrationError } =
        await supabase
          .from("shooting_event_registrations")
          .select("id, shooter_id, weapon_id")
          .eq("shooting_event_id", eventId);

      if (registrationError) {
        setMessage(
          `Anmeldungen konnten nicht geladen werden: ${registrationError.message}`
        );
        setLoading(false);
        return;
      }

      const loadedRegistrations =
        (registrationData ?? []) as Registration[];

      setRegistrations(loadedRegistrations);

      const shooterIds = Array.from(
        new Set(loadedRegistrations.map((item) => item.shooter_id))
      );

      if (shooterIds.length > 0) {
        const { data: shooterData, error: shooterError } = await supabase
          .from("shooters")
          .select("id, master_number, first_name, last_name, birth_year")
          .in("id", shooterIds);

        if (shooterError) {
          setMessage(
            `Schützen konnten nicht geladen werden: ${shooterError.message}`
          );
          setLoading(false);
          return;
        }

        setShooters((shooterData ?? []) as Shooter[]);
      }

      const { data: weaponData, error: weaponError } = await supabase
        .from("competition_weapons")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (weaponError) {
        setMessage(
          `Sportgeräte konnten nicht geladen werden: ${weaponError.message}`
        );
        setLoading(false);
        return;
      }

      setWeapons((weaponData ?? []) as Weapon[]);

      const { data: stitchData, error: stitchError } = await supabase
        .from("shooting_event_stitches")
        .select(
          "id, name, code, sort_order, scoring_type, shots_per_pass, max_passes, program_id"
        )
        .eq("shooting_event_id", eventId)
        .eq("active", true)
        .order("sort_order");

      if (stitchError) {
        setMessage(`Stiche konnten nicht geladen werden: ${stitchError.message}`);
        setLoading(false);
        return;
      }

      const loadedStitches = (stitchData ?? []) as Stitch[];
      setStitches(loadedStitches);

      const programIds = Array.from(
        new Set(
          loadedStitches
            .map((stitch) => stitch.program_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      if (programIds.length > 0) {
        const { data: programData, error: programError } = await supabase
          .from("shooting_programs")
          .select(
            "id, code, name, scoring_type, single_shots, series_shots, ranking_type, best_n, special_code"
          )
          .in("id", programIds);

        if (programError) {
          setMessage(
            `Programme konnten nicht geladen werden: ${programError.message}`
          );
          setLoading(false);
          return;
        }

        setPrograms((programData ?? []) as ShootingProgram[]);
      }

      const stitchIds = loadedStitches.map((item) => item.id);

      if (stitchIds.length > 0) {
        const { data: blockData, error: blockError } = await supabase
          .from("shooting_event_stitch_blocks")
          .select(
            "id, event_stitch_id, block_number, block_type, shot_count"
          )
          .in("event_stitch_id", stitchIds)
          .order("block_number");

        if (blockError) {
          setMessage(
            `Schussblöcke konnten nicht geladen werden: ${blockError.message}`
          );
          setLoading(false);
          return;
        }

        setBlocks((blockData ?? []) as Block[]);
      }

      setLoading(false);
    }

    loadData();
  }, [eventId, router]);

  const shooterById = useMemo(
    () => new Map(shooters.map((shooter) => [shooter.id, shooter])),
    [shooters]
  );

  const weaponById = useMemo(
    () => new Map(weapons.map((weapon) => [weapon.id, weapon])),
    [weapons]
  );

  const stitchById = useMemo(
    () => new Map(stitches.map((stitch) => [stitch.id, stitch])),
    [stitches]
  );

  const programById = useMemo(
    () => new Map(programs.map((program) => [program.id, program])),
    [programs]
  );

  const sortedRegistrations = useMemo(() => {
    return [...registrations].sort((a, b) => {
      const shooterA = shooterById.get(a.shooter_id);
      const shooterB = shooterById.get(b.shooter_id);

      return (
        (shooterA?.master_number ?? 999999) -
        (shooterB?.master_number ?? 999999)
      );
    });
  }, [registrations, shooterById]);

  const selectedRegistration = registrations.find(
    (item) => item.id === registrationId
  );

  const selectedShooter = selectedRegistration
    ? shooterById.get(selectedRegistration.shooter_id)
    : undefined;

  const standardWeapon = selectedRegistration?.weapon_id
    ? weaponById.get(selectedRegistration.weapon_id)
    : undefined;

  const activeEntry = registeredStitches.find(
    (item) => item.registrationStitch.id === activeStitchId
  );

  const activeProgram = activeEntry?.program ?? null;

  const activeBlocks = activeEntry
    ? blocks
        .filter((block) => block.event_stitch_id === activeEntry.stitch.id)
        .sort((a, b) => a.block_number - b.block_number)
    : [];

  const activeShotCount = activeProgram
    ? activeProgram.special_code === "RUETLI"
      ? activeBlocks.reduce(
          (sum, block) => sum + block.shot_count,
          0
        )
      : activeProgram.single_shots + activeProgram.series_shots
    : 0;

  const numericShotValues = shotValues.map((value) =>
    value === "" ? null : Number(value)
  );

  const totalScore = numericShotValues.reduce<number>(
    (sum, score) => sum + (score ?? 0),
    0
  );

  const seriesTotal = activeProgram
    ? numericShotValues
        .slice(activeProgram.single_shots)
        .reduce<number>((sum, score) => sum + (score ?? 0), 0)
    : 0;

  const bestShot = numericShotValues.reduce<number | null>(
    (best, score) => {
      if (score === null) return best;
      if (best === null || score > best) return score;
      return best;
    },
    null
  );

  const ruetliHitCount = numericShotValues.filter(
    (score) => score !== null && score > 0
  ).length;

  const ruetliRankingTotal =
    totalScore + ruetliHitCount;

  function resetResultForm(
    program: ShootingProgram | null,
    stitchId?: string
  ) {
    const count = program
      ? program.special_code === "RUETLI" && stitchId
        ? blocks
            .filter(
              (block) => block.event_stitch_id === stitchId
            )
            .reduce(
              (sum, block) => sum + block.shot_count,
              0
            )
        : program.single_shots + program.series_shots
      : 0;

    setShotValues(Array.from({ length: count }, () => ""));
    setSeriesTieBreak("");
  }

  function updateShot(index: number, value: string) {
    setShotValues((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? value : item
      )
    );
  }

  async function loadShooterStitches(selectedRegistrationId: string) {
    setActiveStitchId("");
    setRegisteredStitches([]);
    setShotValues([]);
    setSeriesTieBreak("");
    setActivePassNumber(1);

    if (!selectedRegistrationId) return;

    setLoadingShooter(true);
    setMessage("");

    const { data, error } = await supabase
      .from("shooting_event_registration_stitches")
      .select(
        "id, registration_id, event_stitch_id, weapon_id_override, status, registered_passes"
      )
      .eq("registration_id", selectedRegistrationId);

    if (error) {
      setMessage(
        `Gelöste Stiche konnten nicht geladen werden: ${error.message}`
      );
      setLoadingShooter(false);
      return;
    }

    const registrationStitches =
      (data ?? []) as RegistrationStitch[];

    const registrationStitchIds = registrationStitches.map(
      (item) => item.id
    );

    let passes: PassRow[] = [];

    if (registrationStitchIds.length > 0) {
      const { data: passData, error: passError } = await supabase
        .from("shooting_event_stitch_passes")
        .select(
          "id, registration_stitch_id, pass_number, status, completed_at"
        )
        .in("registration_stitch_id", registrationStitchIds)
        .order("pass_number");

      if (passError) {
        setMessage(`Passen konnten nicht geladen werden: ${passError.message}`);
        setLoadingShooter(false);
        return;
      }

      passes = (passData ?? []) as PassRow[];
    }

    const result: StitchWithRegistration[] = registrationStitches
      .map((registrationStitch) => {
        const stitch = stitchById.get(registrationStitch.event_stitch_id);
        if (!stitch) return null;

        return {
          stitch,
          program: stitch.program_id
            ? programById.get(stitch.program_id) ?? null
            : null,
          registrationStitch,
          passes: passes.filter(
            (pass) =>
              pass.registration_stitch_id === registrationStitch.id
          ),
        };
      })
      .filter(
        (item): item is StitchWithRegistration => item !== null
      )
      .sort((a, b) => a.stitch.sort_order - b.stitch.sort_order);

    setRegisteredStitches(result);
    setLoadingShooter(false);
  }

  async function loadPassResult(
    entry: StitchWithRegistration,
    passNumber: number
  ) {
    setActivePassNumber(passNumber);
    resetResultForm(entry.program, entry.stitch.id);
    setMessage("");

    if (!entry.program) {
      setMessage("Für diesen Stich ist noch kein Programm hinterlegt.");
      return;
    }

    const pass = entry.passes.find(
      (item) => item.pass_number === passNumber
    );

    if (!pass) return;

    setLoadingResult(true);

    const { data: shotData, error: shotError } = await supabase
      .from("shooting_event_stitch_shots")
      .select(
        "id, pass_id, shot_number, score, tie_break_score, block_id"
      )
      .eq("pass_id", pass.id)
      .order("shot_number");

    setLoadingResult(false);

    if (shotError) {
      setMessage(`Resultat konnte nicht geladen werden: ${shotError.message}`);
      return;
    }

    const loadedShots = (shotData ?? []) as ShotRow[];

    const count =
      entry.program.special_code === "RUETLI"
        ? blocks
            .filter(
              (block) =>
                block.event_stitch_id === entry.stitch.id
            )
            .reduce(
              (sum, block) => sum + block.shot_count,
              0
            )
        : entry.program.single_shots +
          entry.program.series_shots;

    const nextValues = Array.from({ length: count }, () => "");

    for (const shot of loadedShots) {
      if (shot.shot_number >= 1 && shot.shot_number <= count) {
        nextValues[shot.shot_number - 1] = String(shot.score);
      }
    }

    setShotValues(nextValues);

    const tieBreakShot = loadedShots.find(
      (shot) => shot.tie_break_score !== null
    );

    setSeriesTieBreak(
      tieBreakShot?.tie_break_score !== undefined &&
        tieBreakShot.tie_break_score !== null
        ? String(tieBreakShot.tie_break_score)
        : ""
    );
  }

  async function openStitch(entry: StitchWithRegistration) {
    setActiveStitchId(entry.registrationStitch.id);

    const firstPass =
      entry.passes.length > 0
        ? Math.min(...entry.passes.map((pass) => pass.pass_number))
        : 1;

    await loadPassResult(entry, firstPass);
  }

  async function saveGenericResult() {
    if (!activeEntry || !activeProgram) return;

    const isRuetli =
      activeProgram.special_code === "RUETLI";

    const maxScore = isRuetli
      ? 5
      : maxScoreForProgram(activeProgram);

    const validShots =
      numericShotValues.length === activeShotCount &&
      numericShotValues.every(
        (score) =>
          score !== null &&
          Number.isInteger(score) &&
          score >= 0 &&
          score <= maxScore
      );

    if (!validShots) {
      setMessage(
        `Bitte alle ${activeShotCount} Schüsse mit einem Wert zwischen 0 und ${maxScore} erfassen.`
      );
      return;
    }

    const needsSectionTieBreak =
      activeProgram.ranking_type === "section" &&
      activeProgram.series_shots > 0;

    const tieBreak = Number(seriesTieBreak);

    if (
      needsSectionTieBreak &&
      (seriesTieBreak.trim() === "" ||
        !Number.isInteger(tieBreak) ||
        tieBreak < 0 ||
        tieBreak > 100)
    ) {
      setMessage(
        "Bitte den Serien-Tiefschuss als A100-Wert zwischen 0 und 100 erfassen."
      );
      return;
    }

    const singleBlock = activeBlocks.find(
      (block) => block.block_type === "single"
    );

    const seriesBlock = activeBlocks.find(
      (block) => block.block_type === "series"
    );

    if (!isRuetli) {
      if (activeProgram.single_shots > 0 && !singleBlock) {
        setMessage("Der Einzelschuss-Block ist nicht konfiguriert.");
        return;
      }

      if (activeProgram.series_shots > 0 && !seriesBlock) {
        setMessage("Der Serien-Block ist nicht konfiguriert.");
        return;
      }
    } else {
      const configuredRuetliShots = activeBlocks.reduce(
        (sum, block) => sum + block.shot_count,
        0
      );

      if (
        activeBlocks.length !== 3 ||
        configuredRuetliShots !== 15
      ) {
        setMessage(
          "Das Rütli-Programm muss aus 3 Blöcken mit insgesamt 15 Schüssen bestehen."
        );
        return;
      }
    }

    setSaving(true);
    setMessage("");

    try {
      const registrationStitchId =
        activeEntry.registrationStitch.id;

      const existingPass = activeEntry.passes.find(
        (item) => item.pass_number === activePassNumber
      );

      let passId: string;

      if (existingPass) {
        const { error: updatePassError } = await supabase
          .from("shooting_event_stitch_passes")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", existingPass.id);

        if (updatePassError) {
          throw new Error(updatePassError.message);
        }

        passId = existingPass.id;
      } else {
        const { data: newPass, error: passError } = await supabase
          .from("shooting_event_stitch_passes")
          .insert({
            registration_stitch_id: registrationStitchId,
            pass_number: activePassNumber,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (passError || !newPass) {
          throw new Error(
            passError?.message ?? "Passe konnte nicht gespeichert werden."
          );
        }

        passId = newPass.id;
      }

      const { error: deleteError } = await supabase
        .from("shooting_event_stitch_shots")
        .delete()
        .eq("pass_id", passId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      let bestSeriesIndex = -1;

      if (needsSectionTieBreak) {
        const seriesScores = numericShotValues.slice(
          activeProgram.single_shots
        ) as number[];

        const bestSeriesScore = Math.max(...seriesScores);

        bestSeriesIndex =
          activeProgram.single_shots +
          seriesScores.findIndex((score) => score === bestSeriesScore);
      }

      const shotRows = numericShotValues.map((score, index) => {
        if (isRuetli) {
          let runningStart = 0;
          let blockId: string | null = null;

          for (const block of activeBlocks) {
            const runningEnd =
              runningStart + block.shot_count;

            if (
              index >= runningStart &&
              index < runningEnd
            ) {
              blockId = block.id;
              break;
            }

            runningStart = runningEnd;
          }

          return {
            pass_id: passId,
            block_id: blockId,
            shot_number: index + 1,
            score: score as number,
            tie_break_score: null,
          };
        }

        const isSeries =
          index >= activeProgram.single_shots;

        return {
          pass_id: passId,
          block_id: isSeries
            ? seriesBlock?.id ?? null
            : singleBlock?.id ?? null,
          shot_number: index + 1,
          score: score as number,
          tie_break_score:
            needsSectionTieBreak &&
            index === bestSeriesIndex
              ? tieBreak
              : null,
        };
      });

      const { error: shotsError } = await supabase
        .from("shooting_event_stitch_shots")
        .insert(shotRows);

      if (shotsError) {
        throw new Error(shotsError.message);
      }

      const completedPassNumbers = new Set(
        activeEntry.passes
          .filter((pass) => pass.status === "completed")
          .map((pass) => pass.pass_number)
      );

      completedPassNumbers.add(activePassNumber);

      const requiredPasses =
        activeEntry.registrationStitch.registered_passes || 1;

      const nextStatus =
        requiredPasses > 1 &&
        completedPassNumbers.size < requiredPasses
          ? "started"
          : "completed";

      const { error: statusError } = await supabase
        .from("shooting_event_registration_stitches")
        .update({ status: nextStatus })
        .eq("id", registrationStitchId);

      if (statusError) {
        throw new Error(statusError.message);
      }

      const { data: refreshedPassData, error: refreshedPassError } =
        await supabase
          .from("shooting_event_stitch_passes")
          .select(
            "id, registration_stitch_id, pass_number, status, completed_at"
          )
          .eq("registration_stitch_id", registrationStitchId)
          .order("pass_number");

      if (refreshedPassError) {
        throw new Error(refreshedPassError.message);
      }

      const refreshedPasses =
        (refreshedPassData ?? []) as PassRow[];

      const refreshedEntry: StitchWithRegistration = {
        ...activeEntry,
        registrationStitch: {
          ...activeEntry.registrationStitch,
          status: nextStatus,
        },
        passes: refreshedPasses,
      };

      setRegisteredStitches((current) =>
        current.map((item) =>
          item.registrationStitch.id === registrationStitchId
            ? refreshedEntry
            : item
        )
      );

      const hasNextPass =
        requiredPasses > 1 &&
        activePassNumber < requiredPasses;

      if (hasNextPass) {
        const nextPassNumber = activePassNumber + 1;

        setMessage(
          `${activeEntry.stitch.name} · Passe ${activePassNumber} gespeichert. Weiter mit Passe ${nextPassNumber}.`
        );

        await loadPassResult(
          refreshedEntry,
          nextPassNumber
        );
      } else {
        setMessage(
          isRuetli
            ? `${activeEntry.stitch.name} gespeichert: ${totalScore} Punkte + ${ruetliHitCount} Treffer = ${ruetliRankingTotal}`
            : `${activeEntry.stitch.name} gespeichert: ${totalScore} Punkte`
        );

        await loadPassResult(
          refreshedEntry,
          activePassNumber
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Fehler: ${error.message}`
          : "Unbekannter Fehler beim Speichern."
      );
    } finally {
      setSaving(false);
    }
  }

  function statusText(entry: StitchWithRegistration) {
    if (entry.registrationStitch.status === "completed") {
      return "Abgeschlossen";
    }

    if (entry.registrationStitch.status === "started") {
      return "Begonnen";
    }

    if (entry.registrationStitch.status === "dns") {
      return "Nicht angetreten";
    }

    return "Offen";
  }

  function statusClasses(entry: StitchWithRegistration) {
    if (entry.registrationStitch.status === "completed") {
      return "bg-green-100 text-green-700";
    }

    if (entry.registrationStitch.status === "started") {
      return "bg-amber-100 text-amber-700";
    }

    if (entry.registrationStitch.status === "dns") {
      return "bg-slate-200 text-slate-600";
    }

    return "bg-blue-100 text-blue-700";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-600">
          Schiessanlass wird geladen...
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
        <h1 className="text-3xl font-bold text-slate-900">
          {eventName}
        </h1>

        <p className="mt-1 text-slate-600">
          Erfassung · nach Schütze
        </p>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <label className="form-label">
            Schütze
          </label>

          <select
            value={registrationId}
            onChange={async (event) => {
              const value = event.target.value;
              setRegistrationId(value);
              await loadShooterStitches(value);
            }}
            className="form-select"
          >
            <option value="">
              Schütze auswählen...
            </option>

            {sortedRegistrations.map((registration) => {
              const shooter = shooterById.get(registration.shooter_id);

              if (!shooter) return null;

              return (
                <option
                  key={registration.id}
                  value={registration.id}
                >
                  SB {shooter.master_number} · {shooter.last_name}{" "}
                  {shooter.first_name}
                </option>
              );
            })}
          </select>

          {selectedShooter && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                SB {selectedShooter.master_number} ·{" "}
                {selectedShooter.first_name}{" "}
                {selectedShooter.last_name}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Jahrgang:{" "}
                {selectedShooter.birth_year ?? "nicht hinterlegt"}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Standardwaffe:{" "}
                {standardWeapon?.name ?? "nicht hinterlegt"}
              </p>
            </div>
          )}
        </section>

        {selectedShooter && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Gelöste Stiche
              </h2>

              {loadingShooter ? (
                <p className="mt-4 text-sm text-slate-500">
                  Stiche werden geladen...
                </p>
              ) : registeredStitches.length === 0 ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    Für diesen Schützen wurden noch keine Stiche gelöst.
                  </p>

                  <Link
                    href={`/shooting-events/${eventId}/registration`}
                    className="mt-3 inline-block text-sm font-semibold text-blue-700"
                  >
                    Zur Anmeldung →
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {registeredStitches.map((entry) => {
                    const isActive =
                      activeStitchId === entry.registrationStitch.id;

                    const effectiveWeapon =
                      entry.registrationStitch.weapon_id_override
                        ? weaponById.get(
                            entry.registrationStitch.weapon_id_override
                          )
                        : standardWeapon;

                    return (
                      <button
                        key={entry.registrationStitch.id}
                        type="button"
                        onClick={() => openStitch(entry)}
                        className={`w-full rounded-xl border p-4 text-left ${
                          isActive
                            ? "border-slate-700 bg-slate-50"
                            : "bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {entry.stitch.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {entry.program?.code ?? "Kein Programm"} ·{" "}
                              {effectiveWeapon?.name ?? "kein Sportgerät"}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(
                              entry
                            )}`}
                          >
                            {statusText(entry)}
                          </span>
                        </div>

                        {entry.registrationStitch.registered_passes > 1 && (
                          <p className="mt-3 text-sm text-slate-600">
                            {entry.passes.length} /{" "}
                            {entry.registrationStitch.registered_passes} Passen erfasst
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              {!activeEntry ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900">
                    Resultaterfassung
                  </h2>

                  <p className="mt-3 text-slate-500">
                    Wähle links einen gelösten Stich aus.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        {activeEntry.stitch.name}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {activeProgram?.code ?? "Kein Programm"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses(
                        activeEntry
                      )}`}
                    >
                      {statusText(activeEntry)}
                    </span>
                  </div>

                  {!activeProgram ? (
                    <div className="mt-8 rounded-xl border border-dashed p-6">
                      <p className="font-semibold text-slate-900">
                        Kein Programm hinterlegt
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        Weise diesem Stich zuerst ein Schiessprogramm zu.
                      </p>
                    </div>
                  ) : activeProgram.special_code === "RUETLI" ? (
                    <div className="mt-8">
                      {loadingResult ? (
                        <p className="text-sm text-slate-500">
                          Resultat wird geladen...
                        </p>
                      ) : (
                        <>
                          {activeBlocks.map((block) => {
                            const blockStart = activeBlocks
                              .filter(
                                (item) =>
                                  item.block_number <
                                  block.block_number
                              )
                              .reduce(
                                (sum, item) =>
                                  sum + item.shot_count,
                                0
                              );

                            return (
                              <div
                                key={block.id}
                                className={
                                  block.block_number > 1
                                    ? "mt-8"
                                    : ""
                                }
                              >
                                <h3 className="font-bold text-slate-900">
                                  {block.block_type === "series"
                                    ? `${block.shot_count} Schuss Serie`
                                    : `${block.shot_count} Einzelschüsse`}{" "}
                                  · A5
                                </h3>

                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
                                  {shotValues
                                    .slice(
                                      blockStart,
                                      blockStart +
                                        block.shot_count
                                    )
                                    .map(
                                      (shot, index) => {
                                        const absoluteIndex =
                                          blockStart + index;

                                        return (
                                          <input
                                            key={absoluteIndex}
                                            type="number"
                                            min={0}
                                            max={5}
                                            step={1}
                                            value={shot}
                                            onChange={(event) =>
                                              updateShot(
                                                absoluteIndex,
                                                event.target.value
                                              )
                                            }
                                            className="form-input text-center"
                                            placeholder={`${absoluteIndex + 1}`}
                                          />
                                        );
                                      }
                                    )}
                                </div>
                              </div>
                            );
                          })}

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                A5-Total
                              </p>

                              <p className="mt-1 text-2xl font-bold text-slate-900">
                                {totalScore}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                Treffer
                              </p>

                              <p className="mt-1 text-2xl font-bold text-slate-900">
                                {ruetliHitCount}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                Rangiertotal
                              </p>

                              <p className="mt-1 text-2xl font-bold text-slate-900">
                                {ruetliRankingTotal}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Jeder Treffer von 1 bis 5 zählt zusätzlich
                            einen Punkt. Ein 0er zählt nicht als Treffer.
                          </p>

                          <button
                            type="button"
                            onClick={saveGenericResult}
                            disabled={saving}
                            className="btn-primary mt-6 w-full"
                          >
                            {saving
                              ? "Wird gespeichert..."
                              : activeEntry.registrationStitch
                                    .status === "completed"
                                ? "Rütli-Resultat speichern"
                                : "Rütli-Resultat abschliessen"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-8">
                      {activeEntry.registrationStitch.registered_passes > 1 && (
                        <div className="mb-6">
                          <label className="form-label">
                            Passe
                          </label>

                          <div className="flex flex-wrap gap-2">
                            {Array.from(
                              {
                                length:
                                  activeEntry.registrationStitch
                                    .registered_passes,
                              },
                              (_, index) => index + 1
                            ).map((passNumber) => {
                              const existingPass = activeEntry.passes.find(
                                (pass) => pass.pass_number === passNumber
                              );

                              return (
                                <button
                                  key={passNumber}
                                  type="button"
                                  onClick={() =>
                                    loadPassResult(activeEntry, passNumber)
                                  }
                                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                                    activePassNumber === passNumber
                                      ? "border-slate-800 bg-slate-100 text-slate-900"
                                      : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  Passe {passNumber}
                                  {existingPass?.status === "completed"
                                    ? " ✓"
                                    : ""}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {loadingResult ? (
                        <p className="text-sm text-slate-500">
                          Resultat wird geladen...
                        </p>
                      ) : (
                        <>
                          {activeProgram.single_shots > 0 && (
                            <div>
                              <h3 className="font-bold text-slate-900">
                                {activeProgram.single_shots} Einzelschüsse ·{" "}
                                {activeProgram.scoring_type}
                              </h3>

                              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {shotValues
                                  .slice(0, activeProgram.single_shots)
                                  .map((shot, index) => (
                                    <input
                                      key={index}
                                      type="number"
                                      min={0}
                                      max={maxScoreForProgram(activeProgram)}
                                      step={1}
                                      value={shot}
                                      onChange={(event) =>
                                        updateShot(index, event.target.value)
                                      }
                                      className="form-input text-center"
                                      placeholder={`${index + 1}`}
                                    />
                                  ))}
                              </div>
                            </div>
                          )}

                          {activeProgram.series_shots > 0 && (
                            <div className="mt-8">
                              <h3 className="font-bold text-slate-900">
                                {activeProgram.series_shots} Schuss Serie
                              </h3>

                              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {shotValues
                                  .slice(activeProgram.single_shots)
                                  .map((shot, index) => (
                                    <input
                                      key={index}
                                      type="number"
                                      min={0}
                                      max={maxScoreForProgram(activeProgram)}
                                      step={1}
                                      value={shot}
                                      onChange={(event) =>
                                        updateShot(
                                          activeProgram.single_shots + index,
                                          event.target.value
                                        )
                                      }
                                      className="form-input text-center"
                                      placeholder={`${
                                        activeProgram.single_shots + index + 1
                                      }`}
                                    />
                                  ))}
                              </div>
                            </div>
                          )}

                          {activeProgram.ranking_type === "section" &&
                            activeProgram.series_shots > 0 && (
                              <div className="mt-5">
                                <label className="form-label">
                                  Tiefschuss der Serie · A100
                                </label>

                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={seriesTieBreak}
                                  onChange={(event) =>
                                    setSeriesTieBreak(event.target.value)
                                  }
                                  className="form-input"
                                  placeholder="z.B. 64"
                                />
                              </div>
                            )}

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                Total
                              </p>

                              <p className="mt-1 text-2xl font-bold text-slate-900">
                                {totalScore}
                              </p>
                            </div>

                            {activeProgram.ranking_type === "best" && (
                              <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">
                                  Bester Schuss
                                </p>

                                <p className="mt-1 text-2xl font-bold text-slate-900">
                                  {bestShot ?? "–"}
                                </p>
                              </div>
                            )}

                            {activeProgram.ranking_type === "section" && (
                              <>
                                <div className="rounded-xl bg-slate-50 p-4">
                                  <p className="text-xs text-slate-500">
                                    Serie
                                  </p>

                                  <p className="mt-1 text-2xl font-bold text-slate-900">
                                    {seriesTotal}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-slate-50 p-4">
                                  <p className="text-xs text-slate-500">
                                    Tiefschuss
                                  </p>

                                  <p className="mt-1 text-2xl font-bold text-slate-900">
                                    {seriesTieBreak || "–"}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={saveGenericResult}
                            disabled={saving}
                            className="btn-primary mt-6 w-full"
                          >
                            {saving
                              ? "Wird gespeichert..."
                              : activeEntry.registrationStitch.status ===
                                  "completed"
                                ? "Resultat speichern"
                                : activeEntry.registrationStitch
                                      .registered_passes > 1
                                  ? `Passe ${activePassNumber} speichern`
                                  : "Resultat abschliessen"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {message && (
                <div className="mt-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
                  {message}
                </div>
              )}

              {selectedShooter && (
                <div className="mt-6 border-t pt-5">
                  <Link
                    href={`/shooting-events/${eventId}/registration`}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Anmeldung öffnen · Stiche nachlösen
                  </Link>

                  <p className="mt-2 text-center text-xs text-slate-500">
                    Bereits begonnene oder abgeschlossene Stiche bleiben in der Anmeldung geschützt.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
