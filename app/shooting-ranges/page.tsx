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

type ShootingRange = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  notes: string | null;
  active: boolean;
};

export default function ShootingRangesPage() {
  const router = useRouter();

  const [shootingRanges, setShootingRanges] = useState<
    ShootingRange[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [distanceM, setDistanceM] = useState("");
  const [notes, setNotes] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadShootingRanges = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("shooting_ranges")
     .select(`
  id,
  user_id,
  name,
  address,
  postal_code,
  city,
  latitude,
  longitude,
  distance_m,
  notes,
  active
`)
.eq("active", true)
      .order("name", { ascending: false });

    if (error) {
      setMessage(`Fehler beim Laden: ${error.message}`);
    } else {
      setShootingRanges(data ?? []);
      const { data: favoriteData, error: favoriteError } =
  await supabase
    .from("shooting_range_favorites")
    .select("shooting_range_id")
    .eq("user_id", user.id);

if (favoriteError) {
  setMessage(
    `Fehler beim Laden der Favoriten: ${favoriteError.message}`
  );
} else {
  setFavoriteIds(
    (favoriteData ?? []).map(
      (favorite) => favorite.shooting_range_id
    )
  );
}
    }

    setLoading(false);
  }, [router]);
  async function toggleFavorite(shootingRangeId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    router.replace("/login");
    return;
  }

  const isFavorite = favoriteIds.includes(shootingRangeId);

  if (isFavorite) {
    const { error } = await supabase
      .from("shooting_range_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("shooting_range_id", shootingRangeId);

    if (error) {
      setMessage(
        `Favorit konnte nicht entfernt werden: ${error.message}`
      );
      return;
    }

    setFavoriteIds((current) =>
      current.filter((id) => id !== shootingRangeId)
    );
  } else {
    const { error } = await supabase
      .from("shooting_range_favorites")
      .insert({
        user_id: user.id,
        shooting_range_id: shootingRangeId,
      });

    if (error) {
      setMessage(
        `Favorit konnte nicht gespeichert werden: ${error.message}`
      );
      return;
    }

    setFavoriteIds((current) => [
      ...current,
      shootingRangeId,
    ]);
  }
}
async function deactivateShootingRange(id: string) {
  const confirmed = window.confirm(
    "Möchtest du diesen Schiessstand wirklich deaktivieren?"
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabase
    .from("shooting_ranges")
    .update({
      active: false,
    })
    .eq("id", id);

  if (error) {
    setMessage(
      `Schiessstand konnte nicht deaktiviert werden: ${error.message}`
    );
    return;
  }

  setMessage("Schiessstand wurde deaktiviert.");

  await loadShootingRanges();
}
function startEdit(item: ShootingRange) {
  

  setEditingId(item.id);

  setName(item.name);
  setAddress(item.address ?? "");
  setPostalCode(item.postal_code ?? "");
  setCity(item.city ?? "");
  setLatitude(
    item.latitude !== null ? String(item.latitude) : ""
  );
  setLongitude(
    item.longitude !== null ? String(item.longitude) : ""
  );
  setDistanceM(
    item.distance_m !== null ? String(item.distance_m) : ""
  );
  setNotes(item.notes ?? "");
}
  useEffect(() => {
    loadShootingRanges();
  }, [loadShootingRanges]);
  const filteredShootingRanges = shootingRanges.filter((item) => {
  const search = searchTerm.trim().toLowerCase();

  if (!search) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(search) ||
    (item.city ?? "").toLowerCase().includes(search) ||
    (item.postal_code ?? "").toLowerCase().includes(search) ||
    (item.address ?? "").toLowerCase().includes(search)
  );
});

const favoriteShootingRanges =
  filteredShootingRanges.filter((item) =>
    favoriteIds.includes(item.id)
  );

const otherShootingRanges =
  filteredShootingRanges.filter(
    (item) => !favoriteIds.includes(item.id)
  );
