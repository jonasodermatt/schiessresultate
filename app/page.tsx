import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl text-white">
              ◎
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                EasyShooter
              </h1>
              <p className="text-xs text-slate-500">
                Deine Resultate. Deine Entwicklung.
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Einloggen
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="mb-3 font-semibold text-red-600">
            Dein digitaler Trainingsbegleiter
          </p>

          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Mehr als nur Resultate.
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Erfasse deine Schiessresultate direkt auf dem Schiessstand,
            dokumentiere deine Treffer und behalte deine persönliche
            Entwicklung im Blick. EasyShooter bringt deine Trainings,
            Sportgeräte und Schussbilder an einem Ort zusammen.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">🎯</div>

            <h3 className="font-bold text-slate-900">
              Training erfassen
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Erfasse einzelne Treffer direkt auf der Scheibe oder trage
              deine Resultate manuell ein – mit fester Schusszahl oder im
              freien Training.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">🔫</div>

            <h3 className="font-bold text-slate-900">
              Deine Sportgeräte
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Verwalte deine Sportgeräte und dokumentiere Einstellungen
              und Konfigurationen übersichtlich an einem Ort.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">📊</div>

            <h3 className="font-bold text-slate-900">
              Entwicklung analysieren
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Vergleiche deine Resultate, analysiere Durchschnitt und
              Schussbilder und berücksichtige die Bedingungen deines
              Trainings.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Bereit für dein nächstes Training?
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Erstelle kostenlos dein EasyShooter-Konto und beginne,
            deine Resultate und deine Entwicklung festzuhalten.
          </p>

          <Link
            href="/register"
            className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-3 font-semibold text-white"
          >
            Jetzt kostenlos registrieren
          </Link>
        </div>
      </section>
    </main>
  );
}