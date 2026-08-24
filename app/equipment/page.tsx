"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type EquipmentDistance = {
  distance_m: number;
};

type EquipmentPosition = {
  position: string;
};

type Equipment = {
  id: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  notes: string | null;
    active: boolean | null;
  iris_min: number | null;
  iris_max: number | null;
  front_sight_min: number | null;
  front_sight_max: number | null;

  equipment_distances: EquipmentDistance[];
  equipment_positions: EquipmentPosition[];
};

const POSITION_OPTIONS = [
  {
    value: "prone",
    label: "Liegend",
  },
  {
    value: "standing",
    label: "Stehend",
  },
  {
    value: "kneeling",
    label: "Kniend",
  },
  {
    value: "sitting",
    label: "Sitzend",
  },
  {
    value: "supported",
    label: "Aufgelegt",
  },
  {
    value: "other",
    label: "Andere",
  },
];

function getPositionLabel(position: string) {
  return (
    POSITION_OPTIONS.find(
      (option) => option.value === position
    )?.label ?? position
  );
}

export default function EquipmentPage() {
  const router = useRouter();

  const [equipment, setEquipment] = useState<
    Equipment[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState<
    string | null
  >(null);

  const [name, setName] = useState("");
  const [category, setCategory] =
    useState("Gewehr");
  const [manufacturer, setManufacturer] =
    useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] =
    useState("");
  const [notes, setNotes] = useState("");

  const [irisMin, setIrisMin] = useState("");
  const [irisMax, setIrisMax] = useState("");

  const [frontSightMin, setFrontSightMin] =
    useState("");
  const [frontSightMax, setFrontSightMax] =
    useState("");

  const [distances, setDistances] = useState<
    number[]
  >([]);

  const [distanceInput, setDistanceInput] =
    useState("");

  const [positions, setPositions] = useState<
    string[]
  >([]);

  const loadEquipment = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("equipment")
      .select(`
        id,
        name,
        category,
        manufacturer,
        model,
        serial_number,
        notes,
          active,
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
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      setMessage(
        `Fehler beim Laden: ${error.message}`
      );
    } else {
      setEquipment(
        (data ?? []) as Equipment[]
      );
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  function resetForm() {
    setEditingId(null);

    setName("");
    setCategory("Gewehr");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setNotes("");

    setIrisMin("");
    setIrisMax("");
    setFrontSightMin("");
    setFrontSightMax("");

    setDistances([]);
    setDistanceInput("");
    setPositions([]);
  }

  function startEdit(item: Equipment) {
    setEditingId(item.id);

    setName(item.name);
    setCategory(item.category || "Gewehr");
    setManufacturer(item.manufacturer ?? "");
    setModel(item.model ?? "");
    setSerialNumber(
      item.serial_number ?? ""
    );
    setNotes(item.notes ?? "");

    setIrisMin(
      item.iris_min !== null
        ? String(item.iris_min)
        : ""
    );

    setIrisMax(
      item.iris_max !== null
        ? String(item.iris_max)
        : ""
    );

    setFrontSightMin(
      item.front_sight_min !== null
        ? String(item.front_sight_min)
        : ""
    );

    setFrontSightMax(
      item.front_sight_max !== null
        ? String(item.front_sight_max)
        : ""
    );

    setDistances(
      (item.equipment_distances ?? [])
        .map((distance) =>
          Number(distance.distance_m)
        )
        .sort((a, b) => a - b)
    );

    setPositions(
      (item.equipment_positions ?? []).map(
        (position) => position.position
      )
    );

    setDistanceInput("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function addDistance() {
    const value = Number(distanceInput);

    if (
      Number.isNaN(value) ||
      value <= 0
    ) {
      setMessage(
        "Bitte eine gültige Distanz eingeben."
      );
      return;
    }

    if (distances.includes(value)) {
      setMessage(
        `${value} m ist bereits hinterlegt.`
      );
      return;
    }

    setDistances((current) =>
      [...current, value].sort(
        (a, b) => a - b
      )
    );

    setDistanceInput("");
    setMessage("");
  }

  function removeDistance(
    distance: number
  ) {
    setDistances((current) =>
      current.filter(
        (item) => item !== distance
      )
    );
  }

  function togglePosition(
    position: string
  ) {
    setPositions((current) =>
      current.includes(position)
        ? current.filter(
            (item) => item !== position
          )
        : [...current, position]
    );
  }

  function nullableNumber(
    value: string
  ): number | null {
    if (value.trim() === "") {
      return null;
    }

    const number = Number(value);

    return Number.isNaN(number)
      ? null
      : number;
  }

  async function deactivateEquipment(
    item: Equipment
  ) {
    const confirmed = window.confirm(
      `Möchtest du "${item.name}" wirklich deaktivieren?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("equipment")
      .update({
        active: false,
      })
      .eq("id", item.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(
        `Sportgerät konnte nicht deaktiviert werden: ${error.message}`
      );
      return;
    }

    if (editingId === item.id) {
      resetForm();
    }

    setMessage(
      `"${item.name}" wurde deaktiviert.`
    );

    await loadEquipment();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const irisMinValue =
      nullableNumber(irisMin);

    const irisMaxValue =
      nullableNumber(irisMax);

    const frontSightMinValue =
      nullableNumber(frontSightMin);

    const frontSightMaxValue =
      nullableNumber(frontSightMax);

    if (
      irisMinValue !== null &&
      irisMaxValue !== null &&
      irisMinValue > irisMaxValue
    ) {
      setMessage(
        "Bei der Irisblende darf der Minimalwert nicht grösser als der Maximalwert sein."
      );
      setSaving(false);
      return;
    }

    if (
      frontSightMinValue !== null &&
      frontSightMaxValue !== null &&
      frontSightMinValue >
        frontSightMaxValue
    ) {
      setMessage(
        "Beim Korn darf der Minimalwert nicht grösser als der Maximalwert sein."
      );
      setSaving(false);
      return;
    }

    let savedEquipmentId:
      | string
      | null = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("equipment")
        .update({
          name,
          category,
          manufacturer:
            manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number:
            serialNumber.trim() || null,
          notes: notes.trim() || null,

          iris_min: irisMinValue,
          iris_max: irisMaxValue,

          front_sight_min:
            frontSightMinValue,
          front_sight_max:
            frontSightMaxValue,
        })
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        setMessage(
          `Fehler beim Speichern: ${error.message}`
        );
        setSaving(false);
        return;
      }
    } else {
      const {
        data: insertedEquipment,
        error,
      } = await supabase
        .from("equipment")
        .insert({
          user_id: user.id,
          name,
          category,

          manufacturer:
            manufacturer.trim() || null,

          model:
            model.trim() || null,

          serial_number:
            serialNumber.trim() || null,

          notes:
            notes.trim() || null,

          iris_min: irisMinValue,
          iris_max: irisMaxValue,

          front_sight_min:
            frontSightMinValue,

          front_sight_max:
            frontSightMaxValue,

          active: true,
        })
        .select("id")
        .single();

      if (
        error ||
        !insertedEquipment
      ) {
        setMessage(
          `Fehler beim Speichern: ${
            error?.message ??
            "Unbekannter Fehler"
          }`
        );
        setSaving(false);
        return;
      }

      savedEquipmentId =
        insertedEquipment.id;
    }

    if (!savedEquipmentId) {
      setMessage(
        "Sportgerät konnte nicht gespeichert werden."
      );
      setSaving(false);
      return;
    }

    /*
     * Beim Bearbeiten bestehende
     * Distanzen und Stellungen ersetzen.
     */
    if (editingId) {
      const {
        error: distanceDeleteError,
      } = await supabase
        .from("equipment_distances")
        .delete()
        .eq(
          "equipment_id",
          savedEquipmentId
        );

      if (distanceDeleteError) {
        setMessage(
          `Sportgerät gespeichert, aber Distanzen konnten nicht aktualisiert werden: ${distanceDeleteError.message}`
        );
        setSaving(false);
        return;
      }

      const {
        error: positionDeleteError,
      } = await supabase
        .from("equipment_positions")
        .delete()
        .eq(
          "equipment_id",
          savedEquipmentId
        );

      if (positionDeleteError) {
        setMessage(
          `Sportgerät gespeichert, aber Stellungen konnten nicht aktualisiert werden: ${positionDeleteError.message}`
        );
        setSaving(false);
        return;
      }
    }

    /*
     * Distanzen speichern
     */
    if (distances.length > 0) {
      const distanceRows =
        distances.map((distance) => ({
          equipment_id:
            savedEquipmentId,
          distance_m: distance,
        }));

      const { error } = await supabase
        .from("equipment_distances")
        .insert(distanceRows);

      if (error) {
        setMessage(
          `Sportgerät gespeichert, aber Fehler bei den Distanzen: ${error.message}`
        );
        setSaving(false);
        return;
      }
    }

    /*
     * Stellungen speichern
     */
    if (positions.length > 0) {
      const positionRows =
        positions.map((position) => ({
          equipment_id:
            savedEquipmentId,
          position,
        }));

      const { error } = await supabase
        .from("equipment_positions")
        .insert(positionRows);

      if (error) {
        setMessage(
          `Sportgerät gespeichert, aber Fehler bei den Stellungen: ${error.message}`
        );
        setSaving(false);
        return;
      }
    }

    setMessage(
      editingId
        ? "Sportgerät wurde aktualisiert."
        : "Sportgerät wurde gespeichert."
    );

    resetForm();

    await loadEquipment();

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
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
                Deine Resultate. Deine
                Entwicklung.
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Meine Sportgeräte
          </h1>

          <p className="mt-2 text-slate-600">
            Verwalte deine Gewehre,
            Pistolen und weitere
            Sportgeräte.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Liste */}
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Meine Sportgeräte
            </h2>

            {loading ? (
              <p className="text-slate-500">
                Wird geladen...
              </p>
            ) : equipment.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                <div className="mb-3 text-4xl">
                  🔫
                </div>

                <p className="font-semibold text-slate-900">
                  Noch keine Sportgeräte
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Erfasse rechts dein
                  erstes Sportgerät.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
{equipment.map((item) => (
  <div
    key={item.id}
    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    {/* Kopfbereich */}
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3
          style={{
            color: "#0f172a",
            fontSize: "20px",
            fontWeight: 700,
          }}
        >
          {item.name}
        </h3>

        <p
          style={{
            color: "#64748b",
            fontSize: "14px",
            marginTop: "4px",
          }}
        >
          {item.category}

          {(item.manufacturer || item.model) && (
            <>
              {" · "}
              {[item.manufacturer, item.model]
                .filter(Boolean)
                .join(" ")}
            </>
          )}
        </p>
      </div>

      {item.active && (
        <span
          style={{
            color: "#15803d",
            backgroundColor: "#f0fdf4",
            padding: "5px 10px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          Aktiv
        </span>
      )}
    </div>

    {/* Eigenschaften */}
    <div className="mt-6 space-y-5">

      {/* Distanzen */}
      {item.equipment_distances &&
        item.equipment_distances.length > 0 && (
          <div>
            <p
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Distanzen
            </p>

            <p
              style={{
                color: "#0f172a",
                fontSize: "15px",
                fontWeight: 600,
                marginTop: "6px",
              }}
            >
              {[...item.equipment_distances]
                .sort(
                  (a, b) =>
                    Number(a.distance_m) -
                    Number(b.distance_m)
                )
                .map(
                  (distance) =>
                    `${distance.distance_m} m`
                )
                .join(" · ")}
            </p>
          </div>
        )}

      {/* Stellungen */}
      {item.equipment_positions &&
        item.equipment_positions.length > 0 && (
          <div>
            <p
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Stellungen
            </p>

            <p
              style={{
                color: "#0f172a",
                fontSize: "15px",
                fontWeight: 600,
                marginTop: "6px",
              }}
            >
              {item.equipment_positions
                .map((position) =>
                  getPositionLabel(position.position)
                )
                .join(" · ")}
            </p>
          </div>
        )}

      {/* Iris und Korn */}
      {(item.iris_min !== null ||
        item.iris_max !== null ||
        item.front_sight_min !== null ||
        item.front_sight_max !== null) && (
        <div>
          <p
            style={{
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Visierung
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-12">
            {(item.iris_min !== null ||
              item.iris_max !== null) && (
              <p
                style={{
                  color: "#334155",
                  fontSize: "14px",
                }}
              >
                <span
                  style={{
                    color: "#0f172a",
                    fontWeight: 600,
                  }}
                >
                  Iris:
                </span>{" "}
                {item.iris_min ?? "–"} –{" "}
                {item.iris_max ?? "–"} mm
              </p>
            )}

            {(item.front_sight_min !== null ||
              item.front_sight_max !== null) && (
              <p
                style={{
                  color: "#334155",
                  fontSize: "14px",
                }}
              >
                <span
                  style={{
                    color: "#0f172a",
                    fontWeight: 600,
                  }}
                >
                  Korn:
                </span>{" "}
                {item.front_sight_min ?? "–"} –{" "}
                {item.front_sight_max ?? "–"} mm
              </p>
            )}
          </div>
        </div>
      )}

      {/* Seriennummer */}
      {item.serial_number && (
        <div>
          <p
            style={{
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Seriennummer
          </p>

          <p
            style={{
              color: "#0f172a",
              fontSize: "14px",
              marginTop: "5px",
            }}
          >
            {item.serial_number}
          </p>
        </div>
      )}

      {/* Notiz */}
      {item.notes && (
        <div>
          <p
            style={{
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Notiz
          </p>

          <p
            style={{
              color: "#334155",
              fontSize: "14px",
              lineHeight: "1.6",
              marginTop: "5px",
            }}
          >
            {item.notes}
          </p>
        </div>
      )}
    </div>

    {/* Aktionen */}
    <div className="mt-7 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => startEdit(item)}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        ✏️ Bearbeiten
      </button>

      <button
        type="button"
        onClick={() => deactivateEquipment(item)}
        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        Deaktivieren
      </button>
    </div>
  </div>
))}
              </div>
            )}
          </section>

          {/* Formular */}
          <section>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId
                    ? "Sportgerät bearbeiten"
                    : "Sportgerät hinzufügen"}
                </h2>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium text-slate-600"
                  >
                    Abbrechen
                  </button>
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-6"
              >
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Bezeichnung *
                  </label>

                  <input
                    required
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder="z.B. SIG 550"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Kategorie *
                  </label>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  >
                    <option>
                      Armbrust
                    </option>
                    <option>Bogen</option>
                    <option>
                      Gewehr
                    </option>
                    <option>
                      Pistole
                    </option>
                    <option>
                      Andere
                    </option>
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Hersteller
                    </label>

                    <input
                      value={manufacturer}
                      onChange={(event) =>
                        setManufacturer(
                          event.target
                            .value
                        )
                      }
                      placeholder="z.B. SIG"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Modell
                    </label>

                    <input
                      value={model}
                      onChange={(event) =>
                        setModel(
                          event.target
                            .value
                        )
                      }
                      placeholder="z.B. 550"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Seriennummer
                    <span className="ml-1 font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>

                  <input
                    value={serialNumber}
                    onChange={(event) =>
                      setSerialNumber(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                {/* Distanzen */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="font-bold text-slate-900">
                    Distanzen
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Hinterlege die
                    Distanzen, auf denen
                    dieses Sportgerät
                    verwendet wird.
                  </p>

                  <div className="mt-4 flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={
                          distanceInput
                        }
                        onChange={(event) =>
                          setDistanceInput(
                            event.target
                              .value
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();
                            addDistance();
                          }
                        }}
                        placeholder="z.B. 300"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-10 text-slate-900"
                      />

                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        m
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        addDistance
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      + Hinzufügen
                    </button>
                  </div>

                  {distances.length >
                    0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {distances.map(
                        (distance) => (
                          <button
                            key={
                              distance
                            }
                            type="button"
                            onClick={() =>
                              removeDistance(
                                distance
                              )
                            }
                            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                            title="Distanz entfernen"
                          >
                            {distance} m ×
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Stellungen */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="font-bold text-slate-900">
                    Stellungen
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Wähle alle
                    Stellungen, für die
                    dieses Sportgerät
                    verwendet wird.
                  </p>

<div className="mt-4 flex flex-col gap-3">
  {POSITION_OPTIONS.map((option) => {
    const isSelected = positions.includes(option.value);

    return (
      <label
        key={option.value}
        className="flex cursor-pointer items-center gap-3"
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => togglePosition(option.value)}
          style={{
            width: "20px",
            height: "20px",
            accentColor: "#dc2626",
            cursor: "pointer",
          }}
        />

        <span
          style={{
            color: "#0f172a",
            fontWeight: isSelected ? 700 : 500,
          }}
        >
          {option.label}
        </span>
      </label>
    );
  })}
</div>
                </div>

                {/* Iris / Korn */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="font-bold text-slate-900">
                    Visierung
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Optionale
                    Einstellbereiche für
                    Irisblende und Korn.
                  </p>

                  <div className="mt-5">
                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      Irisblende
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs text-slate-500">
                          Minimum
                        </label>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              irisMin
                            }
                            onChange={(
                              event
                            ) =>
                              setIrisMin(
                                event.target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-slate-500">
                          Maximum
                        </label>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              irisMax
                            }
                            onChange={(
                              event
                            ) =>
                              setIrisMax(
                                event.target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      Korn
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs text-slate-500">
                          Minimum
                        </label>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              frontSightMin
                            }
                            onChange={(
                              event
                            ) =>
                              setFrontSightMin(
                                event.target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-slate-500">
                          Maximum
                        </label>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              frontSightMax
                            }
                            onChange={(
                              event
                            ) =>
                              setFrontSightMax(
                                event.target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notiz
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Wird gespeichert..."
                    : editingId
                      ? "Änderungen speichern"
                      : "Sportgerät speichern"}
                </button>

                {message && (
                  <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                    {message}
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}