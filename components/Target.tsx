"use client";

import { useLayoutEffect, useRef, useState } from "react";

type TargetShot = {
  id: string;
  shot_number: number;
  score: number;
  x_position: number | null;
  y_position: number | null;
};

export type TargetType = "default" | "crossbow30m";

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
};

type Crossbow30mDefinition = {
  targetSizeMm: number;
  scoringDiameterMm: number;
  blackDiameterMm: number;
  moucheDiameterMm: number;
  tenDiameterMm: number;
  ringWidthMm: number;
  lineWidthMm: number;
  projectileDiameterMm: number;
};

export const CROSSBOW_30M_TARGET: Crossbow30mDefinition = {
  targetSizeMm: 200,
  scoringDiameterMm: 114,
  blackDiameterMm: 90,
  moucheDiameterMm: 2,
  tenDiameterMm: 6,
  ringWidthMm: 6,
  lineWidthMm: 0.15,
  projectileDiameterMm: 6,
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

/*
 * x / y sind auf die gesamte 200 x 200 mm Kartonfläche normalisiert:
 *
 * x = -1  -> linker Rand  (-100 mm)
 * x =  0  -> Scheibenmitte
 * x = +1  -> rechter Rand (+100 mm)
 *
 * Gleiches gilt für y.
 */
export function normalizedToMillimeters(
  x: number,
  y: number
) {
  const halfSize =
    CROSSBOW_30M_TARGET.targetSizeMm / 2;

  return {
    xMm: x * halfSize,
    yMm: y * halfSize,
  };
}

/*
 * Armbrust 30 m:
 *
 * Ringgrenzen (Radius):
 * 10 =  3 mm
 *  9 =  9 mm
 *  8 = 15 mm
 *  ...
 *  1 = 57 mm
 *
 * Linienwertung:
 * Berührt der 6-mm-Pfeil den höherwertigen Ring,
 * gilt der höhere Wert.
 *
 * Deshalb wird vom Abstand des Pfeilzentrums der
 * Pfeilradius (3 mm) abgezogen.
 */
export function scoreCrossbow30m(
  x: number,
  y: number
) {
  const { xMm, yMm } =
    normalizedToMillimeters(x, y);

  const centerDistanceMm = Math.sqrt(
    xMm * xMm + yMm * yMm
  );

  const projectileRadiusMm =
    CROSSBOW_30M_TARGET.projectileDiameterMm / 2;

  const effectiveDistanceMm = Math.max(
    0,
    centerDistanceMm - projectileRadiusMm
  );

  const tenRadiusMm =
    CROSSBOW_30M_TARGET.tenDiameterMm / 2;

  if (effectiveDistanceMm <= tenRadiusMm) {
    return 10;
  }

  for (let score = 9; score >= 1; score--) {
    const ringRadiusMm =
      tenRadiusMm +
      (10 - score) *
        CROSSBOW_30M_TARGET.ringWidthMm;

    if (effectiveDistanceMm <= ringRadiusMm) {
      return score;
    }
  }

  return 0;
}

function getScore(
  targetType: TargetType,
  x: number,
  y: number
) {
  if (targetType === "crossbow30m") {
    return scoreCrossbow30m(x, y);
  }

  return scoreDefaultTarget(x, y);
}

export default function Target({
  selectedX,
  selectedY,
  selectedScore,
  onSelect,
  readOnly = false,
  shots = [],
  targetType = "default",
}: TargetProps) {
  const [zoom, setZoom] = useState(1);
  const scrollRef =
    useRef<HTMLDivElement | null>(null);

  const targetSize = 300 * zoom;

  function changeZoom(nextZoom: number) {
    const clampedZoom = Math.max(
      1,
      Math.min(3, nextZoom)
    );

    setZoom(clampedZoom);
  }

  useLayoutEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollLeft =
      (container.scrollWidth -
        container.clientWidth) /
      2;

    container.scrollTop =
      (container.scrollHeight -
        container.clientHeight) /
      2;
  }, [zoom]);

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
      y
    );

    onSelect?.(
      Number(x.toFixed(4)),
      Number(y.toFixed(4)),
      score
    );
  }

  const mmToPercent = (mm: number) =>
    (mm /
      CROSSBOW_30M_TARGET.targetSizeMm) *
    100;

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
              "translate(-50%, -50%)",
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
                    "translate(-50%, -50%)",
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

  function renderCrossbow30mTarget() {
    const scoringDiameterPercent =
      mmToPercent(
        CROSSBOW_30M_TARGET.scoringDiameterMm
      );

    const blackDiameterPercent =
      mmToPercent(
        CROSSBOW_30M_TARGET.blackDiameterMm
      );

    const moucheDiameterPercent =
      mmToPercent(
        CROSSBOW_30M_TARGET.moucheDiameterMm
      );

    const tenRadiusMm =
      CROSSBOW_30M_TARGET.tenDiameterMm / 2;

    const ringDiametersMm = Array.from(
      { length: 10 },
      (_, index) => {
        const score = 10 - index;
        const radius =
          tenRadiusMm +
          (10 - score) *
            CROSSBOW_30M_TARGET.ringWidthMm;

        return {
          score,
          diameterMm: radius * 2,
        };
      }
    );

    return (
      <>
        {/* kompletter 200 x 200 mm Karton */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#ffffff",
            pointerEvents: "none",
          }}
        />

        {/* Schwarzer Spiegel: 90 mm */}
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

        {/* Ringlinien 10 bis 1 */}
        {ringDiametersMm.map(
          ({ score, diameterMm }) => {
            const diameterPercent =
              mmToPercent(diameterMm);

            const lineWidthPx =
              Math.max(
                1,
                (CROSSBOW_30M_TARGET.lineWidthMm /
                  CROSSBOW_30M_TARGET.targetSizeMm) *
                  targetSize
              );

            const lineColor =
              diameterMm <=
              CROSSBOW_30M_TARGET.blackDiameterMm
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

        {/* Äusserste 1er-Grenze / 114 mm */}
        <div
          style={{
            position: "absolute",
            width: `${scoringDiameterPercent}%`,
            height: `${scoringDiameterPercent}%`,
            left: `${
              (100 - scoringDiameterPercent) / 2
            }%`,
            top: `${
              (100 - scoringDiameterPercent) / 2
            }%`,
            border: "1px solid #111827",
            borderRadius: "50%",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />

        {/* Weisse Mouche: 2 mm */}
        <div
          style={{
            position: "absolute",
            width: `${moucheDiameterPercent}%`,
            height: `${moucheDiameterPercent}%`,
            left: `${
              (100 - moucheDiameterPercent) / 2
            }%`,
            top: `${
              (100 - moucheDiameterPercent) / 2
            }%`,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />

        {/* Ringzahlen oben */}
        {ringDiametersMm.map(
          ({ score, diameterMm }) => {
            const radiusMm =
              diameterMm / 2;

            const previousRadiusMm =
              score === 10
                ? 0
                : radiusMm -
                  CROSSBOW_30M_TARGET.ringWidthMm;

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
                    "translate(-50%, -50%)",
                  color:
                    radiusMm <=
                    CROSSBOW_30M_TARGET.blackDiameterMm /
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() =>
            changeZoom(zoom - 0.5)
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700"
        >
          −
        </button>

        <span className="min-w-14 text-center text-sm font-medium text-slate-700">
          {zoom}×
        </span>

        <button
          type="button"
          onClick={() =>
            changeZoom(zoom + 0.5)
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700"
        >
          +
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          width: "300px",
          height: "300px",
          margin: "0 auto",
          overflow: "hidden",
          borderRadius: "12px",
          position: "relative",
        }}
      >
        <div
          onClick={handleTargetClick}
          style={{
            position: "relative",
            width: `${targetSize}px`,
            height: `${targetSize}px`,
            flexShrink: 0,
            backgroundColor: "white",
            overflow: "hidden",
            cursor: readOnly
              ? "default"
              : "crosshair",
          }}
        >
          {targetType === "crossbow30m"
            ? renderCrossbow30mTarget()
            : renderDefaultTarget()}

          {/* Gespeicherte Treffer */}
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
                    "translate(-50%, -50%)",
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

          {/* Gewählter Treffer */}
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
                    "translate(-50%, -50%)",
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