const possibleDuplicates = shootingRanges.filter((item) => {
  if (editingId === item.id) {
    return false;
  }

  const enteredName = name.trim().toLowerCase();
  const enteredCity = city.trim().toLowerCase();
  const enteredPostalCode = postalCode.trim().toLowerCase();

  if (!enteredName) {
    return false;
  }

  const sameName =
    item.name.trim().toLowerCase().includes(enteredName) ||
    enteredName.includes(item.name.trim().toLowerCase());

  const sameCity =
    enteredCity !== "" &&
    (item.city ?? "").trim().toLowerCase() === enteredCity;

  const samePostalCode =
    enteredPostalCode !== "" &&
    (item.postal_code ?? "").trim().toLowerCase() ===
      enteredPostalCode;

  return sameName && (sameCity || samePostalCode);
});
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

 const rangeData = {
  name,
  address: address || null,
  postal_code: postalCode || null,
  city: city || null,
  latitude: latitude !== "" ? Number(latitude) : null,
  longitude: longitude !== "" ? Number(longitude) : null,
  distance_m: distanceM !== "" ? Number(distanceM) : null,
  notes: notes || null,
};

let error = null;

if (editingId !== null) {
  console.log("Schiessstand wird aktualisiert:", editingId);

  const updateResult = await supabase
    .from("shooting_ranges")
    .update(rangeData)
    .eq("id", editingId);

  error = updateResult.error;
} else {
  console.log("Neuer Schiessstand wird erstellt");

  const insertResult = await supabase
    .from("shooting_ranges")
    .insert({
      ...rangeData,
      user_id: user.id,
    });

  error = insertResult.error;
}

    if (error) {
      setMessage(
        `Fehler beim Speichern: ${error.message}`
      );
      setSaving(false);
      return;
    }

const wasEditing = editingId !== null;

setName("");
setAddress("");
setPostalCode("");
setCity("");
setLatitude("");
setLongitude("");
setDistanceM("");
setNotes("");

setEditingId(null);

setMessage(
  wasEditing
    ? "Schiessstand wurde aktualisiert."
    : "Schiessstand wurde gespeichert."
);

await loadShootingRanges();
setSaving(false);
}


// HIER KOMMT DIE NEUE FUNKTION

