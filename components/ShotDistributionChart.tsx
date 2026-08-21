"use client";

type ShotPoint = {
  id: string;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

type ShotDistributionChartProps = {
  shots: ShotPoint[];
};

export default function ShotDistributionChart({
  shots,
}: ShotDistributionChartProps) {
  const positionedShots = shots.filter(
    (shot) =>
      shot.x_position !== null &&
      shot.y_position !== null
  );

  if (positionedShots.length === 0) {
    return null;
  }

  const averageX =
    positionedShots.reduce(
      (sum, shot) =>
        sum + Number(shot.x_position),
      0
    ) / positionedShots.length;

  const averageY =
    positionedShots.reduce(
      (sum, shot) =>
        sum + Number(shot.y_position),
      0
    ) / positionedShots.length;

  const averageDistance =
    positionedShots.reduce((sum, shot) => {
      const dx =
        Number(shot.x_position) - averageX;

      const dy =
        Number(shot.y_position) - averageY;

      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / positionedShots.length;

  function describeAxis(
    value: number,
    negative: string,
    positive: string
  ) {
    const absolute = Math.abs(value);

    if (absolute <= 0.02) {
      return "Mitte";
    }

    const direction =
      value < 0 ? negative : positive;

    if (absolute <= 0.08) {
      return `leicht ${direction}`;
    }

    if (absolute <= 0.16) {
      return direction;
    }

    return `deutlich ${direction}`;
  }

  const horizontalPosition = describeAxis(
    averageX,
    "links",
    "rechts"
  );

  const verticalPosition = describeAxis(
    averageY,
    "tief",
    "hoch"
  );

  function describeSpread(distance: number) {
    if (distance <= 0.05) {
      return "Sehr eng";
    }

    if (distance <= 0.1) {
      return "Eng";
    }

    if (distance <= 0.18) {
      return "Mittel";
    }

    return "Breit";
  }

  const spreadLabel =
    describeSpread(averageDistance);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Trefferlage
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          Alle Treffer der aktuell gefilterten Resultate.
        </p>
      </div>

      {/* Scheibe */}
      <div
        style={{
          position: "relative",
          width: "320px",
          height: "320px",
          margin: "24px auto 0",
          borderRadius: "50%",
          backgroundColor: "white",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      >
        {/* Dunkler Bereich */}
        <div
          style={{
            position: "absolute",
            width: "72%",
            height: "72%",
            left: "14%",
            top: "14%",
            borderRadius: "50%",
            backgroundColor: "#1e293b",
          }}
        />

        {/* Ringlinien */}
        {[9, 18, 27, 36, 45, 54, 63, 72, 81].map(
          (diameter) => (
            <div
              key={diameter}
              style={{
                position: "absolute",
                width: `${diameter}%`,
                height: `${diameter}%`,
                left: `${(100 - diameter) / 2}%`,
                top: `${(100 - diameter) / 2}%`,
                border: "1px solid #64748b",
                borderRadius: "50%",
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />
          )
        )}

        {/* Äußere Grenze */}
        <div
          style={{
            position: "absolute",
            width: "90%",
            height: "90%",
            left: "5%",
            top: "5%",
            border: "4px solid black",
            borderRadius: "50%",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />

        {/* Treffer */}
        {positionedShots.map((shot) => (
          <div
            key={shot.id}
            title={`${shot.score} Punkte`}
            style={{
              position: "absolute",
              left: `${
                (((shot.x_position ?? 0) + 1) / 2) *
                100
              }%`,
              top: `${
                ((1 - (shot.y_position ?? 0)) / 2) *
                100
              }%`,
              width: "10px",
              height: "10px",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              backgroundColor: "#dc2626",
              border: "1px solid white",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Streuungskreis */}
        <div
          title="Durchschnittliche Streuung"
          style={{
            position: "absolute",
            left: `${((averageX + 1) / 2) * 100}%`,
            top: `${((1 - averageY) / 2) * 100}%`,
            width: `${averageDistance * 100}%`,
            height: `${averageDistance * 100}%`,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "2px dashed #facc15",
            backgroundColor:
              "rgba(250, 204, 21, 0.08)",
            zIndex: 15,
            pointerEvents: "none",
          }}
        />

        {/* Mittlere Trefferlage */}
        <div
          title="Mittlere Trefferlage"
          style={{
            position: "absolute",
            left: `${((averageX + 1) / 2) * 100}%`,
            top: `${((1 - averageY) / 2) * 100}%`,
            width: "20px",
            height: "20px",
            transform: "translate(-50%, -50%)",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "9px",
              top: "0",
              width: "2px",
              height: "20px",
              backgroundColor: "#facc15",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: "0",
              top: "9px",
              width: "20px",
              height: "2px",
              backgroundColor: "#facc15",
            }}
          />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Treffer
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {positionedShots.length}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Mittlere Trefferlage
          </p>

          <p className="mt-1 text-lg font-bold text-slate-900">
            {horizontalPosition}
            {" / "}
            {verticalPosition}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Streuung
          </p>

          <p className="mt-1 text-lg font-bold text-slate-900">
            {spreadLabel}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Ø Abstand{" "}
            {averageDistance.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
}