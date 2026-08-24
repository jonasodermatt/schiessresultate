"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import generatedTranslations from "./translations.generated.json";

export const languages = ["de", "fr", "it", "en"] as const;
export type Language = (typeof languages)[number];
export const languageNames: Record<Language, string> = { de: "Deutsch", fr: "Français", it: "Italiano", en: "English" };
const locales: Record<Language, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH", en: "en-GB" };
type Other = Exclude<Language, "de">;

const messages: Record<string, Record<Other, string>> = {
  "Deine Resultate. Deine Entwicklung.": { fr: "Tes résultats. Ta progression.", it: "I tuoi risultati. I tuoi progressi.", en: "Your results. Your progress." },
  "Anmelden": { fr: "Se connecter", it: "Accedi", en: "Sign in" },
  "Abmelden": { fr: "Se déconnecter", it: "Esci", en: "Sign out" },
  "Registrieren": { fr: "S’inscrire", it: "Registrati", en: "Register" },
  "E-Mail": { fr: "E-mail", it: "E-mail", en: "Email" },
  "Passwort": { fr: "Mot de passe", it: "Password", en: "Password" },
  "Dashboard": { fr: "Tableau de bord", it: "Panoramica", en: "Dashboard" },
  "Mein Profil": { fr: "Mon profil", it: "Il mio profilo", en: "My profile" },
  "Profil": { fr: "Profil", it: "Profilo", en: "Profile" },
  "Verwalte deine persönlichen Angaben.": { fr: "Gère tes informations personnelles.", it: "Gestisci i tuoi dati personali.", en: "Manage your personal details." },
  "Anzeigename": { fr: "Nom affiché", it: "Nome visualizzato", en: "Display name" },
  "Sprache": { fr: "Langue", it: "Lingua", en: "Language" },
  "Vereine": { fr: "Clubs", it: "Società", en: "Clubs" },
  "Entfernen": { fr: "Supprimer", it: "Rimuovi", en: "Remove" },
  "+ Hinzufügen": { fr: "+ Ajouter", it: "+ Aggiungi", en: "+ Add" },
  "Profil speichern": { fr: "Enregistrer le profil", it: "Salva profilo", en: "Save profile" },
  "Profil wurde gespeichert.": { fr: "Le profil a été enregistré.", it: "Il profilo è stato salvato.", en: "Profile saved." },
  "Profil wird geladen...": { fr: "Chargement du profil…", it: "Caricamento del profilo…", en: "Loading profile…" },
  "Wird gespeichert...": { fr: "Enregistrement…", it: "Salvataggio…", en: "Saving…" },
  "Resultate": { fr: "Résultats", it: "Risultati", en: "Results" },
  "Resultat": { fr: "Résultat", it: "Risultato", en: "Result" },
  "Neues Resultat": { fr: "Nouveau résultat", it: "Nuovo risultato", en: "New result" },
  "Resultat erfassen": { fr: "Saisir un résultat", it: "Registra risultato", en: "Record result" },
  "Resultat bearbeiten": { fr: "Modifier le résultat", it: "Modifica risultato", en: "Edit result" },
  "Statistik": { fr: "Statistiques", it: "Statistiche", en: "Statistics" },
  "Statistiken": { fr: "Statistiques", it: "Statistiche", en: "Statistics" },
  "Sportgeräte": { fr: "Armes de sport", it: "Armi sportive", en: "Equipment" },
  "Sportgerät": { fr: "Arme de sport", it: "Arma sportiva", en: "Equipment" },
  "Schiessstände": { fr: "Stands de tir", it: "Poligoni", en: "Shooting ranges" },
  "Schiessstand": { fr: "Stand de tir", it: "Poligono", en: "Shooting range" },
  "Disziplin": { fr: "Discipline", it: "Disciplina", en: "Discipline" },
  "Datum und Uhrzeit": { fr: "Date et heure", it: "Data e ora", en: "Date and time" },
  "Datum": { fr: "Date", it: "Data", en: "Date" },
  "Notiz": { fr: "Note", it: "Nota", en: "Note" },
  "Optional": { fr: "Facultatif", it: "Opzionale", en: "Optional" },
  "Speichern": { fr: "Enregistrer", it: "Salva", en: "Save" },
  "Abbrechen": { fr: "Annuler", it: "Annulla", en: "Cancel" },
  "Bearbeiten": { fr: "Modifier", it: "Modifica", en: "Edit" },
  "Löschen": { fr: "Supprimer", it: "Elimina", en: "Delete" },
  "Zurück": { fr: "Retour", it: "Indietro", en: "Back" },
  "Schüsse": { fr: "Coups", it: "Colpi", en: "Shots" },
  "Schuss": { fr: "Coup", it: "Colpo", en: "Shot" },
  "Total": { fr: "Total", it: "Totale", en: "Total" },
  "Durchschnitt": { fr: "Moyenne", it: "Media", en: "Average" },
  "Distanz": { fr: "Distance", it: "Distanza", en: "Distance" },
  "Stellung": { fr: "Position", it: "Posizione", en: "Position" },
  "Name": { fr: "Nom", it: "Nome", en: "Name" },
  "Hersteller": { fr: "Fabricant", it: "Produttore", en: "Manufacturer" },
  "Kaliber": { fr: "Calibre", it: "Calibro", en: "Calibre" },
  "Suchen": { fr: "Rechercher", it: "Cerca", en: "Search" },
  "Willkommen bei EasyShooter": { fr: "Bienvenue sur EasyShooter", it: "Benvenuto su EasyShooter", en: "Welcome to EasyShooter" },
};

