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
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  notes: string | null;
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
      .select(
        "id, name, address, postal_code, city, latitude, longitude, distance_m, notes"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Fehler beim Laden: ${error.message}`);
    } else {
      setShootingRanges(data ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadShootingRanges();
  }, [loadShootingRanges]);

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

    const { error } = await supabase
      .from("shooting_ranges")
      .insert({
        user_id: user.id,
        name,
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        latitude:
          latitude !== "" ? Number(latitude) : null,
        longitude:
          longitude !== "" ? Number(longitude) : null,
        distance_m:
          distanceM !== "" ? Number(distanceM) : null,
        notes: notes || null,
      });

    if (error) {
      setMessage(
        `Fehler beim Speichern: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setName("");
    setAddress("");
    setPostalCode("");
    setCity("");
    setLatitude("");
    setLongitude("");
    setDistanceM("");
    setNotes("");

    setMessage("Schiessstand wurde gespeichert.");

    await loadShootingRanges();
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            ◎ Schiessresultate
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
            Meine Schiessstände
          </h1>

          <p className="mt-2 text-slate-600">
            Verwalte deine Schiessstände und deren
            Standortdaten.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Meine Schiessstände
            </h2>

            {loading ? (
              <p className="text-slate-500">
                Wird geladen...
              </p>
            ) : shootingRanges.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                <div className="mb-3 text-4xl">🎯</div>

                <p className="font-semibold text-slate-900">
                  Noch keine Schiessstände
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Erfasse rechts deinen ersten
                  Schiessstand.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {shootingRanges.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <p className="text-lg font-bold text-slate-900">
                      {item.name}
                    </p>

                    {(item.address ||
                      item.postal_code ||
                      item.city) && (
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
                          Koordinaten: {item.latitude},{" "}
                          {item.longitude}
                        </p>
                      )}

                    {item.notes && (
                      <p className="mt-3 text-sm text-slate-600">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Schiessstand hinzufügen
              </h2>

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