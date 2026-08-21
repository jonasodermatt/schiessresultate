"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Equipment = {
  id: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  notes: string | null;
};

export default function EquipmentPage() {
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Gewehr");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

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
      .select(
        "id, name, category, manufacturer, model, serial_number, notes"
      )
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Fehler beim Laden: ${error.message}`);
    } else {
      setEquipment(data ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);
  function startEdit(item: Equipment) {
  setEditingId(item.id);

  setName(item.name);
  setCategory(item.category || "Gewehr");
  setManufacturer(item.manufacturer ?? "");
  setModel(item.model ?? "");
  setSerialNumber(item.serial_number ?? "");
  setNotes(item.notes ?? "");

  setMessage("");
}
async function deactivateEquipment(item: Equipment) {
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

  // Falls gerade dieses Sportgerät bearbeitet wird
  if (editingId === item.id) {
    setEditingId(null);
    setName("");
    setCategory("Gewehr");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setNotes("");
  }

  setMessage(`"${item.name}" wurde deaktiviert.`);

  await loadEquipment();
}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    let error;

if (editingId) {
  const { error: updateError } = await supabase
    .from("equipment")
    .update({
      name,
      category,
      manufacturer: manufacturer || null,
      model: model || null,
      serial_number: serialNumber || null,
      notes: notes || null,
    })
    .eq("id", editingId)
    .eq("user_id", user.id);

  error = updateError;
} else {
  const { error: insertError } = await supabase
    .from("equipment")
    .insert({
      user_id: user.id,
      name,
      category,
      manufacturer: manufacturer || null,
      model: model || null,
      serial_number: serialNumber || null,
      notes: notes || null,
      active: true,
    });

  error = insertError;
}

    if (error) {
      setMessage(`Fehler beim Speichern: ${error.message}`);
      setSaving(false);
      return;
    }
       setMessage(
  editingId
    ? "Sportgerät wurde aktualisiert."
    : "Sportgerät wurde gespeichert."
);

    setName("");
    setCategory("Gewehr");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setNotes("");
    setEditingId(null);


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
          Deine Resultate. Deine Entwicklung.
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
            Verwalte deine Gewehre, Pistolen und weitere Sportgeräte.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Meine Sportgeräte
            </h2>

            {loading ? (
              <p className="text-slate-500">Wird geladen...</p>
            ) : equipment.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                <div className="mb-3 text-4xl">🔫</div>

                <p className="font-semibold text-slate-900">
                  Noch keine Sportgeräte
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Erfasse rechts dein erstes Sportgerät.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {item.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.category}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Aktiv
                      </span>
                    </div>

                    {(item.manufacturer || item.model) && (
                      <p className="mt-4 text-sm text-slate-700">
                        {[item.manufacturer, item.model]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}

                    {item.serial_number && (
                      <p className="mt-2 text-xs text-slate-500">
                        Seriennummer: {item.serial_number}
                      </p>
                    )}

                    {item.notes && (
                      <p className="mt-3 text-sm text-slate-600">
                        {item.notes}
                      </p>
                    )}

               <div className="mt-5 flex gap-4 border-t pt-4">
  <button
    type="button"
    onClick={() => startEdit(item)}
    className="text-sm font-semibold text-slate-700"
  >
    ✏️ Bearbeiten
  </button>

  <button
    type="button"
    onClick={() => deactivateEquipment(item)}
    className="text-sm font-semibold text-red-600"
  >
    🗑️ Löschen
  </button>
</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Sportgerät hinzufügen
              </h2>

              <form onSubmit={handleSubmit} className="mt-6">
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Bezeichnung *
                  </label>

                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
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
  onChange={(event) => setCategory(event.target.value)}
  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
>
<option>Armbrust</option>
  <option>Bogen</option>
  <option>Gewehr</option>
  <option>Pistole</option>
  
  <option>Andere</option>
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
                        setManufacturer(event.target.value)
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
                      onChange={(event) => setModel(event.target.value)}
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
                      setSerialNumber(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notiz
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
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