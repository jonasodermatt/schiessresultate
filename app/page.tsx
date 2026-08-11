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
                Schiessresultate
              </h1>
              <p className="text-xs text-slate-500">
                Deine Resultate. Deine Entwicklung.
              </p>
            </div>
          </div>

          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Einloggen
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="mb-3 font-semibold text-red-600">
            Schiesssport digital
          </p>

          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Deine Schiessresultate an einem Ort.
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Erfasse deine Resultate, Sportgeräte und Einstellungen.
            Analysiere deine Entwicklung und behalte deine Trainings
            übersichtlich im Blick.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white">
              Kostenlos starten
            </button>

            <button className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700">
              Mehr erfahren
            </button>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">🎯</div>
            <h3 className="font-bold text-slate-900">
              Resultate erfassen
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Einzelschüsse, Totalresultate oder freies Training einfach
              erfassen.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">⚙️</div>
            <h3 className="font-bold text-slate-900">
              Sportgeräte
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Verwalte deine Sportgeräte und deren Konfigurationen wie
              Diopter, Korn und Filter.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 text-3xl">📊</div>
            <h3 className="font-bold text-slate-900">
              Entwicklung
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Behalte Resultate, Durchschnitt und später auch Schussbilder
              und Wetterbedingungen im Blick.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}