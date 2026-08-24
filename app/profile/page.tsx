"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { Language, useI18n } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

const copy: Record<Language, Record<string, string>> = {
  de: { loading: "Profil wird geladen...", loadError: "Fehler beim Laden des Profils", duplicate: "Dieser Verein ist bereits eingetragen.", saveError: "Fehler beim Speichern", saved: "Profil wurde gespeichert.", tagline: "Deine Resultate. Deine Entwicklung.", back: "Dashboard", title: "Mein Profil", intro: "Verwalte deine persönlichen Angaben.", email: "E-Mail", emailHelp: "Die E-Mail-Adresse stammt aus deinem Benutzerkonto.", displayName: "Anzeigename", displayPlaceholder: "z.B. Max Muster", language: "Sprache", languageHelp: "Die Auswahl wird in deinem Benutzerprofil gespeichert.", clubs: "Vereine", remove: "Entfernen", clubPlaceholder: "z.B. Schützenverein Muster", add: "+ Hinzufügen", saving: "Wird gespeichert...", save: "Profil speichern" },
  fr: { loading: "Chargement du profil…", loadError: "Erreur lors du chargement du profil", duplicate: "Ce club est déjà enregistré.", saveError: "Erreur lors de l’enregistrement", saved: "Le profil a été enregistré.", tagline: "Tes résultats. Ta progression.", back: "Tableau de bord", title: "Mon profil", intro: "Gère tes informations personnelles.", email: "E-mail", emailHelp: "L’adresse e-mail provient de ton compte utilisateur.", displayName: "Nom affiché", displayPlaceholder: "p. ex. Jean Exemple", language: "Langue", languageHelp: "La sélection est enregistrée dans ton profil utilisateur.", clubs: "Clubs", remove: "Supprimer", clubPlaceholder: "p. ex. Société de tir Exemple", add: "+ Ajouter", saving: "Enregistrement…", save: "Enregistrer le profil" },
  it: { loading: "Caricamento del profilo…", loadError: "Errore durante il caricamento del profilo", duplicate: "Questa società è già registrata.", saveError: "Errore durante il salvataggio", saved: "Il profilo è stato salvato.", tagline: "I tuoi risultati. I tuoi progressi.", back: "Panoramica", title: "Il mio profilo", intro: "Gestisci i tuoi dati personali.", email: "E-mail", emailHelp: "L’indirizzo e-mail proviene dal tuo account utente.", displayName: "Nome visualizzato", displayPlaceholder: "es. Mario Esempio", language: "Lingua", languageHelp: "La selezione viene salvata nel tuo profilo utente.", clubs: "Società", remove: "Rimuovi", clubPlaceholder: "es. Società di tiro Esempio", add: "+ Aggiungi", saving: "Salvataggio…", save: "Salva profilo" },
  en: { loading: "Loading profile…", loadError: "Error loading profile", duplicate: "This club has already been added.", saveError: "Error saving profile", saved: "Profile saved.", tagline: "Your results. Your progress.", back: "Dashboard", title: "My profile", intro: "Manage your personal details.", email: "Email", emailHelp: "The email address comes from your user account.", displayName: "Display name", displayPlaceholder: "e.g. Alex Example", language: "Language", languageHelp: "Your selection is saved in your user profile.", clubs: "Clubs", remove: "Remove", clubPlaceholder: "e.g. Example Shooting Club", add: "+ Add", saving: "Saving…", save: "Save profile" },
};

export default function ProfilePage() {
  const router = useRouter();
  const { language } = useI18n();
  const text = copy[language];
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clubs, setClubs] = useState<string[]>([]);
  const [newClub, setNewClub] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setEmail(user.email ?? "");
    const { data, error } = await supabase.from("profiles").select("display_name, clubs").eq("user_id", user.id).maybeSingle();
    if (error) { setMessage(`${text.loadError}: ${error.message}`); setLoading(false); return; }
    if (data) { setDisplayName(data.display_name ?? ""); setClubs(data.clubs ?? []); }
    setLoading(false);
  })(); }, [router, text]);

  function addClub() { const value = newClub.trim(); if (!value) return; if (clubs.includes(value)) { setMessage(text.duplicate); return; } setClubs((current) => [...current, value]); setNewClub(""); setMessage(""); }
  function removeClub(index: number) { setClubs((current) => current.filter((_, currentIndex) => currentIndex !== index)); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, display_name: displayName.trim() || null, clubs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { setMessage(`${text.saveError}: ${error.message}`); setSaving(false); return; }
    const { error: languageError } = await supabase.auth.updateUser({ data: { language } });
    if (languageError) { setMessage(`${text.saveError}: ${languageError.message}`); setSaving(false); return; }
    setMessage(text.saved); setSaving(false);
  }

  if (loading) return <main data-i18n-explicit className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-slate-600">{text.loading}</p></main>;
  return <main data-i18n-explicit className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><Link href="/dashboard" className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">◎</div><div><p className="font-bold text-slate-900">EasyShooter</p><p className="hidden text-xs text-slate-500 sm:block">{text.tagline}</p></div></Link><Link href="/dashboard" className="text-sm font-medium text-slate-600">← {text.back}</Link></div></header>
    <div className="mx-auto max-w-2xl px-5 py-8"><div className="mb-6"><h1 className="text-3xl font-bold text-slate-900">{text.title}</h1><p className="mt-2 text-slate-600">{text.intro}</p></div><div className="rounded-2xl border bg-white p-6 shadow-sm"><form onSubmit={handleSubmit}>
      <div><label className="mb-2 block text-sm font-medium text-slate-700">{text.email}</label><input type="email" value={email} disabled className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /><p className="mt-1 text-xs text-slate-400">{text.emailHelp}</p></div>
      <div className="mt-5"><label className="mb-2 block text-sm font-medium text-slate-700">{text.displayName}</label><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text.displayPlaceholder} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900" /></div>
      <div className="mt-5"><p className="mb-2 block text-sm font-medium text-slate-700">{text.language}</p><LanguageSwitcher compact /><p className="mt-1 text-xs text-slate-400">{text.languageHelp}</p></div>
      <div className="mt-5"><label className="mb-2 block text-sm font-medium text-slate-700">{text.clubs}</label>{clubs.length > 0 && <div className="mb-3 space-y-2">{clubs.map((club, index) => <div key={`${club}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-sm text-slate-900">{club}</span><button type="button" onClick={() => removeClub(index)} className="text-sm font-medium text-red-600">{text.remove}</button></div>)}</div>}<div className="flex gap-2"><input value={newClub} onChange={(event) => setNewClub(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addClub(); } }} placeholder={text.clubPlaceholder} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900" /><button type="button" onClick={addClub} className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700">{text.add}</button></div></div>
      <button type="submit" disabled={saving} className="mt-6 w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? text.saving : text.save}</button>{message && <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</div>}
    </form></div></div>
  </main>;
}
