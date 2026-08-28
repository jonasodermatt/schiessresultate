"use client";

import Target, { type TargetType } from "./Target";

type ShotPoint = {
  id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

type ShotDistributionChartProps = {
  shots: ShotPoint[];
  targetType: TargetType;
  title?: string;
  projectileDiameterMm?: number;
};

type TargetScale = {
  targetSizeMm: number | null;
  ringWidthMm: number | null;
};

function getTargetScale(targetType: TargetType): TargetScale {
  if (targetType === "crossbow30m") {
    return { targetSizeMm: 200, ringWidthMm: 6 };
  }

  if (targetType === "crossbow10m" || targetType === "rifle10m") {
    return { targetSizeMm: 100, ringWidthMm: 2.5 };
  }

  if (targetType === "rifle50m") {
    return { targetSizeMm: 165, ringWidthMm: 8 };
  }

  if (targetType === "rifle300m") {
    return { targetSizeMm: 1500, ringWidthMm: 50 };
  }

  return { targetSizeMm: null, ringWidthMm: null };
}

export default function ShotDistributionChart({
  shots,
  targetType,
  title,
  projectileDiameterMm,
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
      (sum, shot) => sum + Number(shot.x_position),
      0
    ) / positionedShots.length;

  const averageY =
    positionedShots.reduce(
      (sum, shot) => sum + Number(shot.y_position),
      0
    ) / positionedShots.length;

  const averageDistance =
    positionedShots.reduce((sum, shot) => {
      const dx = Number(shot.x_position) - averageX;
      const dy = Number(shot.y_position) - averageY;

      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / positionedShots.length;

  const { targetSizeMm, ringWidthMm } = getTargetScale(targetType);

  const averageXmm =
    targetSizeMm !== null
      ? averageX * (targetSizeMm / 2)
      : null;

  const averageYmm =
    targetSizeMm !== null
      ? averageY * (targetSizeMm / 2)
      : null;

  const averageDistanceMm =
    targetSizeMm !== null
      ? averageDistance * (targetSizeMm / 2)
      : null;

  function describeAxis(
    normalizedValue: number,
    millimeterValue: number | null,
    negative: string,
    positive: string
  ) {
    const direction =
      normalizedValue < 0 ? negative : positive;

    if (
      millimeterValue !== null &&
      ringWidthMm !== null
    ) {
      const rings = Math.abs(millimeterValue) / ringWidthMm;

      if (rings <= 0.33) return "Mitte";
      if (rings <= 1) return `leicht ${direction}`;
      if (rings <= 2) return direction;
      return `deutlich ${direction}`;
    }

    const absolute = Math.abs(normalizedValue);

    if (absolute <= 0.02) return "Mitte";
    if (absolute <= 0.08) return `leicht ${direction}`;
    if (absolute <= 0.16) return direction;
    return `deutlich ${direction}`;
  }

  const horizontalPosition = describeAxis(
    averageX,
    averageXmm,
    "links",
    "rechts"
  );

  const verticalPosition = describeAxis(
    averageY,
    averageYmm,
    "tief",
    "hoch"
  );

  function describeSpread(
    normalizedDistance: number,
    millimeterDistance: number | null
  ) {
    if (
      millimeterDistance !== null &&
      ringWidthMm !== null
    ) {
      const rings = millimeterDistance / ringWidthMm;

      if (rings <= 0.5) return "Sehr eng";
      if (rings <= 1) return "Eng";
      if (rings <= 2) return "Mittel";
      return "Breit";
    }

    if (normalizedDistance <= 0.05) return "Sehr eng";
    if (normalizedDistance <= 0.1) return "Eng";
    if (normalizedDistance <= 0.18) return "Mittel";
    return "Breit";
  }

  const spreadLabel = describeSpread(
    averageDistance,
    averageDistanceMm
  );

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {title ? `Trefferlage · ${title}` : "Trefferlage"}
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          Treffer der aktuell gefilterten Resultate auf der passenden Scheibe.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Target
          selectedX={null}
          selectedY={null}
          selectedScore={null}
          targetType={targetType}
          projectileDiameterMm={projectileDiameterMm}
          readOnly
          shots={positionedShots}
        />
      </div>

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

          {averageXmm !== null && averageYmm !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Ø x {averageXmm.toFixed(1)} mm · y {averageYmm.toFixed(1)} mm
            </p>
          )}
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
            {averageDistanceMm !== null
              ? `${averageDistanceMm.toFixed(1)} mm`
              : averageDistance.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
}
