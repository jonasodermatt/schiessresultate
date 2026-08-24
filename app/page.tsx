"use client";

import Link from "next/link";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Language, useI18n } from "../lib/i18n";

const copy: Record<Language, Record<string, string>> = {
  de: {
    tagline: "Deine Resultate. Deine Entwicklung.", login: "Einloggen", eyebrow: "Dein digitaler Trainingsbegleiter",
    title: "Mehr als nur Resultate.", intro: "Erfasse deine Schiessresultate direkt auf dem Schiessstand, dokumentiere deine Treffer und behalte deine persönliche Entwicklung im Blick. EasyShooter bringt deine Trainings, Sportgeräte und Schussbilder an einem Ort zusammen.",
    start: "Kostenlos starten", recordTitle: "Training erfassen", recordText: "Erfasse einzelne Treffer direkt auf der Scheibe oder trage deine Resultate manuell ein – mit fester Schusszahl oder im freien Training.",
    equipmentTitle: "Deine Sportgeräte", equipmentText: "Verwalte deine Sportgeräte und dokumentiere Einstellungen und Konfigurationen übersichtlich an einem Ort.",
    analyseTitle: "Entwicklung analysieren", analyseText: "Vergleiche deine Resultate, analysiere Durchschnitt und Schussbilder und berücksichtige die Bedingungen deines Trainings.",
    ready: "Bereit für dein nächstes Training?", account: "Erstelle kostenlos dein EasyShooter-Konto und beginne, deine Resultate und deine Entwicklung festzuhalten.", register: "Jetzt kostenlos registrieren",
  },
  fr: {
    tagline: "Tes résultats. Ta progression.", login: "Se connecter", eyebrow: "Ton compagnon d’entraînement numérique",
    title: "Bien plus que des résultats.", intro: "Saisis tes résultats directement au stand de tir, documente tes impacts et suis ta progression personnelle. EasyShooter rassemble tes entraînements, tes armes de sport et tes groupements en un seul endroit.",
    start: "Commencer gratuitement", recordTitle: "Saisir l’entraînement", recordText: "Saisis chaque impact directement sur la cible ou entre tes résultats manuellement – avec un nombre de coups fixe ou en entraînement libre.",
    equipmentTitle: "Tes armes de sport", equipmentText: "Gère tes armes de sport et documente clairement leurs réglages et configurations en un seul endroit.",
    analyseTitle: "Analyser ta progression", analyseText: "Compare tes résultats, analyse les moyennes et les groupements, et tiens compte des conditions d’entraînement.",
    ready: "Prêt pour ton prochain entraînement ?", account: "Crée gratuitement ton compte EasyShooter et commence à suivre tes résultats et ta progression.", register: "S’inscrire gratuitement",
  },
  it: {
    tagline: "I tuoi risultati. I tuoi progressi.", login: "Accedi", eyebrow: "Il tuo compagno digitale di allenamento",
    title: "Molto più di semplici risultati.", intro: "Registra i risultati direttamente al poligono, documenta i colpi e segui i tuoi progressi personali. EasyShooter riunisce allenamenti, armi sportive e rosate in un unico posto.",
    start: "Inizia gratis", recordTitle: "Registra allenamento", recordText: "Registra ogni colpo direttamente sul bersaglio o inserisci i risultati manualmente, con un numero fisso di colpi o in allenamento libero.",
    equipmentTitle: "Le tue armi sportive", equipmentText: "Gestisci le tue armi sportive e documenta impostazioni e configurazioni in modo chiaro in un unico posto.",
    analyseTitle: "Analizza i progressi", analyseText: "Confronta i risultati, analizza medie e rosate e considera le condizioni del tuo allenamento.",
    ready: "Pronto per il prossimo allenamento?", account: "Crea gratuitamente il tuo account EasyShooter e inizia a registrare risultati e progressi.", register: "Registrati gratis",
  },
  en: {
    tagline: "Your results. Your progress.", login: "Sign in", eyebrow: "Your digital training companion",
    title: "More than just results.", intro: "Record your shooting results right at the range, document every hit and keep track of your personal progress. EasyShooter brings your training sessions, equipment and shot groups together in one place.",
    start: "Start for free", recordTitle: "Record training", recordText: "Record individual hits directly on the target or enter your results manually – with a fixed number of shots or during free training.",
    equipmentTitle: "Your equipment", equipmentText: "Manage your sporting equipment and keep its settings and configurations clearly documented in one place.",
    analyseTitle: "Analyse your progress", analyseText: "Compare results, analyse averages and shot groups, and take your training conditions into account.",
    ready: "Ready for your next training session?", account: "Create your free EasyShooter account and start tracking your results and progress.", register: "Register for free",
  },
};

export default function Home() {
  const { language } = useI18n();
  const text = copy[language];
  return <main data-i18n-explicit className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">◎</div><div><h1 className="text-xl font-bold text-slate-900">EasyShooter</h1><p className="text-xs text-slate-500">{text.tagline}</p></div></div>
      <div className="flex items-center gap-3"><LanguageSwitcher compact /><Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">{text.login}</Link></div>
    </div></header>
    <section className="mx-auto max-w-6xl px-6 py-20"><div className="max-w-2xl"><p className="mb-3 font-semibold text-red-600">{text.eyebrow}</p><h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">{text.title}</h2><p className="mt-6 text-lg leading-8 text-slate-600">{text.intro}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white">{text.start}</Link></div></div>
      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {[["🎯", text.recordTitle, text.recordText], ["🔫", text.equipmentTitle, text.equipmentText], ["📊", text.analyseTitle, text.analyseText]].map(([icon, title, body]) => <div key={title} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-4 text-3xl">{icon}</div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}
      </div>
      <div className="mt-16 rounded-2xl border bg-white p-8 text-center shadow-sm"><h2 className="text-2xl font-bold text-slate-900">{text.ready}</h2><p className="mx-auto mt-3 max-w-xl text-slate-600">{text.account}</p><Link href="/register" className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-3 font-semibold text-white">{text.register}</Link></div>
    </section>
  </main>;
}