const valid = (value: unknown): value is Language => typeof value === "string" && languages.includes(value as Language);
function translate(text: string, language: Language) {
  if (language === "de") return text;
  const direct = messages[text.trim()]?.[language];
  if (direct) return text.replace(text.trim(), direct);
  let result = text;
  Object.entries(messages).sort(([a], [b]) => b.length - a.length).forEach(([source, values]) => { result = result.replaceAll(source, values[language]); });
  return result;
}

type Value = { language: Language; locale: string; ready: boolean; setLanguage: (value: Language) => void; t: (text: string) => string };
const I18nContext = createContext<Value | null>(null);

const authErrors: Record<string, Record<Language, string>> = {
  "Invalid login credentials": { de: "E-Mail-Adresse oder Passwort ist falsch.", fr: "Lâ€™adresse e-mail ou le mot de passe est incorrect.", it: "Lâ€™indirizzo e-mail o la password non Ã¨ corretto.", en: "The email address or password is incorrect." },
  "Email not confirmed": { de: "Bitte bestÃ¤tige zuerst deine E-Mail-Adresse.", fr: "Confirme dâ€™abord ton adresse e-mail.", it: "Conferma prima il tuo indirizzo e-mail.", en: "Please confirm your email address first." },
  "User already registered": { de: "FÃ¼r diese E-Mail-Adresse besteht bereits ein Konto.", fr: "Un compte existe dÃ©jÃ  pour cette adresse e-mail.", it: "Esiste giÃ  un account per questo indirizzo e-mail.", en: "An account already exists for this email address." },
  "Password should be at least 6 characters": { de: "Das Passwort muss mindestens 8 Zeichen lang sein.", fr: "Le mot de passe doit contenir au moins 8 caractÃ¨res.", it: "La password deve contenere almeno 8 caratteri.", en: "The password must be at least 8 characters long." },
  "Email rate limit exceeded": { de: "Zu viele E-Mails wurden angefordert. Bitte versuche es spÃ¤ter erneut.", fr: "Trop dâ€™e-mails ont Ã©tÃ© demandÃ©s. RÃ©essaie plus tard.", it: "Sono state richieste troppe e-mail. Riprova piÃ¹ tardi.", en: "Too many emails were requested. Please try again later." },
  "For security purposes, you can only request this after": { de: "Aus SicherheitsgrÃ¼nden musst du warten, bevor du es erneut versuchen kannst.", fr: "Pour des raisons de sÃ©curitÃ©, attends avant de rÃ©essayer.", it: "Per motivi di sicurezza, attendi prima di riprovare.", en: "For security reasons, please wait before trying again." },
};