function renderShootingRange(item: ShootingRange) {
  return (
    <div
      key={item.id}
      className="rounded-2xl border bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-lg font-bold text-slate-900">
          {item.name}
        </p>

        <button
          type="button"
          onClick={() => toggleFavorite(item.id)}
          className="text-2xl leading-none"
          title={
            favoriteIds.includes(item.id)
              ? "Favorit entfernen"
              : "Als Favorit speichern"
          }
        >
          {favoriteIds.includes(item.id) ? "★" : "☆"}
        </button>
      </div>

      {(item.address || item.postal_code || item.city) && (
        <p className="mt-2 text-sm text-slate-700">
          {item.address && (
            <>
              {item.address}
              <br />
            </>
          )}

          {[item.postal_code, item.city]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}

      {item.distance_m !== null && (
        <p className="mt-3 text-sm text-slate-600">
          Distanz: {item.distance_m} m
        </p>
      )}

      {item.latitude !== null &&
        item.longitude !== null && (
          <p className="mt-2 text-xs text-slate-500">
            Koordinaten: {item.latitude}, {item.longitude}
          </p>
        )}

      {item.notes && (
        <p className="mt-3 text-sm text-slate-600">
          {item.notes}
        </p>
      )}

      <div
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <button
          type="button"
          onClick={() => startEdit(item)}
          style={{
            backgroundColor: "white",
            color: "#0f172a",
            border: "1px solid #94a3b8",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          ✏️ Bearbeiten
        </button>
        <button
  type="button"
  onClick={() => deactivateShootingRange(item.id)}
  style={{
    backgroundColor: "white",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    marginLeft: "8px",
  }}
>
  Deaktivieren
</button>
      </div>
    </div>
  );
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
  Schiessstände
</h1>

        <p className="mt-2 text-slate-600">
  Verwalte und nutze gemeinsam verfügbare Schiessstände.
</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
  Verfügbare Schiessstände
</h2>
<div className="mb-5">
  <label
    htmlFor="shooting-range-search"
    className="sr-only"
  >
    Schiessstand suchen
  </label>

  <input
    id="shooting-range-search"
    type="search"
    value={searchTerm}
    onChange={(event) =>
      setSearchTerm(event.target.value)
    }
    placeholder="🔍 Name, Ort oder PLZ suchen..."
    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
  />
</div>

            {loading ? (
              <p className="text-slate-500">
                Wird geladen...
              </p>
            ) : shootingRanges.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                <div className="mb-3 text-4xl">🎯</div>

                <p className="font-semibold text-slate-900">
  Noch keine Schiessstände vorhanden
</p>

<p className="mt-2 text-sm text-slate-500">
  Erfasse den ersten Schiessstand.
</p>
              </div>
            ) : (
              <div className="space-y-4">
               <div>
  {favoriteShootingRanges.length > 0 && (
    <div className="mb-8">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">
        ★ Meine Favoriten
      </h3>

      <div className="space-y-4">
        {favoriteShootingRanges.map((item) =>
          renderShootingRange(item)
        )}
      </div>
    </div>
   
  )}
 
  <div>
    <h3 className="mb-3 text-lg font-semibold text-slate-900">
      Alle Schiessstände
    </h3>

    {otherShootingRanges.length > 0 ? (
      <div className="space-y-4">
        {otherShootingRanges.map((item) =>
          renderShootingRange(item)
        )}
      </div>
    ) : (
      <p className="text-sm text-slate-500">
        Keine weiteren Schiessstände gefunden.
      </p>
    )}
  </div>
</div>
</div>
            )}
          </section>

          <section>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
  {editingId
    ? "Schiessstand bearbeiten"
    : "Schiessstand hinzufügen"}
</h2>
{editingId && (
  <p className="mt-2 text-sm text-slate-500">
    Bearbeitungsmodus aktiv
  </p>
)}
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
                      setName(event.target.value)
                    }
                    placeholder="z.B. Schiessanlage Muster"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Adresse
                  </label>

                  <input
                    value={address}
                    onChange={(event) =>
                      setAddress(event.target.value)
                    }
                    placeholder="Strasse und Hausnummer"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      PLZ
                    </label>

                    <input
                      value={postalCode}
                      onChange={(event) =>
                        setPostalCode(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Ort
                    </label>

                    <input
                      value={city}
                      onChange={(event) =>
                        setCity(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>
                </div>
                {possibleDuplicates.length > 0 && (
  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <p className="text-sm font-medium text-slate-900">
      ⚠️ Möglicherweise bereits vorhanden
    </p>

    <div className="mt-2 space-y-2">
      {possibleDuplicates.map((item) => (
        <div key={item.id} className="text-sm text-slate-700">
          {item.name}
          {item.postal_code || item.city ? " · " : ""}
          {[item.postal_code, item.city]
            .filter(Boolean)
            .join(" ")}
        </div>
      ))}
    </div>
  </div>
)}
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Distanz
                    <span className="ml-1 font-normal text-slate-400">
                      (Meter)
                    </span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={distanceM}
                    onChange={(event) =>
                      setDistanceM(event.target.value)
                    }
                    placeholder="z.B. 300"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Breitengrad
                    </label>

                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(event) =>
                        setLatitude(event.target.value)
                      }
                      placeholder="z.B. 47.3769"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Längengrad
                    </label>

                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(event) =>
                        setLongitude(event.target.value)
                      }
                      placeholder="z.B. 8.5417"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notiz
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
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
    : "Schiessstand speichern"}
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