"use client";

import { useState } from "react";

type TargetShot = {
  id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

export type TargetType =
  | "default"
  | "crossbow30m"
  | "crossbow10m"
  | "rifle10m"
  | "rifle50m"
  | "rifle300m";

type TargetProps = {
  selectedX: number | null;
  selectedY: number | null;
  selectedScore: number | null;
  onSelect?: (
    x: number,
    y: number,
    score: number
  ) => void;
  readOnly?: boolean;
  shots?: TargetShot[];
  targetType?: TargetType;
  projectileDiameterMm?: number;
};

type CrossbowTargetDefinition = {
  targetSizeMm: number;
  scoringDiameterMm: number;
  blackDiameterMm: number;
  tenDiameterMm: number;
  ringWidthMm: number;
  lineWidthMm: number;
  projectileDiameterMm: number;
};

export const CROSSBOW_30M_TARGET: CrossbowTargetDefinition = {
  targetSizeMm: 200,
  scoringDiameterMm: 114,
  blackDiameterMm: 90,
  tenDiameterMm: 6,
  ringWidthMm: 6,
  lineWidthMm: 0.15,
  projectileDiameterMm: 6,
};

export const CROSSBOW_10M_TARGET: CrossbowTargetDefinition = {
  targetSizeMm: 100,
  scoringDiameterMm: 45.5,
  blackDiameterMm: 30.5,
  tenDiameterMm: 0.5,
  ringWidthMm: 2.5,
  lineWidthMm: 0.15,
  projectileDiameterMm: 4.5,
};

export const RIFLE_10M_TARGET: CrossbowTargetDefinition = {
  targetSizeMm: 100,
  scoringDiameterMm: 45.5,
  blackDiameterMm: 30.5,
  tenDiameterMm: 0.5,
  ringWidthMm: 2.5,
  lineWidthMm: 0.15,
  projectileDiameterMm: 4.5,
};

export const RIFLE_50M_TARGET: CrossbowTargetDefinition = {
  targetSizeMm: 165,
  scoringDiameterMm: 154.4,
  blackDiameterMm: 112.4,
  tenDiameterMm: 10.4,
  ringWidthMm: 8,
  lineWidthMm: 0.15,
  projectileDiameterMm: 5.6,
};

export const RIFLE_300M_TARGET: CrossbowTargetDefinition = {
  targetSizeMm: 1500,
  scoringDiameterMm: 1000,
  blackDiameterMm: 600,
  tenDiameterMm: 100,
  ringWidthMm: 50,
  lineWidthMm: 0.15,
  // 300 m ist kaliberabhängig. 5.6 mm ist nur der Fallback;
  // über projectileDiameterMm kann 7.5 oder bis 8.0 mm übergeben werden.
  projectileDiameterMm: 5.6,
};

function scoreDefaultTarget(
  x: number,
  y: number
) {
  const distance = Math.sqrt(x * x + y * y);

  if (distance <= 0.09) return 10;
  if (distance <= 0.18) return 9;
  if (distance <= 0.27) return 8;
  if (distance <= 0.36) return 7;
  if (distance <= 0.45) return 6;
  if (distance <= 0.54) return 5;
  if (distance <= 0.63) return 4;
  if (distance <= 0.72) return 3;
  if (distance <= 0.81) return 2;
  if (distance <= 0.9) return 1;

  return 0;
}

function normalizedToMillimeters(
  definition: CrossbowTargetDefinition,
  x: number,
  y: number
) {
  const halfSize = definition.targetSizeMm / 2;

  return {
    xMm: x * halfSize,
    yMm: y * halfSize,
  };
}

function scoreCrossbowTarget(
  definition: CrossbowTargetDefinition,
  x: number,
  y: number
) {
  const { xMm, yMm } =
    normalizedToMillimeters(definition, x, y);

  const centerDistanceMm = Math.sqrt(
    xMm * xMm + yMm * yMm
  );

  const projectileRadiusMm =
    definition.projectileDiameterMm / 2;

  const effectiveDistanceMm = Math.max(
    0,
    centerDistanceMm - projectileRadiusMm
  );

  const tenRadiusMm =
    definition.tenDiameterMm / 2;

  if (effectiveDistanceMm <= tenRadiusMm) {
    return 10;
  }

  for (let score = 9; score >= 1; score--) {
    const ringRadiusMm =
      tenRadiusMm +
      (10 - score) *
        definition.ringWidthMm;

    if (effectiveDistanceMm <= ringRadiusMm) {
      return score;
    }
  }

  return 0;
}

export function scoreCrossbow30m(
  x: number,
  y: number
) {
  return scoreCrossbowTarget(
    CROSSBOW_30M_TARGET,
    x,
    y
  );
}

export function scoreCrossbow10m(
  x: number,
  y: number
) {
  return scoreCrossbowTarget(
    CROSSBOW_10M_TARGET,
    x,
    y
  );
}

export function scoreRifle10m(
  x: number,
  y: number
) {
  return scoreCrossbowTarget(
    RIFLE_10M_TARGET,
    x,
    y
  );
}

export function scoreRifle50m(
  x: number,
  y: number
) {
  return scoreCrossbowTarget(
    RIFLE_50M_TARGET,
    x,
    y
  );
}

export function scoreRifle300m(
  x: number,
  y: number,
  projectileDiameterMm = 5.6
) {
  return scoreCrossbowTarget(
    {
      ...RIFLE_300M_TARGET,
      projectileDiameterMm,
    },
    x,
    y
  );
}

/*
 * Armbrust 10 m Mouche:
 * Das Schussloch darf den 9er-Kreis von innen nicht berühren.
 *
 * 9er-Radius: 2.75 mm
 * Pfeilradius: 2.25 mm
 * => Mittelpunkt muss weniger als 0.50 mm vom Zentrum entfernt sein.
 */
export function isCrossbow10mMouche(
  x: number,
  y: number
) {
  const { xMm, yMm } =
    normalizedToMillimeters(
      CROSSBOW_10M_TARGET,
      x,
      y
    );

  const centerDistanceMm = Math.sqrt(
    xMm * xMm + yMm * yMm
  );

  return centerDistanceMm < 0.5;
}

function getScore(
  targetType: TargetType,
  x: number,
  y: number,
  projectileDiameterMm?: number
) {
  if (targetType === "crossbow10m") {
    return scoreCrossbow10m(x, y);
  }

  if (targetType === "crossbow30m") {
    return scoreCrossbow30m(x, y);
  }

  if (targetType === "rifle10m") {
    return scoreRifle10m(x, y);
  }

  if (targetType === "rifle50m") {
    return scoreRifle50m(x, y);
  }

  if (targetType === "rifle300m") {
    return scoreRifle300m(
      x,
      y,
      projectileDiameterMm ?? 5.6
    );
  }

  return scoreDefaultTarget(x, y);
}

function getZoomScale(
  targetType: TargetType,
  zoomLevel: number
) {
  const marginFactor = 1.1;

  if (targetType !== "default") {
    const definition =
      targetType === "crossbow10m"
        ? CROSSBOW_10M_TARGET
        : targetType === "crossbow30m"
          ? CROSSBOW_30M_TARGET
          : targetType === "rifle10m"
            ? RIFLE_10M_TARGET
            : targetType === "rifle50m"
              ? RIFLE_50M_TARGET
              : RIFLE_300M_TARGET;

    const tenRadiusMm =
      definition.tenDiameterMm / 2;

    const diameterForScore = (
      score: number
    ) => {
      if (score === 10) {
        return definition.tenDiameterMm;
      }

      const radiusMm =
        tenRadiusMm +
        (10 - score) *
          definition.ringWidthMm;

      return radiusMm * 2;
    };

    const visibleDiameterMm =
      zoomLevel === 1
        ? definition.scoringDiameterMm
        : zoomLevel === 2
          ? diameterForScore(6)
          : zoomLevel === 3
            ? diameterForScore(8)
            : zoomLevel === 4
              ? diameterForScore(9)
              : diameterForScore(10);

    return (
      definition.targetSizeMm /
      visibleDiameterMm /
      marginFactor
    );
  }

  const visibleFraction =
    zoomLevel === 1
      ? 0.9
      : zoomLevel === 2
        ? 0.45
        : zoomLevel === 3
          ? 0.27
          : zoomLevel === 4
            ? 0.18
            : 0.09;

  return 1 / visibleFraction / marginFactor;
}

export default function Target({
  selectedX,
  selectedY,
  selectedScore,
  onSelect,
  readOnly = false,
  shots = [],
  targetType = "default",
  projectileDiameterMm,
}: TargetProps) {
  const [zoomLevel, setZoomLevel] =
    useState(1);

  const viewportSize = 300;
  const zoomScale = getZoomScale(
    targetType,
    zoomLevel
  );

  function changeZoomLevel(nextLevel: number) {
    setZoomLevel(
      Math.max(1, Math.min(5, nextLevel))
    );
  }

  function handleTargetClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (readOnly) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const mouseX =
      event.clientX - rect.left;
    const mouseY =
      event.clientY - rect.top;

    const x =
      (mouseX / rect.width) * 2 - 1;

    const y =
      -((mouseY / rect.height) * 2 - 1);

    const score = getScore(
      targetType,
      x,
      y,
      projectileDiameterMm
    );

    onSelect?.(
      Number(x.toFixed(4)),
      Number(y.toFixed(4)),
      score
    );
  }

  function renderDefaultTarget() {
    return (
      <>
        <div
          style={{
            position: "absolute",
            width: "72%",
            height: "72%",
            left: "14%",
            top: "14%",
            borderRadius: "50%",
            backgroundColor: "#1e293b",
            pointerEvents: "none",
          }}
        />

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

        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform:
              `translate(-50%, -50%) scale(${1 / zoomScale})`,
            transformOrigin: "center",
            color: "white",
            fontSize: "11px",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          10
        </span>

        {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(
          (score, index) => {
            const radiusPercent =
              6.75 + index * 4.5;

            return (
              <span
                key={score}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: `${
                    50 - radiusPercent
                  }%`,
                  transform:
                    `translate(-50%, -50%) scale(${1 / zoomScale})`,
                  transformOrigin: "center",
                  color:
                    score >= 3
                      ? "white"
                      : "#334155",
                  fontSize: "11px",
                  fontWeight: "bold",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                {score}
              </span>
            );
          }
        )}
      </>
    );
  }

  function renderCrossbowTarget(
    definition: CrossbowTargetDefinition
  ) {
    const mmToPercent = (mm: number) =>
      (mm / definition.targetSizeMm) * 100;

    const blackDiameterPercent =
      mmToPercent(
        definition.blackDiameterMm
      );

    const tenRadiusMm =
      definition.tenDiameterMm / 2;

    const ringDiametersMm = Array.from(
      { length: 10 },
      (_, index) => {
        const score = 10 - index;
        const radius =
          tenRadiusMm +
          (10 - score) *
            definition.ringWidthMm;

        return {
          score,
          diameterMm: radius * 2,
        };
      }
    );

    const lineWidthPx = Math.max(
      0.45,
      (definition.lineWidthMm /
        definition.targetSizeMm) *
        viewportSize
    );

    return (
      <>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#ffffff",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: `${blackDiameterPercent}%`,
            height: `${blackDiameterPercent}%`,
            left: `${
              (100 - blackDiameterPercent) / 2
            }%`,
            top: `${
              (100 - blackDiameterPercent) / 2
            }%`,
            borderRadius: "50%",
            backgroundColor: "#111827",
            pointerEvents: "none",
          }}
        />

        {ringDiametersMm.map(
          ({ score, diameterMm }) => {
            const diameterPercent =
              mmToPercent(diameterMm);

            const lineColor =
              diameterMm <=
              definition.blackDiameterMm
                ? "#f8fafc"
                : "#111827";

            return (
              <div
                key={score}
                style={{
                  position: "absolute",
                  width: `${diameterPercent}%`,
                  height: `${diameterPercent}%`,
                  left: `${
                    (100 - diameterPercent) / 2
                  }%`,
                  top: `${
                    (100 - diameterPercent) / 2
                  }%`,
                  border: `${lineWidthPx}px solid ${lineColor}`,
                  borderRadius: "50%",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            );
          }
        )}

        {ringDiametersMm.map(
          ({ score, diameterMm }) => {
            const radiusMm =
              diameterMm / 2;

            const previousRadiusMm =
              score === 10
                ? 0
                : radiusMm -
                  definition.ringWidthMm;

            const labelRadiusMm =
              score === 10
                ? 0
                : (radiusMm +
                    previousRadiusMm) /
                  2;

            const labelOffsetPercent =
              mmToPercent(labelRadiusMm);

            return (
              <span
                key={`label-${score}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  top:
                    score === 10
                      ? "50%"
                      : `${
                          50 -
                          labelOffsetPercent
                        }%`,
                  transform:
                    `translate(-50%, -50%) scale(${1 / zoomScale})`,
                  transformOrigin: "center",
                  color:
                    radiusMm <=
                    definition.blackDiameterMm /
                      2
                      ? "#ffffff"
                      : "#111827",
                  fontSize:
                    score === 10
                      ? "9px"
                      : "10px",
                  fontWeight: "bold",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                {score}
              </span>
            );
          }
        )}
      </>
    );
  }

  const markerScale = 1 / zoomScale;

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() =>
            changeZoomLevel(zoomLevel - 1)
          }
          disabled={zoomLevel === 1}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <span className="min-w-28 text-center text-sm font-medium text-slate-700">
          Zoomstufe {zoomLevel}
        </span>

        <button
          type="button"
          onClick={() =>
            changeZoomLevel(zoomLevel + 1)
          }
          disabled={zoomLevel === 5}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div
        style={{
          width: `${viewportSize}px`,
          height: `${viewportSize}px`,
          margin: "0 auto",
          overflow: "hidden",
          borderRadius: "12px",
          position: "relative",
          backgroundColor: "white",
        }}
      >
        <div
          onClick={handleTargetClick}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${viewportSize}px`,
            height: `${viewportSize}px`,
            transform: `translate(-50%, -50%) scale(${zoomScale})`,
            transformOrigin: "center",
            backgroundColor: "white",
            cursor: readOnly
              ? "default"
              : "crosshair",
          }}
        >
          {targetType === "crossbow30m"
            ? renderCrossbowTarget(
                CROSSBOW_30M_TARGET
              )
            : targetType === "crossbow10m"
              ? renderCrossbowTarget(
                  CROSSBOW_10M_TARGET
                )
              : targetType === "rifle10m"
                ? renderCrossbowTarget(
                    RIFLE_10M_TARGET
                  )
                : targetType === "rifle50m"
                  ? renderCrossbowTarget(
                      RIFLE_50M_TARGET
                    )
                  : targetType === "rifle300m"
                    ? renderCrossbowTarget(
                        RIFLE_300M_TARGET
                      )
                    : renderDefaultTarget()}

          {shots
            .filter(
              (shot) =>
                shot.x_position !== null &&
                shot.y_position !== null
            )
            .map((shot) => (
              <div
                key={shot.id}
                title={`Schuss ${shot.shot_number}: ${shot.score}`}
                style={{
                  position: "absolute",
                  left: `${
                    ((Number(
                      shot.x_position
                    ) +
                      1) /
                      2) *
                    100
                  }%`,
                  top: `${
                    ((1 -
                      Number(
                        shot.y_position
                      )) /
                      2) *
                    100
                  }%`,
                  width: "24px",
                  height: "24px",
                  transform:
                    `translate(-50%, -50%) scale(${markerScale})`,
                  transformOrigin: "center",
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  border: "2px solid white",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 20,
                  pointerEvents: "none",
                }}
              >
                {shot.shot_number}
              </div>
            ))}

          {selectedX !== null &&
            selectedY !== null &&
            selectedScore !== null && (
              <div
                style={{
                  position: "absolute",
                  left: `${
                    ((selectedX + 1) / 2) *
                    100
                  }%`,
                  top: `${
                    ((1 - selectedY) / 2) *
                    100
                  }%`,
                  width: "28px",
                  height: "28px",
                  transform:
                    `translate(-50%, -50%) scale(${markerScale})`,
                  transformOrigin: "center",
                  borderRadius: "50%",
                  border: "2px solid white",
                  backgroundColor: "#dc2626",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 20,
                  pointerEvents: "none",
                }}
              >
                {selectedScore}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
