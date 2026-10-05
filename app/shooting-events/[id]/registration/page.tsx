"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Shooter = {
  id: string;
  first_name: string;
  last_name: string;
  birth_year: number | null;
  club_id: string | null;
};

type Club = {
  id: string;
  name: string;
};

type Registration = {
  id: string;
  shooter_id: string;
  weapon_id: string | null;
  start_number: number | null;
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
  price_chf: number;
  additional_pass_price_chf: number;
  jj_price_chf: number | null;
  jj_additional_pass_price_chf: number | null;
};

type RegistrationStitch = {
  id: string;
  registration_id: string;
  event_stitch_id: string;
  weapon_id_override: string | null;
  status: string;
  registered_passes: number;
  price_override_chf: number | null;
  additional_pass_price_override_chf: number | null;
};

type StitchSelection = {
  selected: boolean;
  weaponOverrideId: string;
  status: string;
  registeredPasses: number;
  existingPasses: number;
  priceOverride: number | null;
  additionalPassPriceOverride: number | null;
};

export default function ShootingEventRegistrationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = params.id;
  const requestedRegistrationId =
    searchParams.get("registrationId") ?? "";

  const [eventName, setEventName] = useState("");
  const [eventYear, setEventYear] = useState<number | null>(null);

  const [registrations, setRegistrations] = useState<
    Registration[]
  >([]);

  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
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
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
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
        .select("id, name, event_date")
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
      setEventYear(eventData.event_date ? Number(eventData.event_date.slice(0, 4)) : null);

      const {
        data: registrationData,
        error: registrationError,
      } = await supabase
        .from("shooting_event_registrations")
        .select("id, shooter_id, weapon_id, start_number")
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
            "id, first_name, last_name, birth_year, club_id"
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
        data: clubData,
        error: clubError,
      } = await supabase
        .from("clubs")
        .select("id, name")
        .order("name");

      if (clubError) {
        setMessage(
          `Vereine konnten nicht geladen werden: ${clubError.message}`
        );

        setLoading(false);
        return;
      }

      setClubs(
        (clubData ?? []) as Club[]
      );

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
            max_passes,
            price_chf,
            additional_pass_price_chf,
            jj_price_chf,
            jj_additional_pass_price_chf
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
          priceOverride: null,
          additionalPassPriceOverride: null,
        };
      }

      setSelections(initialSelections);

      if (
        requestedRegistrationId &&
        loadedRegistrations.some(
          (registration) =>
            registration.id === requestedRegistrationId
        )
      ) {
        setRegistrationId(
          requestedRegistrationId
        );
      }

      setLoading(false);
    }

    loadData();
  }, [eventId, router, requestedRegistrationId]);

  useEffect(() => {
    if (
      loading ||
      !requestedRegistrationId ||
      registrationId !==
        requestedRegistrationId ||
      stitches.length === 0
    ) {
      return;
    }

    void loadRegistrationStitches(
      requestedRegistrationId
    );
  }, [
    loading,
    requestedRegistrationId,
    registrationId,
    stitches,
  ]);

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

  const clubById = useMemo(() => {
    return new Map(
      clubs.map((club) => [
        club.id,
        club,
      ])
    );
  }, [clubs]);

  const sortedRegistrations = useMemo(() => {
    return [...registrations].sort(
      (a, b) =>
        (a.start_number ?? 999999) -
        (b.start_number ?? 999999)
    );
  }, [registrations]);

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

  const selectedClub =
    selectedShooter?.club_id
      ? clubById.get(
          selectedShooter.club_id
        )
      : undefined;

  const selectedCategory = useMemo(() => {
    if (!selectedShooter?.birth_year || !eventYear) return "–";

    const age = eventYear - selectedShooter.birth_year;
    if (age >= 10 && age <= 16) return "JJ";
    if (age >= 17 && age <= 20) return "J";
    if (age >= 21 && age <= 45) return "E";
    if (age >= 46 && age <= 59) return "S";
    if (age >= 60 && age <= 69) return "V";
    if (age >= 70) return "SV";
    return "–";
  }, [selectedShooter, eventYear]);

  function effectivePrice(stitch: Stitch, selection?: StitchSelection) {
    let basePrice = Number(stitch.price_chf ?? 0);
    let additionalPassPrice = Number(stitch.additional_pass_price_chf ?? 0);
    let source = "Standard";

    if (selectedCategory === "JJ") {
      if (stitch.jj_price_chf !== null && stitch.jj_price_chf !== undefined) {
        basePrice = Number(stitch.jj_price_chf);
        source = "JJ";
      }

      if (
        stitch.jj_additional_pass_price_chf !== null &&
        stitch.jj_additional_pass_price_chf !== undefined
      ) {
        additionalPassPrice = Number(stitch.jj_additional_pass_price_chf);
      }
    }

    if (selection?.priceOverride !== null && selection?.priceOverride !== undefined) {
      basePrice = Number(selection.priceOverride);
      source = "Individuell";
    }

    if (
      selection?.additionalPassPriceOverride !== null &&
      selection?.additionalPassPriceOverride !== undefined
    ) {
      additionalPassPrice = Number(selection.additionalPassPriceOverride);
      source = "Individuell";
    }

    const passes = Math.max(1, selection?.registeredPasses ?? 1);
    const additionalPasses = Math.max(0, passes - 1);
    const total = basePrice + additionalPasses * additionalPassPrice;

    return { basePrice, additionalPassPrice, additionalPasses, total, source };
  }

  const registrationTotal = useMemo(() => {
    return stitches.reduce((sum, stitch) => {
      const selection = selections[stitch.id];
      if (!selection?.selected) return sum;
      return sum + effectivePrice(stitch, selection).total;
    }, 0);
  }, [stitches, selections, selectedCategory]);

  function money(value: number) {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 2,
    }).format(value);
  }

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
          priceOverride: null,
          additionalPassPriceOverride: null,
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
          registered_passes,
          price_override_chf,
          additional_pass_price_override_chf
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
        priceOverride:
          existingStitch?.price_override_chf === null ||
          existingStitch?.price_override_chf === undefined
            ? null
            : Number(existingStitch.price_override_chf),
        additionalPassPriceOverride:
          existingStitch?.additional_pass_price_override_chf === null ||
          existingStitch?.additional_pass_price_override_chf === undefined
            ? null
            : Number(existingStitch.additional_pass_price_override_chf),
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

  function setPriceOverride(
    stitchId: string,
    value: string
  ) {
    setSelections((current) => {
      const selection = current[stitchId];

      if (!selection) return current;

      const parsed =
        value.trim() === ""
          ? null
          : Number(value);

      return {
        ...current,
        [stitchId]: {
          ...selection,
          priceOverride:
            parsed !== null &&
            Number.isFinite(parsed)
              ? parsed
              : null,
        },
      };
    });
  }

  function setAdditionalPassPriceOverride(
    stitchId: string,
    value: string
  ) {
    setSelections((current) => {
      const selection = current[stitchId];

      if (!selection) return current;

      const parsed =
        value.trim() === ""
          ? null
          : Number(value);

      return {
        ...current,
        [stitchId]: {
          ...selection,
          additionalPassPriceOverride:
            parsed !== null &&
            Number.isFinite(parsed)
              ? parsed
              : null,
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
            registered_passes,
            price_override_chf,
            additional_pass_price_override_chf
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
          const updateValues: {
            price_override_chf:
              number | null;
            additional_pass_price_override_chf:
              number | null;
            registered_passes?: number;
          } = {
            price_override_chf:
              selection.priceOverride,
            additional_pass_price_override_chf:
              selection.additionalPassPriceOverride,
          };

          if (
            stitch.code ===
            "NACHDOPPEL"
          ) {
            const minimumPasses =
              Math.max(
                1,
                selection.existingPasses
              );

            updateValues.registered_passes =
              Math.max(
                minimumPasses,
                Math.min(
                  stitch.max_passes,
                  selection.registeredPasses
                )
              );
          }

          const {
            error: updateError,
          } = await supabase
            .from(
              "shooting_event_registration_stitches"
            )
            .update(updateValues)
            .eq(
              "id",
              existingRow.id
            );

          if (updateError) {
            throw new Error(
              updateError.message
            );
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

              price_override_chf:
                selection.priceOverride,

              additional_pass_price_override_chf:
                selection.additionalPassPriceOverride,

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
                      {registration.start_number ?? "–"}{" "}
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
                  {selectedRegistration?.start_number ?? "–"}{" "}
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
                  Kategorie: {selectedCategory}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Verein:{" "}
                  {selectedClub?.name ??
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

                                    {selected && (() => {
                                      const price = effectivePrice(stitch, selection);
                                      return (
                                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                          {money(price.total)}
                                          {price.source !== "Standard"
                                            ? ` · ${price.source}`
                                            : ""}
                                        </span>
                                      );
                                    })()}

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
                                {stitch.code === "NACHDOPPEL" && (
                                  <div className="mb-5">
                                    <label className="form-label">
                                      Anzahl gelöste Passen
                                    </label>

                                    <select
                                      value={
                                        selection?.registeredPasses ??
                                        minimumPasses
                                      }
                                      onChange={(event) =>
                                        setRegisteredPasses(
                                          stitch.id,
                                          Number(event.target.value)
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
                                        (_, index) =>
                                          minimumPasses + index
                                      ).map((passCount) => (
                                        <option
                                          key={passCount}
                                          value={passCount}
                                        >
                                          {passCount}
                                        </option>
                                      ))}
                                    </select>

                                    {selection?.existingPasses ? (
                                      <p className="mt-1 text-xs text-slate-500">
                                        Bereits erfasst:{" "}
                                        {selection.existingPasses} Passe
                                        {selection.existingPasses === 1
                                          ? ""
                                          : "n"}
                                      </p>
                                    ) : null}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  {(() => {
                                    const price = effectivePrice(
                                      stitch,
                                      selection
                                    );

                                    return (
                                      <div className="text-sm text-slate-700">
                                        <span className="text-slate-500">
                                          Preis:{" "}
                                        </span>
                                        <span className="font-bold text-slate-900">
                                          {money(price.total)}
                                        </span>
                                        {price.source !== "Standard" && (
                                          <span className="ml-2 text-xs font-semibold text-slate-500">
                                            {price.source}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedDetails((current) => ({
                                        ...current,
                                        [stitch.id]:
                                          !current[stitch.id],
                                      }))
                                    }
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    {expandedDetails[stitch.id]
                                      ? "Zusatzdaten ausblenden ▲"
                                      : "Zusatzdaten anzeigen ▼"}
                                  </button>
                                </div>

                                {expandedDetails[stitch.id] && (
                                  <div className="mt-5 space-y-5">
                                    <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                                      <div>
                                        <label className="form-label">
                                          Individueller Grundpreis
                                        </label>

                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-slate-500">
                                            CHF
                                          </span>

                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                              selection?.priceOverride ??
                                              ""
                                            }
                                            onChange={(event) =>
                                              setPriceOverride(
                                                stitch.id,
                                                event.target.value
                                              )
                                            }
                                            className="form-input"
                                            placeholder="Automatisch"
                                          />
                                        </div>

                                        <p className="mt-1 text-xs text-slate-500">
                                          Leer = Standard- bzw. JJ-Preis verwenden.
                                        </p>
                                      </div>

                                      {stitch.max_passes > 1 && (
                                        <div>
                                          <label className="form-label">
                                            Individueller Zusatzpass
                                          </label>

                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500">
                                              CHF
                                            </span>

                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={
                                                selection?.additionalPassPriceOverride ??
                                                ""
                                              }
                                              onChange={(event) =>
                                                setAdditionalPassPriceOverride(
                                                  stitch.id,
                                                  event.target.value
                                                )
                                              }
                                              className="form-input"
                                              placeholder="Automatisch"
                                            />
                                          </div>

                                          <p className="mt-1 text-xs text-slate-500">
                                            Leer = konfigurierten Zusatzpasspreis verwenden.
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <label className="form-label">
                                        Sportgerät für diesen Stich
                                      </label>

                                      <select
                                        value={
                                          selection?.weaponOverrideId ??
                                          ""
                                        }
                                        disabled={locked}
                                        onChange={(event) =>
                                          setWeaponOverride(
                                            stitch.id,
                                            event.target.value
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
                                            (weapon) =>
                                              weapon.id !==
                                              selectedRegistration?.weapon_id
                                          )
                                          .map((weapon) => (
                                            <option
                                              key={weapon.id}
                                              value={weapon.id}
                                            >
                                              {weapon.name}
                                            </option>
                                          ))}
                                      </select>

                                      {locked &&
                                        stitch.code !==
                                          "NACHDOPPEL" && (
                                          <p className="mt-1 text-xs text-slate-500">
                                            Nach Beginn des Stichs können
                                            Anmeldung und Sportgerät nicht mehr
                                            geändert werden.
                                          </p>
                                        )}
                                    </div>
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

              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      Einnahmen dieser Anmeldung
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Summe aller aktuell ausgewählten Stiche und gelösten Passen.
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    {money(registrationTotal)}
                  </p>
                </div>
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