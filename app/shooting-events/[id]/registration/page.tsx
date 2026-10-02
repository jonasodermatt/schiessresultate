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

type Stitch = {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  scoring_type: string;
  shots_per_pass: number;
  max_passes: number;
};

type RegistrationStitch = {
  id: string;
  registration_id: string;
  event_stitch_id: string;
  weapon_id_override: string | null;
  status: string;
  registered_passes: number;
};

type StitchSelection = {
  selected: boolean;
  weaponOverrideId: string;
  status: string;
  registeredPasses: number;
  existingPasses: number;
};

export default function ShootingEventRegistrationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventId = params.id;

  const [eventName, setEventName] = useState("");

  const [registrations, setRegistrations] = useState<
    Registration[]
  >([]);

  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);

  const [registrationId, setRegistrationId] = useState("");

  const [selections, setSelections] = useState<
    Record<string, StitchSelection>
  >({});

  const [loading, setLoading] = useState(true);

  const [loadingRegistration, setLoadingRegistration] =
    useState(false);

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

      const {
        data: eventData,
        error: eventError,
      } = await supabase
        .from("shooting_events")
        .select("id, name")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        setMessage(
          `Schiessanlass konnte nicht geladen werden: ${
            eventError?.message ?? "Nicht gefunden"
          }`
        );

        setLoading(false);
        return;
      }

      setEventName(eventData.name);

      const {
        data: registrationData,
        error: registrationError,
      } = await supabase
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
        new Set(
          loadedRegistrations
            .map(
              (registration) =>
                registration.shooter_id
            )
            .filter(Boolean)
        )
      );

      if (shooterIds.length > 0) {
        const {
          data: shooterData,
          error: shooterError,
        } = await supabase
          .from("shooters")
          .select(
            "id, master_number, first_name, last_name, birth_year"
          )
          .in("id", shooterIds);

        if (shooterError) {
          setMessage(
            `Schützen konnten nicht geladen werden: ${shooterError.message}`
          );

          setLoading(false);
          return;
        }

        setShooters(
          (shooterData ?? []) as Shooter[]
        );
      }

      const {
        data: weaponData,
        error: weaponError,
      } = await supabase
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

      setWeapons(
        (weaponData ?? []) as Weapon[]
      );

      const {
        data: stitchData,
        error: stitchError,
      } = await supabase
        .from("shooting_event_stitches")
        .select(
          `
            id,
            name,
            code,
            sort_order,
            scoring_type,
            shots_per_pass,
            max_passes
          `
        )
        .eq("shooting_event_id", eventId)
        .eq("active", true)
        .order("sort_order");

      if (stitchError) {
        setMessage(
          `Stiche konnten nicht geladen werden: ${stitchError.message}`
        );

        setLoading(false);
        return;
      }

      const loadedStitches =
        (stitchData ?? []) as Stitch[];

      setStitches(loadedStitches);

      const initialSelections: Record<
        string,
        StitchSelection
      > = {};

      for (const stitch of loadedStitches) {
        initialSelections[stitch.id] = {
          selected: false,
          weaponOverrideId: "",
          status: "registered",
          registeredPasses: 1,
          existingPasses: 0,
        };
      }

      setSelections(initialSelections);
      setLoading(false);
    }

    loadData();
  }, [eventId, router]);

  const shooterById = useMemo(() => {
    return new Map(
      shooters.map((shooter) => [
        shooter.id,
        shooter,
      ])
    );
  }, [shooters]);

  const weaponById = useMemo(() => {
    return new Map(
      weapons.map((weapon) => [
        weapon.id,
        weapon,
      ])
    );
  }, [weapons]);

  const sortedRegistrations = useMemo(() => {
    return [...registrations].sort((a, b) => {
      const shooterA = shooterById.get(
        a.shooter_id
      );

      const shooterB = shooterById.get(
        b.shooter_id
      );

      return (
        (shooterA?.master_number ?? 999999) -
        (shooterB?.master_number ?? 999999)
      );
    });
  }, [registrations, shooterById]);

  const selectedRegistration =
    registrations.find(
      (registration) =>
        registration.id === registrationId
    );

  const selectedShooter =
    selectedRegistration
      ? shooterById.get(
          selectedRegistration.shooter_id
        )
      : undefined;

  const standardWeapon =
    selectedRegistration?.weapon_id
      ? weaponById.get(
          selectedRegistration.weapon_id
        )
      : undefined;

  async function loadRegistrationStitches(
    selectedRegistrationId: string
  ) {
    if (!selectedRegistrationId) {
      const emptySelections: Record<
        string,
        StitchSelection
      > = {};

      for (const stitch of stitches) {
        emptySelections[stitch.id] = {
          selected: false,
          weaponOverrideId: "",
          status: "registered",
          registeredPasses: 1,
          existingPasses: 0,
        };
      }

      setSelections(emptySelections);
      return;
    }

    setLoadingRegistration(true);
    setMessage("");

    const {
      data,
      error,
    } = await supabase
      .from(
        "shooting_event_registration_stitches"
      )
      .select(
        `
          id,
          registration_id,
          event_stitch_id,
          weapon_id_override,
          status,
          registered_passes
        `
      )
      .eq(
        "registration_id",
        selectedRegistrationId
      );

    if (error) {
      setMessage(
        `Gelöste Stiche konnten nicht geladen werden: ${error.message}`
      );

      setLoadingRegistration(false);
      return;
    }

    const existing =
      (data ?? []) as RegistrationStitch[];

    /*
     * Bereits tatsächlich erfasste Passen zählen.
     * Das ist speziell für Nachdoppel wichtig.
     */
    const registrationStitchIds =
      existing.map((item) => item.id);

    const passCounts: Record<string, number> =
      {};

    if (registrationStitchIds.length > 0) {
      const {
        data: passData,
        error: passError,
      } = await supabase
        .from("shooting_event_stitch_passes")
        .select("registration_stitch_id")
        .in(
          "registration_stitch_id",
          registrationStitchIds
        );

      if (passError) {
        setMessage(
          `Passen konnten nicht geladen werden: ${passError.message}`
        );

        setLoadingRegistration(false);
        return;
      }

      for (const pass of passData ?? []) {
        const key =
          pass.registration_stitch_id;

        passCounts[key] =
          (passCounts[key] ?? 0) + 1;
      }
    }

    const nextSelections: Record<
      string,
      StitchSelection
    > = {};

    for (const stitch of stitches) {
      const existingStitch = existing.find(
        (item) =>
          item.event_stitch_id === stitch.id
      );

      const existingPasses =
        existingStitch
          ? passCounts[existingStitch.id] ?? 0
          : 0;

      nextSelections[stitch.id] = {
        selected: Boolean(existingStitch),

        weaponOverrideId:
          existingStitch
            ?.weapon_id_override ?? "",

        status:
          existingStitch?.status ??
          "registered",

        registeredPasses:
          existingStitch
            ?.registered_passes ??
          Math.max(1, existingPasses),

        existingPasses,
      };
    }

    setSelections(nextSelections);
    setLoadingRegistration(false);
  }

  function toggleStitch(stitchId: string) {
    setSelections((current) => {
      const selection = current[stitchId];

      if (!selection) {
        return current;
      }

      /*
       * Abgeschlossene oder begonnene Stiche
       * dürfen nicht über die Anmeldung entfernt werden.
       */
      if (
        selection.status === "completed" ||
        selection.status === "started"
      ) {
        return current;
      }

      return {
        ...current,
        [stitchId]: {
          ...selection,
          selected: !selection.selected,
        },
      };
    });
  }

  function setRegisteredPasses(
    stitchId: string,
    passes: number
  ) {
    setSelections((current) => {
      const selection = current[stitchId];

      if (!selection) {
        return current;
      }

      /*
       * Nie weniger Passen als bereits
       * tatsächlich erfasst wurden.
       */
      const minimum = Math.max(
        1,
        selection.existingPasses
      );

      return {
        ...current,
        [stitchId]: {
          ...selection,
          registeredPasses: Math.max(
            minimum,
            passes
          ),
        },
      };
    });
  }

  function setWeaponOverride(
    stitchId: string,
    weaponId: string
  ) {
    setSelections((current) => {
      const selection = current[stitchId];

      if (!selection) {
        return current;
      }

      /*
       * Nach Beginn eines Stichs darf die
       * Waffe nicht mehr verändert werden.
       */
      if (
        selection.status === "completed" ||
        selection.status === "started"
      ) {
        return current;
      }

      return {
        ...current,
        [stitchId]: {
          ...selection,
          weaponOverrideId: weaponId,
        },
      };
    });
  }

  async function saveRegistration() {
    if (!registrationId) {
      setMessage(
        "Bitte zuerst einen Schützen auswählen."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: existingData,
        error: existingError,
      } = await supabase
        .from(
          "shooting_event_registration_stitches"
        )
        .select(
          `
            id,
            event_stitch_id,
            status,
            registered_passes
          `
        )
        .eq(
          "registration_id",
          registrationId
        );

      if (existingError) {
        throw new Error(
          existingError.message
        );
      }

      const existing = existingData ?? [];

      /*
       * Sicherheitsprüfung:
       * Begonnene und abgeschlossene Stiche
       * dürfen nicht abgewählt werden.
       */
      for (const row of existing) {
        const selection =
          selections[row.event_stitch_id];

        if (
          !selection?.selected &&
          row.status !== "registered" &&
          row.status !== "dns"
        ) {
          const stitch = stitches.find(
            (item) =>
              item.id ===
              row.event_stitch_id
          );

          throw new Error(
            `${
              stitch?.name ?? "Stich"
            } enthält bereits Resultatdaten und kann nicht entfernt werden.`
          );
        }
      }

      const selectedStitches =
        stitches.filter(
          (stitch) =>
            selections[stitch.id]?.selected
        );

      for (const stitch of selectedStitches) {
        const selection =
          selections[stitch.id];

        if (!selection) {
          continue;
        }

        const existingRow = existing.find(
          (row) =>
            row.event_stitch_id ===
            stitch.id
        );

        /*
         * Abgeschlossene/begonnene normale
         * Stiche werden nicht mehr verändert.
         *
         * Ausnahme Nachdoppel:
         * Dort darf die Anzahl gelöster Passen
         * später noch erhöht/angepasst werden,
         * jedoch nie unter die bereits erfassten.
         */
        if (
          existingRow &&
          (existingRow.status ===
            "completed" ||
            existingRow.status ===
              "started")
        ) {
          if (
            stitch.code ===
            "NACHDOPPEL"
          ) {
            const minimumPasses =
              Math.max(
                1,
                selection.existingPasses
              );

            const newRegisteredPasses =
              Math.max(
                minimumPasses,
                Math.min(
                  stitch.max_passes,
                  selection.registeredPasses
                )
              );

            const {
              error: updateError,
            } = await supabase
              .from(
                "shooting_event_registration_stitches"
              )
              .update({
                registered_passes:
                  newRegisteredPasses,
              })
              .eq(
                "id",
                existingRow.id
              );

            if (updateError) {
              throw new Error(
                updateError.message
              );
            }
          }

          continue;
        }

        /*
         * Dieselbe Waffe wie die Standardwaffe
         * wird nicht als Override gespeichert.
         */
        const override =
          selection.weaponOverrideId &&
          selection.weaponOverrideId !==
            selectedRegistration?.weapon_id
            ? selection.weaponOverrideId
            : null;

        const registeredPasses =
          stitch.code === "NACHDOPPEL"
            ? Math.max(
                1,
                Math.min(
                  stitch.max_passes,
                  selection.registeredPasses
                )
              )
            : 1;

        const {
          error: upsertError,
        } = await supabase
          .from(
            "shooting_event_registration_stitches"
          )
          .upsert(
            {
              registration_id:
                registrationId,

              event_stitch_id:
                stitch.id,

              weapon_id_override:
                override,

              registered_passes:
                registeredPasses,

              status:
                existingRow?.status ??
                "registered",
            },
            {
              onConflict:
                "registration_id,event_stitch_id",
            }
          );

        if (upsertError) {
          throw new Error(
            upsertError.message
          );
        }
      }

      /*
       * Nur noch komplett ungeschossene Stiche
       * dürfen wieder entfernt werden.
       */
      const removableIds = existing
        .filter((row) => {
          const selection =
            selections[row.event_stitch_id];

          return (
            !selection?.selected &&
            (row.status ===
              "registered" ||
              row.status === "dns")
          );
        })
        .map((row) => row.id);

      if (removableIds.length > 0) {
        const {
          error: deleteError,
        } = await supabase
          .from(
            "shooting_event_registration_stitches"
          )
          .delete()
          .in("id", removableIds);

        if (deleteError) {
          throw new Error(
            deleteError.message
          );
        }
      }

      setMessage(
        "Anmeldung erfolgreich gespeichert."
      );

      await loadRegistrationStitches(
        registrationId
      );
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

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-600">
          Anmeldung wird geladen...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
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

      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {eventName}
        </h1>

        <p className="mt-1 text-slate-600">
          Anmeldung · Stiche lösen
        </p>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <label className="form-label">
              Schütze
            </label>

            <select
              value={registrationId}
              onChange={async (event) => {
                const value =
                  event.target.value;

                setRegistrationId(value);

                await loadRegistrationStitches(
                  value
                );
              }}
              className="form-select"
            >
              <option value="">
                Schütze auswählen...
              </option>

              {sortedRegistrations.map(
                (registration) => {
                  const shooter =
                    shooterById.get(
                      registration.shooter_id
                    );

                  if (!shooter) {
                    return null;
                  }

                  return (
                    <option
                      key={registration.id}
                      value={registration.id}
                    >
                      SB{" "}
                      {
                        shooter.master_number
                      }{" "}
                      · {shooter.last_name}{" "}
                      {shooter.first_name}
                    </option>
                  );
                }
              )}
            </select>
          </div>

          {selectedShooter && (
            <>
              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">
                  SB{" "}
                  {
                    selectedShooter.master_number
                  }{" "}
                  ·{" "}
                  {
                    selectedShooter.first_name
                  }{" "}
                  {
                    selectedShooter.last_name
                  }
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Jahrgang:{" "}
                  {selectedShooter.birth_year ??
                    "nicht hinterlegt"}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Standardwaffe:{" "}
                  {standardWeapon?.name ??
                    "nicht hinterlegt"}
                </p>
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-bold text-slate-900">
                  Gelöste Stiche
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Wähle alle Stiche aus,
                  die der Schütze gelöst
                  hat.
                </p>

                {loadingRegistration ? (
                  <p className="mt-5 text-sm text-slate-500">
                    Stiche werden geladen...
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {stitches.map(
                      (stitch) => {
                        const selection =
                          selections[
                            stitch.id
                          ];

                        const selected =
                          selection?.selected ??
                          false;

                        const isCompleted =
                          selection?.status ===
                          "completed";

                        const isStarted =
                          selection?.status ===
                          "started";

                        const locked =
                          isCompleted ||
                          isStarted;

                        const minimumPasses =
                          Math.max(
                            1,
                            selection
                              ?.existingPasses ??
                              0
                          );

                        const maxPasses =
                          Math.max(
                            minimumPasses,
                            stitch.max_passes ??
                              1
                          );

                        return (
                          <div
                            key={stitch.id}
                            className={`rounded-xl border p-4 ${
                              selected
                                ? "border-slate-400 bg-slate-50"
                                : "bg-white"
                            }`}
                          >
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={
                                  selected
                                }
                                disabled={
                                  locked
                                }
                                onChange={() =>
                                  toggleStitch(
                                    stitch.id
                                  )
                                }
                                className="mt-1 h-5 w-5"
                              />

                              <div className="flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {
                                      stitch.name
                                    }
                                  </span>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-slate-500">
                                      {
                                        stitch.scoring_type
                                      }{" "}
                                      ·{" "}
                                      {
                                        stitch.shots_per_pass
                                      }{" "}
                                      Schuss
                                      {stitch.max_passes >
                                      1
                                        ? ` · max. ${stitch.max_passes} Passen`
                                        : ""}
                                    </span>

                                    {isCompleted && (
                                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                        ✓
                                        Abgeschlossen
                                      </span>
                                    )}

                                    {isStarted && (
                                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                        Begonnen
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </label>

                            {selected && (
                              <div className="mt-4 border-t pt-4">
                                <label className="form-label">
                                  Sportgerät
                                  für diesen
                                  Stich
                                </label>

                                <select
                                  value={
                                    selection
                                      ?.weaponOverrideId ??
                                    ""
                                  }
                                  disabled={
                                    locked
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setWeaponOverride(
                                      stitch.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="form-select"
                                >
                                  <option value="">
                                    Standardwaffe
                                    {standardWeapon
                                      ? ` · ${standardWeapon.name}`
                                      : ""}
                                  </option>

                                  {weapons
                                    .filter(
                                      (
                                        weapon
                                      ) =>
                                        weapon.id !==
                                        selectedRegistration
                                          ?.weapon_id
                                    )
                                    .map(
                                      (
                                        weapon
                                      ) => (
                                        <option
                                          key={
                                            weapon.id
                                          }
                                          value={
                                            weapon.id
                                          }
                                        >
                                          {
                                            weapon.name
                                          }
                                        </option>
                                      )
                                    )}
                                </select>

                                {locked &&
                                  stitch.code !==
                                    "NACHDOPPEL" && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      Nach
                                      Beginn des
                                      Stichs
                                      können
                                      Anmeldung
                                      und
                                      Sportgerät
                                      nicht mehr
                                      geändert
                                      werden.
                                    </p>
                                  )}

                                {stitch.code ===
                                  "NACHDOPPEL" && (
                                  <div className="mt-4">
                                    <label className="form-label">
                                      Anzahl
                                      gelöste
                                      Passen
                                    </label>

                                    <select
                                      value={
                                        selection
                                          ?.registeredPasses ??
                                        minimumPasses
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setRegisteredPasses(
                                          stitch.id,
                                          Number(
                                            event
                                              .target
                                              .value
                                          )
                                        )
                                      }
                                      className="form-select"
                                    >
                                      {Array.from(
                                        {
                                          length:
                                            maxPasses -
                                            minimumPasses +
                                            1,
                                        },
                                        (
                                          _,
                                          index
                                        ) =>
                                          minimumPasses +
                                          index
                                      ).map(
                                        (
                                          passes
                                        ) => (
                                          <option
                                            key={
                                              passes
                                            }
                                            value={
                                              passes
                                            }
                                          >
                                            {
                                              passes
                                            }{" "}
                                            {passes ===
                                            1
                                              ? "Passe"
                                              : "Passen"}
                                          </option>
                                        )
                                      )}
                                    </select>

                                    <p className="mt-1 text-xs text-slate-500">
                                      Bereits
                                      erfasst:{" "}
                                      {selection
                                        ?.existingPasses ??
                                        0}{" "}
                                      · maximal{" "}
                                      {
                                        stitch.max_passes
                                      }
                                    </p>

                                    {locked && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        Beim
                                        Nachdoppel
                                        können
                                        weitere
                                        Passen
                                        nachgelöst
                                        werden.
                                        Die Anzahl
                                        darf aber
                                        nicht unter
                                        die bereits
                                        erfassten
                                        Passen
                                        reduziert
                                        werden.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={saveRegistration}
                disabled={
                  saving ||
                  loadingRegistration
                }
                className="btn-primary mt-8 w-full"
              >
                {saving
                  ? "Wird gespeichert..."
                  : "Anmeldung speichern"}
              </button>
            </>
          )}

          {message && (
            <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}