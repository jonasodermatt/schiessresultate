"use client";

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
};

export default function Target({
  selectedX,
  selectedY,
  selectedScore,
  onSelect,
  readOnly = false,
}: TargetProps) {
  function handleTargetClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
      if (readOnly) {
  return;
}
    const rect = event.currentTarget.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const x = (mouseX / rect.width) * 2 - 1;
    const y = -((mouseY / rect.height) * 2 - 1);

    const distance = Math.sqrt(x * x + y * y);

    let score = 0;

    if (distance <= 0.09) score = 10;
    else if (distance <= 0.18) score = 9;
    else if (distance <= 0.27) score = 8;
    else if (distance <= 0.36) score = 7;
    else if (distance <= 0.45) score = 6;
    else if (distance <= 0.54) score = 5;
    else if (distance <= 0.63) score = 4;
    else if (distance <= 0.72) score = 3;
    else if (distance <= 0.81) score = 2;
    else if (distance <= 0.90) score = 1;
    else score = 0;

 onSelect?.(
  Number(x.toFixed(3)),
  Number(y.toFixed(3)),
  score
);
  }

  return (
    <div
      onClick={handleTargetClick}
      style={{
        position: "relative",
        width: "300px",
        height: "300px",
        margin: "20px auto",
        borderRadius: "50%",
        backgroundColor: "white",
        overflow: "hidden",
        cursor: readOnly ? "default" : "crosshair",
      }}
    >
      {/* Dunkler Bereich 3 bis 10 */}
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

      {/* Dünne Ringlinien */}
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

      {/* Dicke Grenze zwischen 1 und 0 */}
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

      {/* 10 in der Mitte */}
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          fontSize: "11px",
          fontWeight: "bold",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        10
      </span>

      {/* 9 bis 0 zwischen den Ringen */}
      {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(
        (score, index) => {
          const radiusPercent = 6.75 + index * 4.5;

          return (
            <span
              key={score}
              style={{
                position: "absolute",
                left: "50%",
                top: `${50 - radiusPercent}%`,
                transform: "translate(-50%, -50%)",
                color: score >= 3 ? "white" : "#334155",
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

      {/* Gewählter Treffer */}
      {selectedX !== null &&
        selectedY !== null &&
        selectedScore !== null && (
          <div
            style={{
              position: "absolute",
              left: `${((selectedX + 1) / 2) * 100}%`,
              top: `${((1 - selectedY) / 2) * 100}%`,
              width: "28px",
              height: "28px",
              transform: "translate(-50%, -50%)",
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
  );
}