export function localizeAuthError(message: string, language: Language) {
  const exact = authErrors[message]?.[language];
  if (exact) return exact;
  const partial = Object.entries(authErrors).find(([source]) => message.includes(source));
  return partial?.[1][language] ?? message;
}
const originalNodes = new WeakMap<Text, string>();
const generated = generatedTranslations as Record<string, Record<Language, string>>;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setCurrent] = useState<Language>("de");
  const [ready, setReady] = useState(false);
  useEffect(() => { void (async () => {
    const cached = localStorage.getItem("easyshooter-language");
    const { data: { user } } = await supabase.auth.getUser();
    const saved = user?.user_metadata?.language;
    setCurrent(valid(saved) ? saved : valid(cached) ? cached : "de"); setReady(true);
  })(); }, []);
  const setLanguage = useCallback((value: Language) => { setCurrent(value); localStorage.setItem("easyshooter-language", value); }, []);
  const t = useCallback((text: string) => translate(text, language), [language]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    const translatedValue = (value: string) => {
      if (language === "de") return value;
      const exact = generated[value]?.[language];
      if (exact) return exact;
      const shotCount = value.match(/^(\d+(?:\s*\/\s*\d+)?)\s+SchÃ¼sse$/);
      if (shotCount) return `${shotCount[1]} ${generated["SchÃ¼sse"]?.[language] ?? "SchÃ¼sse"}`;
      const parts = value.split(/\s*(?:\u00b7|\u00c2\u00b7)\s*/);
      if (parts.length > 1) {
        const mapped = parts.map((part) => generated[part]?.[language] ?? (/^\d+(?:[.,]\d+)?\s*m$/.test(part) ? part : null));
        if (mapped.every(Boolean)) return mapped.join(" \u00b7 ");
      }
      return null;
    };
    const applyTranslations = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        const parent = node.parentElement;
        if (parent && !parent.closest("[data-i18n-explicit]") && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
          let original = originalNodes.get(node) ?? node.data;
          const previous = translatedValue(original.trim());
          if (originalNodes.has(node) && node.data.trim() !== original.trim() && node.data.trim() !== previous) original = node.data;
          originalNodes.set(node, original);
          const trimmed = original.trim();
          const translated = translatedValue(trimmed);
          if (translated) {
            const nextValue = original.replace(trimmed, translated);
            if (node.data !== nextValue) node.data = nextValue;
          }
        }
        node = walker.nextNode() as Text | null;
      }
      const scope = root instanceof Element || root instanceof Document ? root : null;
      scope?.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]").forEach((element) => {
        if (element.closest("[data-i18n-explicit]")) return;
        (["placeholder", "title", "aria-label"] as const).forEach((attribute) => {
          const current = element.getAttribute(attribute); if (!current) return;
          const key = `original${attribute.replace(/(^|-)(.)/g, (_, __, letter: string) => letter.toUpperCase())}`;
          const original = element.dataset[key] ?? current; element.dataset[key] = original;
          const translated = translatedValue(original);
          if (translated && current !== translated) element.setAttribute(attribute, translated);
        });
      });
    };
    applyTranslations(document.body);
    const observer = new MutationObserver((changes) => changes.forEach((change) => {
      change.addedNodes.forEach(applyTranslations);
    }));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo(() => ({ language, locale: locales[language], ready, setLanguage, t }), [language, ready, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { const value = useContext(I18nContext); if (!value) throw new Error("Missing I18nProvider"); return value; }
