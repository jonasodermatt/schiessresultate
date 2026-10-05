"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Club = {
  id: string;
  name: string;
  city: string | null;
};

type Shooter = {
  id: string;
  first_name: string;
  last_name: string;
  birth_year: number | null;
  club_id: string | null;
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

type ParticipantRow = {
  registration: Registration;
  shooter: Shooter;
};

export default function ShootingEventParticipantsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allShooters, setAllShooters] = useState<Shooter[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);

  const [search, setSearch] = useState("");
  const [existingShooterId, setExistingShooterId] = useState("");
  const [existingWeaponId, setExistingWeaponId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newClubId, setNewClubId] = useState("");
  const [newWeaponId, setNewWeaponId] = useState("");

  const [editingShooterId, setEditingShooterId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editClubId, setEditClubId] = useState("");
  const [editWeaponId, setEditWeaponId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadParticipants() {
    const { data, error } = await supabase
      .from("shooting_event_registrations")
      .select("id, shooter_id, weapon_id, start_number")
      .eq("shooting_event_id", eventId);

    if (error) throw new Error(error.message);
    setRegistrations((data ?? []) as Registration[]);
  }

  async function loadShooters() {
    const { data, error } = await supabase
      .from("shooters")
      .select("id, first_name, last_name, birth_year, club_id")
      .eq("active", true)
      .order("last_name")
      .order("first_name");

    if (error) throw new Error(error.message);
    setAllShooters((data ?? []) as Shooter[]);
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const [
          { data: eventData, error: eventError },
          { data: weaponData, error: weaponError },
          { data: clubData, error: clubError },
        ] = await Promise.all([
          supabase.from("shooting_events").select("id, name").eq("id", eventId).single(),
          supabase.from("competition_weapons").select("id, name").eq("active", true).order("name"),
          supabase.from("clubs").select("id, name, city").order("name"),
        ]);

        if (eventError || !eventData) {
          throw new Error(eventError?.message ?? "Schiessanlass nicht gefunden.");
        }
        if (weaponError) throw new Error(weaponError.message);
        if (clubError) throw new Error(clubError.message);

        setEventName(eventData.name);
        setWeapons((weaponData ?? []) as Weapon[]);
        setClubs((clubData ?? []) as Club[]);

        await Promise.all([loadParticipants(), loadShooters()]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unbekannter Fehler.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventId, router]);

  const shooterById = useMemo(
    () => new Map(allShooters.map((shooter) => [shooter.id, shooter])),
    [allShooters]
  );

  const weaponById = useMemo(
    () => new Map(weapons.map((weapon) => [weapon.id, weapon])),
    [weapons]
  );

  const clubById = useMemo(
    () => new Map(clubs.map((club) => [club.id, club])),
    [clubs]
  );

  const participants = useMemo<ParticipantRow[]>(() => {
    return registrations
      .map((registration) => {
        const shooter = shooterById.get(registration.shooter_id);
        return shooter ? { registration, shooter } : null;
      })
      .filter((row): row is ParticipantRow => row !== null)
      .sort(
        (a, b) =>
          (a.registration.start_number ?? 999999) -
          (b.registration.start_number ?? 999999)
      );
  }, [registrations, shooterById]);

  const registeredShooterIds = useMemo(
    () => new Set(registrations.map((item) => item.shooter_id)),
    [registrations]
  );

  const availableShooters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allShooters
      .filter((shooter) => !registeredShooterIds.has(shooter.id))
      .filter((shooter) => {
        if (!query) return true;
        return (
          shooter.first_name.toLowerCase().includes(query) ||
          shooter.last_name.toLowerCase().includes(query)
        );
      })
      .slice(0, 50);
  }, [allShooters, registeredShooterIds, search]);

  async function getNextStartNumber() {
    const { data, error } = await supabase
      .from("shooting_event_registrations")
      .select("start_number")
      .eq("shooting_event_id", eventId)
      .not("start_number", "is", null)
      .order("start_number", { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    return data && data.length > 0 ? Number(data[0].start_number) + 1 : 1;
  }

  async function loadLastWeapon(shooterId: string) {
    const { data, error } = await supabase
      .from("shooting_event_registrations")
      .select("weapon_id, shooting_event_id, shooting_events(event_date)")
      .eq("shooter_id", shooterId)
      .neq("shooting_event_id", eventId);

    if (error) {
      setExistingWeaponId("");
      return;
    }

    const rows = (data ?? []) as Array<{
      weapon_id: string | null;
      shooting_event_id: string;
      shooting_events: { event_date: string } | { event_date: string }[] | null;
    }>;

    rows.sort((a, b) => {
      const aEvent = Array.isArray(a.shooting_events) ? a.shooting_events[0] : a.shooting_events;
      const bEvent = Array.isArray(b.shooting_events) ? b.shooting_events[0] : b.shooting_events;
      return (bEvent?.event_date ?? "").localeCompare(aEvent?.event_date ?? "");
    });

    setExistingWeaponId(rows[0]?.weapon_id ?? "");
  }

  async function selectExistingShooter(shooterId: string) {
    setExistingShooterId(shooterId);
    setExistingWeaponId("");
    if (shooterId) await loadLastWeapon(shooterId);
  }

  async function addExistingShooter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!existingShooterId) {
      setMessage("Bitte einen bestehenden Schützen auswählen.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const startNumber = await getNextStartNumber();

      const { error } = await supabase.from("shooting_event_registrations").insert({
        shooting_event_id: eventId,
        shooter_id: existingShooterId,
        weapon_id: existingWeaponId || null,
        start_number: startNumber,
      });

      if (error) throw new Error(error.message);

      setExistingShooterId("");
      setExistingWeaponId("");
      setSearch("");
      await loadParticipants();
      setMessage(`Teilnehmer mit SB ${startNumber} hinzugefügt.`);
    } catch (error) {
      setMessage(
        `Teilnehmer konnte nicht hinzugefügt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function addNewShooter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setMessage("Bitte Vorname und Nachname erfassen.");
      return;
    }

    if (
      birthYear &&
      (!Number.isInteger(Number(birthYear)) ||
        Number(birthYear) < 1900 ||
        Number(birthYear) > new Date().getFullYear())
    ) {
      setMessage("Bitte einen gültigen Jahrgang erfassen.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: shooter, error: shooterError } = await supabase
        .from("shooters")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_year: birthYear ? Number(birthYear) : null,
          club_id: newClubId || null,
        })
        .select("id, first_name, last_name, birth_year, club_id")
        .single();

      if (shooterError || !shooter) {
        throw new Error(shooterError?.message ?? "Schütze konnte nicht erstellt werden.");
      }

      const startNumber = await getNextStartNumber();

      const { error: registrationError } = await supabase
        .from("shooting_event_registrations")
        .insert({
          shooting_event_id: eventId,
          shooter_id: shooter.id,
          weapon_id: newWeaponId || null,
          start_number: startNumber,
        });

      if (registrationError) throw new Error(registrationError.message);

      setFirstName("");
      setLastName("");
      setBirthYear("");
      setNewClubId("");
      setNewWeaponId("");

      await Promise.all([loadShooters(), loadParticipants()]);
      setMessage(`Schütze erstellt und mit SB ${startNumber} angemeldet.`);
    } catch (error) {
      setMessage(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler."}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: ParticipantRow) {
    setEditingShooterId(row.shooter.id);
    setEditFirstName(row.shooter.first_name);
    setEditLastName(row.shooter.last_name);
    setEditBirthYear(row.shooter.birth_year !== null ? String(row.shooter.birth_year) : "");
    setEditClubId(row.shooter.club_id ?? "");
    setEditWeaponId(row.registration.weapon_id ?? "");
    setMessage("");
  }

  function cancelEdit() {
    setEditingShooterId(null);
    setEditFirstName("");
    setEditLastName("");
    setEditBirthYear("");
    setEditClubId("");
    setEditWeaponId("");
  }

  async function saveEdit(row: ParticipantRow) {
    if (!editFirstName.trim() || !editLastName.trim()) {
      setMessage("Vorname und Nachname dürfen nicht leer sein.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const shooterUpdate = await supabase
        .from("shooters")
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          birth_year: editBirthYear ? Number(editBirthYear) : null,
          club_id: editClubId || null,
        })
        .eq("id", row.shooter.id);

      if (shooterUpdate.error) throw new Error(shooterUpdate.error.message);

      const registrationUpdate = await supabase
        .from("shooting_event_registrations")
        .update({ weapon_id: editWeaponId || null })
        .eq("id", row.registration.id);

      if (registrationUpdate.error) throw new Error(registrationUpdate.error.message);

      await Promise.all([loadShooters(), loadParticipants()]);
      cancelEdit();
      setMessage("Teilnehmer gespeichert.");
    } catch (error) {
      setMessage(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler."}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteParticipant(row: ParticipantRow) {
    const name = `${row.shooter.first_name} ${row.shooter.last_name}`;

    if (!window.confirm(`Teilnehmer "${name}" aus diesem Anlass entfernen?`)) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: registrationStitches, error: stitchError } = await supabase
        .from("shooting_event_registration_stitches")
        .select("id")
        .eq("registration_id", row.registration.id);

      if (stitchError) throw new Error(stitchError.message);

      const ids = (registrationStitches ?? []).map((item) => item.id);

      if (ids.length > 0) {
        const { data: passes, error: passError } = await supabase
          .from("shooting_event_stitch_passes")
          .select("id")
          .in("registration_stitch_id", ids)
          .limit(1);

        if (passError) throw new Error(passError.message);

        if ((passes ?? []).length > 0) {
          setMessage(
            `${name} kann nicht gelöscht werden, weil bereits Schiessresultate/Passen erfasst wurden.`
          );
          setSaving(false);
          return;
        }
      }

      const { error: deleteError } = await supabase
        .from("shooting_event_registrations")
        .delete()
        .eq("id", row.registration.id);

      if (deleteError) throw new Error(deleteError.message);

      await loadParticipants();
      setMessage(`${name} wurde aus dem Anlass entfernt.`);
    } catch (error) {
      setMessage(`Löschen fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler."}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Teilnehmer werden geladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="font-bold text-slate-900">
            EasyShooter
          </Link>
          <Link href={`/shooting-events/${eventId}`} className="text-sm text-slate-600">
            ← Anlass
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">{eventName}</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Teilnehmer</h1>
            <p className="mt-2 text-slate-600">
              SB-Nummer pro Anlass, Verein aus dem Schützenstamm und Standard-Sportgerät verwalten.
            </p>
          </div>

          <Link
            href={`/shooting-events/${eventId}/registration`}
            className="inline-flex rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
          >
            Zur Anmeldung
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={addExistingShooter} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Bestehenden Schützen hinzufügen</h2>
            <p className="mt-1 text-sm text-slate-500">
              Das zuletzt verwendete Standard-Sportgerät wird automatisch vorgeschlagen.
            </p>

            <div className="mt-5">
              <label className="form-label">Suche</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="form-input"
                placeholder="Vorname oder Nachname"
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Schütze</label>
              <select
                value={existingShooterId}
                onChange={(event) => void selectExistingShooter(event.target.value)}
                className="form-select"
              >
                <option value="">Schütze auswählen...</option>
                {availableShooters.map((shooter) => (
                  <option key={shooter.id} value={shooter.id}>
                    {shooter.last_name} {shooter.first_name}
                    {shooter.birth_year ? ` · ${shooter.birth_year}` : ""}
                    {shooter.club_id ? ` · ${clubById.get(shooter.club_id)?.name ?? ""}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="form-label">Standard-Sportgerät</label>
              <select
                value={existingWeaponId}
                onChange={(event) => setExistingWeaponId(event.target.value)}
                className="form-select"
              >
                <option value="">Kein Sportgerät</option>
                {weapons.map((weapon) => (
                  <option key={weapon.id} value={weapon.id}>{weapon.name}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={saving} className="btn-primary mt-6 w-full">
              Teilnehmer hinzufügen
            </button>
          </form>

          <form onSubmit={addNewShooter} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Neuer Schütze</h2>
            <p className="mt-1 text-sm text-slate-500">
              Der Schütze wird im Stamm angelegt und erhält für diesen Anlass die nächste freie SB-Nummer.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Vorname</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Nachname</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Jahrgang</label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Verein</label>
                <select value={newClubId} onChange={(e) => setNewClubId(e.target.value)} className="form-select">
                  <option value="">Kein Verein</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}{club.city ? ` · ${club.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Standard-Sportgerät</label>
                <select value={newWeaponId} onChange={(e) => setNewWeaponId(e.target.value)} className="form-select">
                  <option value="">Kein Sportgerät</option>
                  {weapons.map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>{weapon.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary mt-6 w-full">
              Schütze erstellen und anmelden
            </button>
          </form>
        </div>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{message}</div>
        )}

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Teilnehmerliste</h2>
            <p className="mt-1 text-sm text-slate-500">{participants.length} Teilnehmer</p>
          </div>

          {participants.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-6 text-slate-500">
              Noch keine Teilnehmer vorhanden.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">SB</th>
                    <th className="py-2 pr-4">Schütze</th>
                    <th className="py-2 pr-4">Jg.</th>
                    <th className="py-2 pr-4">Verein</th>
                    <th className="py-2 pr-4">Sportgerät</th>
                    <th className="py-2 text-right">Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {participants.map((row) => {
                    const editing = editingShooterId === row.shooter.id;

                    return (
                      <tr key={row.registration.id} className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-4 font-semibold">{row.registration.start_number ?? "–"}</td>

                        <td className="py-3 pr-4">
                          {editing ? (
                            <div className="grid min-w-72 grid-cols-2 gap-2">
                              <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="form-input" />
                              <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="form-input" />
                            </div>
                          ) : (
                            <span className="font-medium text-slate-900">
                              {row.shooter.last_name} {row.shooter.first_name}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          {editing ? (
                            <input type="number" value={editBirthYear} onChange={(e) => setEditBirthYear(e.target.value)} className="form-input w-28" />
                          ) : row.shooter.birth_year ?? "–"}
                        </td>

                        <td className="py-3 pr-4">
                          {editing ? (
                            <select value={editClubId} onChange={(e) => setEditClubId(e.target.value)} className="form-select min-w-56">
                              <option value="">Kein Verein</option>
                              {clubs.map((club) => (
                                <option key={club.id} value={club.id}>{club.name}</option>
                              ))}
                            </select>
                          ) : row.shooter.club_id ? clubById.get(row.shooter.club_id)?.name ?? "–" : "–"}
                        </td>

                        <td className="py-3 pr-4">
                          {editing ? (
                            <select value={editWeaponId} onChange={(e) => setEditWeaponId(e.target.value)} className="form-select min-w-48">
                              <option value="">Kein Sportgerät</option>
                              {weapons.map((weapon) => (
                                <option key={weapon.id} value={weapon.id}>{weapon.name}</option>
                              ))}
                            </select>
                          ) : row.registration.weapon_id ? weaponById.get(row.registration.weapon_id)?.name ?? "–" : "–"}
                        </td>

                        <td className="py-3 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={cancelEdit} className="rounded-lg border px-3 py-2 font-semibold text-slate-700">
                                Abbrechen
                              </button>
                              <button type="button" onClick={() => void saveEdit(row)} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">
                                Speichern
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/shooting-events/${eventId}/registration?registrationId=${row.registration.id}`}
                                className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700"
                              >
                                Anmelden
                              </Link>

                              <button type="button" onClick={() => startEdit(row)} className="rounded-lg border px-3 py-2 font-semibold text-slate-700">
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteParticipant(row)}
                                disabled={saving}
                                className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700"
                              >
                                Löschen
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
