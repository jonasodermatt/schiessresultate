"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Shooter = {
  id: string;
  first_name: string;
  last_name: string;
  birth_year: number | null;
};

type Registration = {
  id: string;
  shooter_id: string;
  start_number: number | null;
};

type Group = {
  id: string;
  shooting_event_id: string;
  name: string;
  max_members: number | null;
  active: boolean;
};

type GroupMember = {
  id: string;
  group_id: string;
  registration_id: string;
  sort_order: number;
};

type Stitch = {
  id: string;
  name: string;
  sort_order: number;
};

export default function ShootingEventGroupsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [groupRankingStitchId, setGroupRankingStitchId] = useState("");

  const [newName, setNewName] = useState("");
  const [newMaxMembers, setNewMaxMembers] = useState("4");

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxMembers, setEditMaxMembers] = useState("4");

  const [selectedRegistrationByGroup, setSelectedRegistrationByGroup] =
    useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadGroups() {
    const { data, error } = await supabase
      .from("shooting_event_groups")
      .select("id, shooting_event_id, name, max_members, active")
      .eq("shooting_event_id", eventId)
      .eq("active", true)
      .order("name");

    if (error) throw new Error(error.message);
    setGroups((data ?? []) as Group[]);
  }

  async function loadMembers(groupIds?: string[]) {
    let ids = groupIds;

    if (!ids) {
      const { data, error } = await supabase
        .from("shooting_event_groups")
        .select("id")
        .eq("shooting_event_id", eventId);

      if (error) throw new Error(error.message);
      ids = (data ?? []).map((item) => item.id);
    }

    if (ids.length === 0) {
      setMembers([]);
      return;
    }

    const { data, error } = await supabase
      .from("shooting_event_group_members")
      .select("id, group_id, registration_id, sort_order")
      .in("group_id", ids)
      .order("sort_order");

    if (error) throw new Error(error.message);
    setMembers((data ?? []) as GroupMember[]);
  }

  async function loadParticipants() {
    const { data: registrationData, error: registrationError } = await supabase
      .from("shooting_event_registrations")
      .select("id, shooter_id, start_number")
      .eq("shooting_event_id", eventId);

    if (registrationError) throw new Error(registrationError.message);

    const loadedRegistrations = (registrationData ?? []) as Registration[];
    setRegistrations(loadedRegistrations);

    const shooterIds = Array.from(
      new Set(loadedRegistrations.map((item) => item.shooter_id))
    );

    if (shooterIds.length === 0) {
      setShooters([]);
      return;
    }

    const { data: shooterData, error: shooterError } = await supabase
      .from("shooters")
      .select("id, first_name, last_name, birth_year")
      .in("id", shooterIds);

    if (shooterError) throw new Error(shooterError.message);
    setShooters((shooterData ?? []) as Shooter[]);
  }

  async function refreshGroupsAndMembers() {
    const { data, error } = await supabase
      .from("shooting_event_groups")
      .select("id, shooting_event_id, name, max_members, active")
      .eq("shooting_event_id", eventId)
      .eq("active", true)
      .order("name");

    if (error) throw new Error(error.message);

    const loadedGroups = (data ?? []) as Group[];
    setGroups(loadedGroups);
    await loadMembers(loadedGroups.map((group) => group.id));
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

      setLoading(true);
      setMessage("");

      try {
        const { data: eventData, error: eventError } = await supabase
          .from("shooting_events")
          .select("id, name, group_ranking_stitch_id")
          .eq("owner_id", user.id)
          .eq("id", eventId)
          .single();

        if (eventError || !eventData) {
          throw new Error(eventError?.message ?? "Schiessanlass nicht gefunden.");
        }

        setEventName(eventData.name);
        setGroupRankingStitchId(
          eventData.group_ranking_stitch_id ?? ""
        );

        const { data: stitchData, error: stitchError } = await supabase
          .from("shooting_event_stitches")
          .select("id, name, sort_order")
          .eq("shooting_event_id", eventId)
          .eq("active", true)
          .order("sort_order");

        if (stitchError) {
          throw new Error(stitchError.message);
        }

        setStitches((stitchData ?? []) as Stitch[]);

        await Promise.all([loadGroups(), loadParticipants()]);

        const { data: groupIdData, error: groupIdError } = await supabase
          .from("shooting_event_groups")
          .select("id")
          .eq("shooting_event_id", eventId);

        if (groupIdError) throw new Error(groupIdError.message);

        await loadMembers((groupIdData ?? []).map((item) => item.id));
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unbekannter Fehler."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [eventId, router]);

  const shooterById = useMemo(
    () => new Map(shooters.map((shooter) => [shooter.id, shooter])),
    [shooters]
  );

  const registrationById = useMemo(
    () =>
      new Map(
        registrations.map((registration) => [registration.id, registration])
      ),
    [registrations]
  );

  const usedRegistrationIds = useMemo(
    () => new Set(members.map((member) => member.registration_id)),
    [members]
  );

  function groupMembers(groupId: string) {
    return members
      .filter((member) => member.group_id === groupId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function availableRegistrations(groupId: string) {
    const ownMemberIds = new Set(
      groupMembers(groupId).map((member) => member.registration_id)
    );

    return [...registrations]
      .filter(
        (registration) =>
          !usedRegistrationIds.has(registration.id) ||
          ownMemberIds.has(registration.id)
      )
      .filter((registration) => !ownMemberIds.has(registration.id))
      .sort(
        (a, b) =>
          (a.start_number ?? 999999) - (b.start_number ?? 999999)
      );
  }

  async function saveGroupRankingStitch(stitchId: string) {
    setGroupRankingStitchId(stitchId);
    setSaving(true);
    setMessage("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Bitte erneut anmelden.");

      const { error } = await supabase
        .from("shooting_events")
        .update({
          group_ranking_stitch_id: stitchId || null,
        })
        .eq("owner_id", user.id)
        .eq("id", eventId)
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      setMessage(
        stitchId
          ? "Wertungsstich für die Gruppenrangliste gespeichert."
          : "Wertungsstich für die Gruppenrangliste entfernt."
      );
    } catch (error) {
      setMessage(
        `Wertungsstich konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newName.trim();
    const maxMembers = Number(newMaxMembers);

    if (!name) {
      setMessage("Bitte einen Gruppennamen erfassen.");
      return;
    }

    if (!Number.isInteger(maxMembers) || maxMembers < 1) {
      setMessage("Die Gruppengrösse muss mindestens 1 sein.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("shooting_event_groups").insert({
        shooting_event_id: eventId,
        name,
        max_members: maxMembers,
        active: true,
      });

      if (error) throw new Error(error.message);

      setNewName("");
      setNewMaxMembers("4");
      await refreshGroupsAndMembers();
      setMessage("Gruppe erstellt.");
    } catch (error) {
      setMessage(
        `Gruppe konnte nicht erstellt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(group: Group) {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditMaxMembers(String(group.max_members ?? 4));
    setMessage("");
  }

  function cancelEdit() {
    setEditingGroupId(null);
    setEditName("");
    setEditMaxMembers("4");
  }

  async function saveGroup(group: Group) {
    const name = editName.trim();
    const maxMembers = Number(editMaxMembers);
    const memberCount = groupMembers(group.id).length;

    if (!name) {
      setMessage("Bitte einen Gruppennamen erfassen.");
      return;
    }

    if (!Number.isInteger(maxMembers) || maxMembers < 1) {
      setMessage("Die Gruppengrösse muss mindestens 1 sein.");
      return;
    }

    if (maxMembers < memberCount) {
      setMessage(
        `Die Gruppe hat bereits ${memberCount} Mitglieder. Die maximale Gruppengrösse kann nicht darunter gesetzt werden.`
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_groups")
        .update({
          name,
          max_members: maxMembers,
        })
        .eq("id", group.id);

      if (error) throw new Error(error.message);

      await refreshGroupsAndMembers();
      cancelEdit();
      setMessage("Gruppe gespeichert.");
    } catch (error) {
      setMessage(
        `Gruppe konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(group: Group) {
    if (
      !window.confirm(
        `Gruppe "${group.name}" löschen? Die Gruppenzuteilungen werden ebenfalls entfernt. Resultate der Schützen bleiben erhalten.`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_groups")
        .delete()
        .eq("id", group.id);

      if (error) throw new Error(error.message);

      await refreshGroupsAndMembers();
      setMessage("Gruppe gelöscht.");
    } catch (error) {
      setMessage(
        `Gruppe konnte nicht gelöscht werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function addMember(group: Group) {
    const registrationId = selectedRegistrationByGroup[group.id] ?? "";

    if (!registrationId) {
      setMessage("Bitte einen Teilnehmer auswählen.");
      return;
    }

    const currentMembers = groupMembers(group.id);
    const maxMembers = group.max_members ?? 4;

    if (currentMembers.length >= maxMembers) {
      setMessage(`Die Gruppe "${group.name}" ist bereits voll.`);
      return;
    }

    if (usedRegistrationIds.has(registrationId)) {
      setMessage("Dieser Teilnehmer ist bereits einer Gruppe zugeteilt.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const nextSortOrder =
        currentMembers.length === 0
          ? 1
          : Math.max(...currentMembers.map((member) => member.sort_order)) + 1;

      const { error } = await supabase
        .from("shooting_event_group_members")
        .insert({
          group_id: group.id,
          registration_id: registrationId,
          sort_order: nextSortOrder,
        });

      if (error) throw new Error(error.message);

      setSelectedRegistrationByGroup((current) => ({
        ...current,
        [group.id]: "",
      }));

      await loadMembers(groups.map((item) => item.id));
      setMessage("Teilnehmer zur Gruppe hinzugefügt.");
    } catch (error) {
      setMessage(
        `Teilnehmer konnte nicht hinzugefügt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member: GroupMember) {
    const registration = registrationById.get(member.registration_id);
    const shooter = registration
      ? shooterById.get(registration.shooter_id)
      : undefined;

    const label = shooter
      ? `${shooter.first_name} ${shooter.last_name}`
      : "Teilnehmer";

    if (!window.confirm(`${label} aus der Gruppe entfernen?`)) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_group_members")
        .delete()
        .eq("id", member.id);

      if (error) throw new Error(error.message);

      await loadMembers(groups.map((item) => item.id));
      setMessage("Teilnehmer aus der Gruppe entfernt.");
    } catch (error) {
      setMessage(
        `Teilnehmer konnte nicht entfernt werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Gruppen werden geladen...</p>
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

          <Link
            href={`/shooting-events/${eventId}`}
            className="text-sm text-slate-600"
          >
            ← Anlass
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div>
          <p className="text-sm font-semibold text-red-600">{eventName}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Gruppen</h1>
          <p className="mt-2 text-slate-600">
            Gruppen erstellen und Teilnehmer des Schiessanlasses zuteilen.
          </p>
        </div>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Gruppenrangliste
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Wähle den Stich, dessen Resultate für die Gruppenrangliste zählen.
          </p>

          <div className="mt-5">
            <label className="form-label">
              Wertungsstich
            </label>

            <select
              value={groupRankingStitchId}
              onChange={(event) =>
                void saveGroupRankingStitch(event.target.value)
              }
              disabled={saving}
              className="form-select"
            >
              <option value="">
                Kein Wertungsstich
              </option>

              {stitches.map((stitch) => (
                <option
                  key={stitch.id}
                  value={stitch.id}
                >
                  {stitch.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <form
          onSubmit={createGroup}
          className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-900">Neue Gruppe</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div>
              <label className="form-label">Gruppenname</label>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="form-input"
                placeholder="z. B. Gruppe 1"
              />
            </div>

            <div>
              <label className="form-label">Max. Mitglieder</label>
              <input
                type="number"
                min="1"
                value={newMaxMembers}
                onChange={(event) => setNewMaxMembers(event.target.value)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              Gruppe erstellen
            </button>
          </div>
        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">
              Noch keine Gruppen vorhanden.
            </div>
          ) : (
            groups.map((group) => {
              const currentMembers = groupMembers(group.id);
              const maxMembers = group.max_members ?? 4;
              const available = availableRegistrations(group.id);
              const editing = editingGroupId === group.id;

              return (
                <section
                  key={group.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      {editing ? (
                        <div className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_160px]">
                          <div>
                            <label className="form-label">Gruppenname</label>
                            <input
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                              className="form-input"
                            />
                          </div>

                          <div>
                            <label className="form-label">
                              Max. Mitglieder
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editMaxMembers}
                              onChange={(event) =>
                                setEditMaxMembers(event.target.value)
                              }
                              className="form-input"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-xl font-bold text-slate-900">
                            {group.name}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            {currentMembers.length} / {maxMembers} Mitglieder
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveGroup(group)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Speichern
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(group)}
                            className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void deleteGroup(group)}
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            Löschen
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500">
                          <th className="py-2 pr-4">SB</th>
                          <th className="py-2 pr-4">Schütze</th>
                          <th className="py-2 pr-4">Jg.</th>
                          <th className="py-2 text-right">Aktion</th>
                        </tr>
                      </thead>

                      <tbody>
                        {currentMembers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-5 text-center text-slate-500"
                            >
                              Noch keine Mitglieder zugeteilt.
                            </td>
                          </tr>
                        ) : (
                          currentMembers.map((member) => {
                            const registration = registrationById.get(
                              member.registration_id
                            );
                            const shooter = registration
                              ? shooterById.get(registration.shooter_id)
                              : undefined;

                            return (
                              <tr
                                key={member.id}
                                className="border-b border-slate-100"
                              >
                                <td className="py-3 pr-4 font-semibold">
                                  {registration?.start_number ?? "–"}
                                </td>
                                <td className="py-3 pr-4 font-medium text-slate-900">
                                  {shooter
                                    ? `${shooter.last_name} ${shooter.first_name}`
                                    : "Unbekannter Schütze"}
                                </td>
                                <td className="py-3 pr-4">
                                  {shooter?.birth_year ?? "–"}
                                </td>
                                <td className="py-3 text-right">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void removeMember(member)}
                                    className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700"
                                  >
                                    Entfernen
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 border-t pt-5">
                    {currentMembers.length >= maxMembers ? (
                      <p className="text-sm font-semibold text-green-700">
                        Gruppe vollständig.
                      </p>
                    ) : available.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Keine weiteren freien Teilnehmer vorhanden.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div>
                          <label className="form-label">
                            Teilnehmer hinzufügen
                          </label>
                          <select
                            value={
                              selectedRegistrationByGroup[group.id] ?? ""
                            }
                            onChange={(event) =>
                              setSelectedRegistrationByGroup((current) => ({
                                ...current,
                                [group.id]: event.target.value,
                              }))
                            }
                            className="form-select"
                          >
                            <option value="">
                              Teilnehmer auswählen...
                            </option>

                            {available.map((registration) => {
                              const shooter = shooterById.get(
                                registration.shooter_id
                              );

                              if (!shooter) return null;

                              return (
                                <option
                                  key={registration.id}
                                  value={registration.id}
                                >
                                  SB {registration.start_number ?? "–"} ·{" "}
                                  {shooter.last_name} {shooter.first_name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void addMember(group)}
                          className="btn-primary"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
