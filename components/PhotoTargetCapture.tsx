"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CROSSBOW_30M_TARGET,
  scoreCrossbow30m,
} from "@/components/Target";

export type PhotoDetectedShot = {
  score: number;
  x: number;
  y: number;
};

type PhotoTargetCaptureProps = {
  onImport: (shots: PhotoDetectedShot[]) => void;
  onClose: () => void;
};

type ImagePoint = {
  x: number;
  y: number;
};

type PhotoMarker = ImagePoint & {
  id: string;
};

const SCORING_RADIUS_ON_TARGET = 114 / 200;

export default function PhotoTargetCapture({
  onImport,
  onClose,
}: PhotoTargetCaptureProps) {
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggingMarkerIdRef = useRef<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState("");
  const [center, setCenter] = useState<ImagePoint | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [radiusY, setRadiusY] = useState<number | null>(null);
  const [ellipseAngleDeg, setEllipseAngleDeg] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [calibrationStep, setCalibrationStep] = useState<
    "center" | "radius" | "shots"
  >("center");
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function selectPhoto(file: File | undefined) {
    if (!file) return;

    if (photoUrl) URL.revokeObjectURL(photoUrl);

    setPhotoUrl(URL.createObjectURL(file));
    setCenter(null);
    setRadius(null);
    setRadiusY(null);
    setEllipseAngleDeg(0);
    setRotationDeg(0);
    setMarkers([]);
    setAnalyzing(false);
    setAnalysisMessage("");
    setCalibrationStep("center");
  }

  function pointFromClientPosition(
    clientX: number,
    clientY: number
  ): ImagePoint | null {
    const element = imageAreaRef.current;
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;

    // Das Foto wird sichtbar um die Scheibenmitte gedreht.
    // Für die Bildanalyse und Markerhaltung rechnen wir die
    // Bildschirmposition wieder ins ursprüngliche Foto zurück.
    if (center && rotationDeg !== 0) {
      const dx = (x - center.x) * rect.width;
      const dy = (center.y - y) * rect.height;
      const angle = (rotationDeg * Math.PI) / 180;
      const originalX =
        Math.cos(angle) * dx - Math.sin(angle) * dy;
      const originalY =
        Math.sin(angle) * dx + Math.cos(angle) * dy;

      x = center.x + originalX / rect.width;
      y = center.y - originalY / rect.height;
    }

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  function pointToShot(point: ImagePoint): PhotoDetectedShot | null {
    const element = imageAreaRef.current;
    if (
      !element ||
      !center ||
      !radius ||
      !radiusY ||
      radius <= 0 ||
      radiusY <= 0
    ) return null;

    const rect = element.getBoundingClientRect();
    const dx = (point.x - center.x) * rect.width;
    const dy = (point.y - center.y) * rect.height;
    const ellipseAngle = (ellipseAngleDeg * Math.PI) / 180;
    const ellipseX =
      Math.cos(ellipseAngle) * dx + Math.sin(ellipseAngle) * dy;
    const ellipseY =
      -Math.sin(ellipseAngle) * dx + Math.cos(ellipseAngle) * dy;
    const normalizedX = ellipseX / (radius * rect.width);
    const normalizedY = -ellipseY / (radiusY * rect.height);
    // CSS dreht im Uhrzeigersinn; im mathematischen
    // Koordinatensystem entspricht dies einem negativen Winkel.
    const angle = (-rotationDeg * Math.PI) / 180;

    const alignedX =
      Math.cos(angle) * normalizedX - Math.sin(angle) * normalizedY;
    const alignedY =
      Math.sin(angle) * normalizedX + Math.cos(angle) * normalizedY;

    const x = alignedX * SCORING_RADIUS_ON_TARGET;
    const y = alignedY * SCORING_RADIUS_ON_TARGET;

    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      score: scoreCrossbow30m(x, y),
    };
  }

  const detectedShots = useMemo(
    () =>
      markers
        .map((marker) => ({
          marker,
          shot: pointToShot(marker),
        }))
        .filter(
          (
            item
          ): item is {
            marker: PhotoMarker;
            shot: PhotoDetectedShot;
          } => item.shot !== null
        )
        .sort((a, b) => {
          const scoreDifference = b.shot.score - a.shot.score;
          if (scoreDifference !== 0) return scoreDifference;

          const distanceA = Math.hypot(a.shot.x, a.shot.y);
          const distanceB = Math.hypot(b.shot.x, b.shot.y);
          return distanceA - distanceB;
        }),
    // Die Bildfläche wird nach dem Laden nicht mehr skaliert,
    // ohne dass die Komponente ebenfalls neu gerendert wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, center, radius, radiusY, ellipseAngleDeg, rotationDeg]
  );

  function handleImageClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (!photoUrl || draggingMarkerIdRef.current) return;

    const point = pointFromClientPosition(event.clientX, event.clientY);
    if (!point) return;

    if (calibrationStep === "center") {
      setCenter(point);
      setRadius(null);
      setCalibrationStep("radius");
      return;
    }

    if (calibrationStep === "radius") {
      if (!center || !imageAreaRef.current) return;

      const rect = imageAreaRef.current.getBoundingClientRect();
      const dx = (point.x - center.x) * rect.width;
      const dy = (point.y - center.y) * rect.height;
      const nextRadius = Math.sqrt(dx * dx + dy * dy) / rect.width;

      if (nextRadius < 0.03) return;
      setRadius(nextRadius);
      setRadiusY(
        (nextRadius * rect.width) / rect.height
      );
      setEllipseAngleDeg(0);
      setCalibrationStep("shots");
      return;
    }

    setMarkers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        ...point,
      },
    ]);
  }

  function moveMarker(
    id: string,
    clientX: number,
    clientY: number
  ) {
    const point = pointFromClientPosition(clientX, clientY);
    if (!point) return;

    setMarkers((current) =>
      current.map((marker) =>
        marker.id === id ? { ...marker, ...point } : marker
      )
    );
  }

  function resetCalibration() {
    setCenter(null);
    setRadius(null);
    setRadiusY(null);
    setEllipseAngleDeg(0);
    setMarkers([]);
    setCalibrationStep("center");
  }

  function analyzePhoto(image: HTMLImageElement) {
    if (center || analyzing) return;

    setAnalyzing(true);
    setAnalysisMessage("Scheibenrand und Treffer werden gesucht …");

    window.setTimeout(() => {
      const maximumWidth = 720;
      const scale = Math.min(1, maximumWidth / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!context) {
        setAnalyzing(false);
        setAnalysisMessage("Bildanalyse ist auf diesem Gerät nicht verfügbar.");
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const dark = new Uint8Array(width * height);

      for (let index = 0; index < width * height; index++) {
        const offset = index * 4;
        const luminance =
          pixels[offset] * 0.299 +
          pixels[offset + 1] * 0.587 +
          pixels[offset + 2] * 0.114;
        dark[index] = luminance < 92 ? 1 : 0;
      }

      // Kleine Ringlinien und Ziffern werden über die lokale
      // Dunkelflächendichte ausgeblendet. Nur Bereiche, deren
      // Umgebung mehrheitlich schwarz ist, bilden die Scheibe.
      const densityRadius = Math.max(4, Math.round(width / 120));
      const integralWidth = width + 1;
      const darkIntegral = new Uint32Array((width + 1) * (height + 1));
      const connectedDark = new Uint8Array(width * height);

      for (let y = 1; y <= height; y++) {
        let rowSum = 0;
        for (let x = 1; x <= width; x++) {
          rowSum += dark[(y - 1) * width + (x - 1)];
          darkIntegral[y * integralWidth + x] =
            darkIntegral[(y - 1) * integralWidth + x] + rowSum;
        }
      }

      for (let y = 0; y < height; y++) {
        const fromY = Math.max(0, y - densityRadius);
        const toY = Math.min(height, y + densityRadius + 1);
        for (let x = 0; x < width; x++) {
          const fromX = Math.max(0, x - densityRadius);
          const toX = Math.min(width, x + densityRadius + 1);
          const darkPixels =
            darkIntegral[toY * integralWidth + toX] -
            darkIntegral[fromY * integralWidth + toX] -
            darkIntegral[toY * integralWidth + fromX] +
            darkIntegral[fromY * integralWidth + fromX];
          const area = (toX - fromX) * (toY - fromY);
          connectedDark[y * width + x] =
            darkPixels / area > 0.52 ? 1 : 0;
        }
      }

      const visited = new Uint8Array(width * height);
      let best: {
        area: number;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        sumX: number;
        sumY: number;
        sumXX: number;
        sumYY: number;
        sumXY: number;
      } | null = null;
      const queue = new Int32Array(width * height);

      for (let start = 0; start < connectedDark.length; start++) {
        if (!connectedDark[start] || visited[start]) continue;

        let head = 0;
        let tail = 0;
        queue[tail++] = start;
        visited[start] = 1;
        let area = 0;
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let sumX = 0;
        let sumY = 0;
        let sumXX = 0;
        let sumYY = 0;
        let sumXY = 0;

        while (head < tail) {
          const current = queue[head++];
          const x = current % width;
          const y = Math.floor(current / width);
          area++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          sumX += x;
          sumY += y;
          sumXX += x * x;
          sumYY += y * y;
          sumXY += x * y;

          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const nx = x + ox;
              const ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const next = ny * width + nx;
              if (connectedDark[next] && !visited[next]) {
                visited[next] = 1;
                queue[tail++] = next;
              }
            }
          }
        }

        const componentWidth = maxX - minX + 1;
        const componentHeight = maxY - minY + 1;
        const aspect = componentWidth / componentHeight;
        const sufficientlyLarge =
          componentWidth > width * 0.12 &&
          componentHeight > height * 0.12 &&
          componentWidth < width * 0.8 &&
          componentHeight < height * 0.8;

        if (
          sufficientlyLarge &&
          aspect > 0.55 &&
          aspect < 1.8 &&
          (!best || area > best.area)
        ) {
          best = {
            area,
            minX,
            minY,
            maxX,
            maxY,
            sumX,
            sumY,
            sumXX,
            sumYY,
            sumXY,
          };
        }
      }

      if (!best) {
        setAnalyzing(false);
        setAnalysisMessage(
          "Der schwarze 3er-Rand wurde nicht sicher erkannt. Bitte Mitte und Rand manuell setzen."
        );
        return;
      }

      type EllipseFit = {
        centerX: number;
        centerY: number;
        radiusX: number;
        radiusY: number;
        angle: number;
      };

      const ellipseFromMoments = (
        area: number,
        sumX: number,
        sumY: number,
        sumXX: number,
        sumYY: number,
        sumXY: number,
        boundaryPoints: boolean
      ): EllipseFit => {
        const centerX = sumX / area;
        const centerY = sumY / area;
        const covarianceXX = sumXX / area - centerX * centerX;
        const covarianceYY = sumYY / area - centerY * centerY;
        const covarianceXY = sumXY / area - centerX * centerY;
        const trace = covarianceXX + covarianceYY;
        const difference = covarianceXX - covarianceYY;
        const discriminant = Math.sqrt(
          Math.max(0, difference * difference + 4 * covarianceXY * covarianceXY)
        );
        const majorVariance = Math.max(1, (trace + discriminant) / 2);
        const minorVariance = Math.max(1, (trace - discriminant) / 2);
        const varianceToRadius = boundaryPoints ? Math.sqrt(2) : 2;

        return {
          centerX,
          centerY,
          radiusX: Math.sqrt(majorVariance) * varianceToRadius,
          radiusY: Math.sqrt(minorVariance) * varianceToRadius,
          angle: 0.5 * Math.atan2(2 * covarianceXY, difference),
        };
      };

      // Erste robuste Näherung nur aus der zusammenhängenden schwarzen
      // 90-mm-Fläche. Für eine gefüllte Ellipse entsprechen die Radien dem
      // Doppelten der Standardabweichung entlang ihrer Hauptachsen.
      const initialEllipse = ellipseFromMoments(
        best.area,
        best.sumX,
        best.sumY,
        best.sumXX,
        best.sumYY,
        best.sumXY,
        false
      );
      initialEllipse.radiusX += densityRadius * 0.65;
      initialEllipse.radiusY += densityRadius * 0.65;

      // Den tatsächlichen Übergang weisser 2er -> schwarzer 3er auf vielen
      // elliptischen Strahlen messen. Innere Ringlinien und der äussere
      // Blattrand liegen ausserhalb des engen Suchfensters und können die
      // Anpassung deshalb nicht übernehmen.
      const boundaryPoints: Array<{ x: number; y: number }> = [];
      const sampleLuminance = (x: number, y: number) => {
        const roundedX = Math.max(0, Math.min(width - 1, Math.round(x)));
        const roundedY = Math.max(0, Math.min(height - 1, Math.round(y)));
        const offset = (roundedY * width + roundedX) * 4;
        return (
          pixels[offset] * 0.299 +
          pixels[offset + 1] * 0.587 +
          pixels[offset + 2] * 0.114
        );
      };

      for (let index = 0; index < 96; index++) {
        const parameter = (index / 96) * Math.PI * 2;
        const localX = initialEllipse.radiusX * Math.cos(parameter);
        const localY = initialEllipse.radiusY * Math.sin(parameter);
        const directionX =
          Math.cos(initialEllipse.angle) * localX -
          Math.sin(initialEllipse.angle) * localY;
        const directionY =
          Math.sin(initialEllipse.angle) * localX +
          Math.cos(initialEllipse.angle) * localY;
        let strongestContrast = 0;
        let strongestScale = 1;

        for (let scale = 0.82; scale <= 1.18; scale += 0.004) {
          const innerScale = scale - 0.018;
          const outerScale = scale + 0.018;
          const innerLuminance = sampleLuminance(
            initialEllipse.centerX + directionX * innerScale,
            initialEllipse.centerY + directionY * innerScale
          );
          const outerLuminance = sampleLuminance(
            initialEllipse.centerX + directionX * outerScale,
            initialEllipse.centerY + directionY * outerScale
          );
          const contrast = outerLuminance - innerLuminance;

          if (contrast > strongestContrast) {
            strongestContrast = contrast;
            strongestScale = scale;
          }
        }

        if (strongestContrast >= 20) {
          boundaryPoints.push({
            x: initialEllipse.centerX + directionX * strongestScale,
            y: initialEllipse.centerY + directionY * strongestScale,
          });
        }
      }

      let fittedEllipse = initialEllipse;
      if (boundaryPoints.length >= 58) {
        fittedEllipse = ellipseFromMoments(
          boundaryPoints.length,
          boundaryPoints.reduce((sum, point) => sum + point.x, 0),
          boundaryPoints.reduce((sum, point) => sum + point.y, 0),
          boundaryPoints.reduce((sum, point) => sum + point.x * point.x, 0),
          boundaryPoints.reduce((sum, point) => sum + point.y * point.y, 0),
          boundaryPoints.reduce((sum, point) => sum + point.x * point.y, 0),
          true
        );
      }

      const blackCenterX = fittedEllipse.centerX;
      const blackCenterY = fittedEllipse.centerY;
      const blackRadiusX = fittedEllipse.radiusX;
      const blackRadiusY = fittedEllipse.radiusY;
      const ellipseAngle = fittedEllipse.angle;

      const scoringRadiusX = blackRadiusX * (114 / 90);
      const scoringRadiusY = blackRadiusY * (114 / 90);
      const fittedAxisRatio =
        Math.min(blackRadiusX, blackRadiusY) /
        Math.max(blackRadiusX, blackRadiusY);
      const scoringExtentX = Math.sqrt(
        (scoringRadiusX * Math.cos(ellipseAngle)) ** 2 +
          (scoringRadiusY * Math.sin(ellipseAngle)) ** 2
      );
      const scoringExtentY = Math.sqrt(
        (scoringRadiusX * Math.sin(ellipseAngle)) ** 2 +
          (scoringRadiusY * Math.cos(ellipseAngle)) ** 2
      );
      const scoringEllipseFitsImage =
        blackCenterX - scoringExtentX >= -width * 0.02 &&
        blackCenterX + scoringExtentX <= width * 1.02 &&
        blackCenterY - scoringExtentY >= -height * 0.02 &&
        blackCenterY + scoringExtentY <= height * 1.02;

      if (fittedAxisRatio < 0.42 || !scoringEllipseFitsImage) {
        setAnalyzing(false);
        setAnalysisMessage(
          "Der schwarze 3er-Rand ist nicht vollständig und sicher im Foto. Bitte Mitte und 1er-Rand manuell setzen."
        );
        return;
      }
      const nextCenter = {
        x: blackCenterX / width,
        y: blackCenterY / height,
      };
      const nextRadius = scoringRadiusX / width;
      const nextRadiusY = scoringRadiusY / height;
      const nextEllipseAngleDeg = ellipseAngle * (180 / Math.PI);
      const expectedHoleDiameter = Math.max(
        4,
        Math.sqrt(blackRadiusX * blackRadiusY) *
          (CROSSBOW_30M_TARGET.projectileDiameterMm /
            (CROSSBOW_30M_TARGET.blackDiameterMm / 2))
      );

      const candidateMask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - blackCenterX;
          const dy = y - blackCenterY;
          const ellipseX =
            Math.cos(ellipseAngle) * dx + Math.sin(ellipseAngle) * dy;
          const ellipseY =
            -Math.sin(ellipseAngle) * dx + Math.cos(ellipseAngle) * dy;
          const ellipseDistance = Math.sqrt(
            (ellipseX * ellipseX) / (scoringRadiusX * scoringRadiusX) +
            (ellipseY * ellipseY) / (scoringRadiusY * scoringRadiusY)
          );
          if (ellipseDistance > 1.04) continue;

          const index = y * width + x;
          const offset = index * 4;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const channelMaximum = Math.max(red, green, blue);
          const channelMinimum = Math.min(red, green, blue);
          const relativeColorDifference =
            channelMaximum > 0
              ? (channelMaximum - channelMinimum) / channelMaximum
              : 0;
          const pixelLuminance = red * 0.299 + green * 0.587 + blue * 0.114;
          const neighborhoodRadius = expectedHoleDiameter * 0.9;
          let neighborhoodLuminance = 0;
          for (let sample = 0; sample < 8; sample++) {
            const angle = (sample / 8) * Math.PI * 2;
            neighborhoodLuminance += sampleLuminance(
              x + Math.cos(angle) * neighborhoodRadius,
              y + Math.sin(angle) * neighborhoodRadius
            );
          }
          neighborhoodLuminance /= 8;
          const localLuminanceContrast = Math.abs(
            pixelLuminance - neighborhoodLuminance
          );
          const insideBlackArea = ellipseDistance < 90 / 114;
          const contrastsWithTarget = insideBlackArea
            ? localLuminanceContrast >= 22
            : neighborhoodLuminance - pixelLuminance >= 38;
          const coloredBackingMaterial =
            channelMaximum > 42 &&
            channelMaximum - channelMinimum >= 14 &&
            relativeColorDifference >= 0.1 &&
            contrastsWithTarget;
          // Helle Flächen auf dem schwarzen Spiegel sind nicht eindeutig:
          // insbesondere die gedruckten Ringziffern sehen wie Ausrisskanten
          // aus. In diesem zusammenhängenden Flächenpfad deshalb nur sichtbar
          // gewordenes farbiges Scheibenmaterial akzeptieren. Dabei zählt der
          // Farbunterschied der Kanäle statt eines bestimmten Brauntons.
          candidateMask[index] = coloredBackingMaterial ? 1 : 0;
        }
      }

      // Ein ausgerissenes Loch besitzt häufig nur einzelne helle
      // Randstücke. Eine kleine Erweiterung verbindet diese Stücke,
      // ohne die wesentlich längeren Ringlinien zu gültigen
      // Treffern zu machen.
      const expandedCandidateMask = new Uint8Array(width * height);
      const candidateJoinRadius = Math.max(
        1,
        Math.round(expectedHoleDiameter * 0.1)
      );
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!candidateMask[y * width + x]) continue;
          for (let oy = -candidateJoinRadius; oy <= candidateJoinRadius; oy++) {
            for (let ox = -candidateJoinRadius; ox <= candidateJoinRadius; ox++) {
              const nextX = x + ox;
              const nextY = y + oy;
              if (
                nextX >= 0 &&
                nextY >= 0 &&
                nextX < width &&
                nextY < height
              ) {
                expandedCandidateMask[nextY * width + nextX] = 1;
              }
            }
          }
        }
      }

      const candidateVisited = new Uint8Array(width * height);
      const candidates: Array<{ x: number; y: number; area: number }> = [];

      for (let start = 0; start < expandedCandidateMask.length; start++) {
        if (!expandedCandidateMask[start] || candidateVisited[start]) continue;
        let head = 0;
        let tail = 0;
        queue[tail++] = start;
        candidateVisited[start] = 1;
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        while (head < tail) {
          const current = queue[head++];
          const x = current % width;
          const y = Math.floor(current / width);
          area++;
          sumX += x;
          sumY += y;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);

          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = x + ox;
              const ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const next = ny * width + nx;
              if (expandedCandidateMask[next] && !candidateVisited[next]) {
                candidateVisited[next] = 1;
                queue[tail++] = next;
              }
            }
          }
        }

        const componentWidth = maxX - minX + 1;
        const componentHeight = maxY - minY + 1;
        const fillRatio = area / (componentWidth * componentHeight);
        const componentAspect = componentWidth / componentHeight;
        const componentCenterX = sumX / area;
        const componentCenterY = sumY / area;
        const textureRadius = expectedHoleDiameter * 0.52;
        let textureSamples = 0;
        let texturedSamples = 0;
        for (
          let textureY = Math.floor(componentCenterY - textureRadius);
          textureY <= Math.ceil(componentCenterY + textureRadius);
          textureY++
        ) {
          for (
            let textureX = Math.floor(componentCenterX - textureRadius);
            textureX <= Math.ceil(componentCenterX + textureRadius);
            textureX++
          ) {
            if (
              (textureX - componentCenterX) ** 2 +
                (textureY - componentCenterY) ** 2 >
              textureRadius * textureRadius
            ) {
              continue;
            }
            const edgeStrength =
              Math.abs(
                sampleLuminance(textureX + 1, textureY) -
                  sampleLuminance(textureX - 1, textureY)
              ) +
              Math.abs(
                sampleLuminance(textureX, textureY + 1) -
                  sampleLuminance(textureX, textureY - 1)
              );
            textureSamples++;
            if (edgeStrength >= 30) texturedSamples++;
          }
        }
        const textureRatio =
          textureSamples > 0 ? texturedSamples / textureSamples : 0;
        if (
          area >= Math.max(12, expectedHoleDiameter * expectedHoleDiameter * 0.18) &&
          componentWidth >= expectedHoleDiameter * 0.65 &&
          componentHeight >= expectedHoleDiameter * 0.65 &&
          componentWidth <= expectedHoleDiameter * 1.75 &&
          componentHeight <= expectedHoleDiameter * 1.75 &&
          componentAspect >= 0.65 &&
          componentAspect <= 1.54 &&
          fillRatio >= 0.25 &&
          textureRatio >= 0.28
        ) {
          candidates.push({
            x: componentCenterX,
            y: componentCenterY,
            area,
          });
        }
      }

      // Farbneutrale Löcher besitzen oft keine verwertbare Materialfarbe,
      // zeigen aber im Bereich eines Projektilquerschnitts viele kurze,
      // unregelmässige Abrisskanten. Glatte Flecken sowie gedruckte Ziffern
      // haben eine deutlich geringere lokale Kantendichte.
      const textureScanStep = Math.max(
        2,
        Math.round(expectedHoleDiameter / 5)
      );
      const textureRadius = expectedHoleDiameter * 0.52;
      for (
        let y = Math.max(1, Math.floor(blackCenterY - scoringRadiusY));
        y <= Math.min(height - 2, Math.ceil(blackCenterY + scoringRadiusY));
        y += textureScanStep
      ) {
        for (
          let x = Math.max(1, Math.floor(blackCenterX - scoringRadiusX));
          x <= Math.min(width - 2, Math.ceil(blackCenterX + scoringRadiusX));
          x += textureScanStep
        ) {
          const scoringDistance = Math.sqrt(
            ((x - blackCenterX) ** 2) / (scoringRadiusX * scoringRadiusX) +
              ((y - blackCenterY) ** 2) / (scoringRadiusY * scoringRadiusY)
          );
          if (scoringDistance > 1.02) continue;

          let textureSamples = 0;
          let texturedSamples = 0;
          let stronglyTexturedSamples = 0;
          for (
            let textureY = Math.floor(y - textureRadius);
            textureY <= Math.ceil(y + textureRadius);
            textureY++
          ) {
            for (
              let textureX = Math.floor(x - textureRadius);
              textureX <= Math.ceil(x + textureRadius);
              textureX++
            ) {
              if (
                (textureX - x) ** 2 + (textureY - y) ** 2 >
                textureRadius * textureRadius
              ) {
                continue;
              }
              const edgeStrength =
                Math.abs(
                  sampleLuminance(textureX + 1, textureY) -
                    sampleLuminance(textureX - 1, textureY)
                ) +
                Math.abs(
                  sampleLuminance(textureX, textureY + 1) -
                    sampleLuminance(textureX, textureY - 1)
                );
              textureSamples++;
              if (edgeStrength >= 30) texturedSamples++;
              if (edgeStrength >= 60) stronglyTexturedSamples++;
            }
          }

          const textureRatio = texturedSamples / Math.max(1, textureSamples);
          const strongTextureRatio =
            stronglyTexturedSamples / Math.max(1, textureSamples);
          if (textureRatio >= 0.5 && strongTextureRatio >= 0.35) {
            candidates.push({
              x,
              y,
              area:
                (textureRatio + strongTextureRatio) *
                expectedHoleDiameter *
                expectedHoleDiameter,
            });
          }
        }
      }

      // Löcher können je nach Hintergrund heller, dunkler oder farbig wirken.
      // Deshalb unabhängig von der absoluten Farbe nach einer kompakten
      // Innenfläche mit einer kreisförmig verteilten Kontrastkante suchen.
      const radialCandidates: Array<{
        x: number;
        y: number;
        response: number;
      }> = [];
      const holeRadius = expectedHoleDiameter / 2;
      const scanStep = Math.max(2, Math.round(expectedHoleDiameter / 7));

      for (
        let y = Math.max(0, Math.floor(blackCenterY - scoringRadiusY));
        y <= Math.min(height - 1, Math.ceil(blackCenterY + scoringRadiusY));
        y += scanStep
      ) {
        for (
          let x = Math.max(0, Math.floor(blackCenterX - scoringRadiusX));
          x <= Math.min(width - 1, Math.ceil(blackCenterX + scoringRadiusX));
          x += scanStep
        ) {
          const normalizedDistance = Math.sqrt(
            ((x - blackCenterX) ** 2) / (scoringRadiusX * scoringRadiusX) +
              ((y - blackCenterY) ** 2) / (scoringRadiusY * scoringRadiusY)
          );
          if (normalizedDistance > 1.02) continue;

          // Der Lochkern soll kompakt sein. Ziffern und Ringlinien erzeugen
          // dagegen innerhalb dieser Fläche starke Helligkeitssprünge.
          const coreOffsets = [
            [0, 0],
            [-0.42, 0],
            [-0.21, 0],
            [0.21, 0],
            [0.42, 0],
            [0, -0.42],
            [0, -0.21],
            [0, 0.21],
            [0, 0.42],
            [-0.3, -0.3],
            [0.3, -0.3],
            [-0.3, 0.3],
            [0.3, 0.3],
            [-0.42, -0.18],
            [0.42, -0.18],
            [-0.42, 0.18],
            [0.42, 0.18],
          ];
          const coreSamples = coreOffsets.map(([offsetX, offsetY]) =>
            sampleLuminance(
              x + holeRadius * offsetX,
              y + holeRadius * offsetY
            )
          );
          const coreLuminance =
            coreSamples.reduce((sum, value) => sum + value, 0) /
            coreSamples.length;
          const coreDeviation =
            coreSamples.reduce(
              (sum, value) => sum + Math.abs(value - coreLuminance),
              0
            ) / coreSamples.length;
          if (coreDeviation > 42) continue;

          const edgeMatches: boolean[] = [];
          let contrastEdgeSamples = 0;
          let strongEdgeSamples = 0;
          const minimumEdgeContrast = Math.max(28, coreDeviation * 1.35 + 16);
          for (let sample = 0; sample < 24; sample++) {
            const angle = (sample / 24) * Math.PI * 2;
            const edgeContrast = Math.max(
              Math.abs(
                sampleLuminance(
                  x + Math.cos(angle) * holeRadius * 0.78,
                  y + Math.sin(angle) * holeRadius * 0.78
                ) - coreLuminance
              ),
              Math.abs(
                sampleLuminance(
                  x + Math.cos(angle) * holeRadius,
                  y + Math.sin(angle) * holeRadius
                ) - coreLuminance
              ),
              Math.abs(
                sampleLuminance(
                  x + Math.cos(angle) * holeRadius * 1.18,
                  y + Math.sin(angle) * holeRadius * 1.18
                ) - coreLuminance
              )
            );
            const edgeMatchesHole = edgeContrast >= minimumEdgeContrast;
            edgeMatches.push(edgeMatchesHole);
            if (edgeMatchesHole) contrastEdgeSamples++;
            if (edgeContrast >= minimumEdgeContrast + 25) {
              strongEdgeSamples++;
            }
          }

          let oppositeEdgePairs = 0;
          for (let sample = 0; sample < 12; sample++) {
            if (edgeMatches[sample] && edgeMatches[sample + 12]) {
              oppositeEdgePairs++;
            }
          }

          const response =
            contrastEdgeSamples + strongEdgeSamples * 0.5 + oppositeEdgePairs;
          if (
            contrastEdgeSamples >= 9 &&
            strongEdgeSamples >= 4 &&
            oppositeEdgePairs >= 3
          ) {
            radialCandidates.push({ x, y, response });
          }
        }
      }

      // Die kontrastbasierte Rundsuche kann auf einer konzentrischen Scheibe
      // Ringlinien mit Lochkanten verwechseln. Solche unsicheren Vorschläge
      // nicht in die Trefferliste übernehmen; erkannte Materialflächen haben
      // Vorrang und neutrale Löcher können weiterhin manuell ergänzt werden.
      radialCandidates.length = 0;
      radialCandidates.sort((a, b) => b.response - a.response);
      for (const radialCandidate of radialCandidates) {
        if (
          candidates.every(
            (candidate) =>
              Math.hypot(
                candidate.x - radialCandidate.x,
                candidate.y - radialCandidate.y
              ) > expectedHoleDiameter * 1.05
          )
        ) {
          candidates.push({
            x: radialCandidate.x,
            y: radialCandidate.y,
            area: radialCandidate.response * expectedHoleDiameter,
          });
        }
      }

      candidates.sort((a, b) => b.area - a.area);
      const merged: typeof candidates = [];
      for (const candidate of candidates) {
        if (
          merged.every(
            (existing) =>
              Math.hypot(existing.x - candidate.x, existing.y - candidate.y) >
              expectedHoleDiameter * 0.8
          )
        ) {
          merged.push(candidate);
        }
        if (merged.length >= 20) break;
      }

      setCenter(nextCenter);
      setRadius(nextRadius);
      setRadiusY(nextRadiusY);
      setEllipseAngleDeg(nextEllipseAngleDeg);
      setMarkers(
        merged.map((candidate) => ({
          id: crypto.randomUUID(),
          x: candidate.x / width,
          y: candidate.y / height,
        }))
      );
      setCalibrationStep("shots");
      setAnalyzing(false);
      setAnalysisMessage(
        merged.length > 0
          ? `${merged.length} mögliche Treffer erkannt. Bitte kontrollieren und korrigieren.`
          : "Der 1er-Ring wurde erkannt. Schusslöcher bitte ergänzen."
      );
    }, 30);
  }

  const instruction =
    calibrationStep === "center"
      ? "Tippe exakt auf die Scheibenmitte."
      : calibrationStep === "radius"
        ? "Tippe auf den äusseren Rand des 1er-Rings."
        : "Tippe auf jedes Schussloch. Treffer können verschoben werden.";

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">
            Treffer aus Foto erfassen
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Armbrust 30 m · Verarbeitung nur auf diesem Gerät
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          Schliessen
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => selectPhoto(event.target.files?.[0])}
      />

      {!photoUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Foto aufnehmen oder auswählen
        </button>
      ) : (
        <>
          <div className="mt-4 rounded-lg bg-white p-3 text-center text-sm font-medium text-slate-700">
            {analyzing ? "Foto wird analysiert …" : analysisMessage || instruction}
          </div>

          <div
            ref={imageAreaRef}
            onClick={handleImageClick}
            className="relative mt-3 overflow-hidden rounded-lg bg-slate-900 touch-none select-none"
          >
            <div
              className="relative h-full w-full"
              style={{
                transform: `rotate(${rotationDeg}deg)`,
                transformOrigin: center
                  ? `${center.x * 100}% ${center.y * 100}%`
                  : "50% 50%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Fotografierte Armbrustscheibe"
                draggable={false}
                className="block h-auto w-full"
                onLoad={(event) => analyzePhoto(event.currentTarget)}
              />

            {center && (
              <div
                className="pointer-events-none absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600"
                style={{
                  left: `${center.x * 100}%`,
                  top: `${center.y * 100}%`,
                }}
              />
            )}

            {center && radius && radiusY && (
              <div
                className="pointer-events-none absolute z-10 rounded-full border-2 border-blue-400"
                style={{
                  left: `${center.x * 100}%`,
                  top: `${center.y * 100}%`,
                  width: `${radius * 200}%`,
                  height: `${radiusY * 200}%`,
                  transform: `translate(-50%, -50%) rotate(${ellipseAngleDeg}deg)`,
                }}
              />
            )}

            {markers.map((marker, index) => (
              <button
                key={marker.id}
                type="button"
                title={`Treffer ${
                  detectedShots.findIndex(
                    (item) => item.marker.id === marker.id
                  ) + 1 || index + 1
                }`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  draggingMarkerIdRef.current = marker.id;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (draggingMarkerIdRef.current !== marker.id) return;
                  event.preventDefault();
                  moveMarker(marker.id, event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  draggingMarkerIdRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onPointerCancel={() => {
                  draggingMarkerIdRef.current = null;
                }}
                className="absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full"
                style={{
                  left: `${marker.x * 100}%`,
                  top: `${marker.y * 100}%`,
                }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-xs font-bold text-white shadow">
                  {detectedShots.findIndex(
                    (item) => item.marker.id === marker.id
                  ) + 1 || index + 1}
                </span>
              </button>
            ))}
            </div>
            {center && radius && (
              <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded bg-amber-400 px-2 py-1 text-xs font-bold text-slate-900 shadow">
                OBEN
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRotationDeg((value) => value - 90)}
              disabled={!radius}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              ↶ 90°
            </button>
            <button
              type="button"
              onClick={() => setRotationDeg((value) => value + 90)}
              disabled={!radius}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              ↷ 90°
            </button>
            <button
              type="button"
              onClick={resetCalibration}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Ausrichtung neu setzen
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Anderes Foto
            </button>
          </div>

          {radius && (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Feinrotation: {rotationDeg}°
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotationDeg}
                onChange={(event) => setRotationDeg(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>
          )}

          {detectedShots.length > 0 && (
            <div className="mt-4 rounded-lg bg-white p-4">
              <p className="font-semibold text-slate-900">
                Erkannte Treffer: {detectedShots.length}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detectedShots.map(({ marker, shot }, index) => (
                  <button
                    key={marker.id}
                    type="button"
                    onClick={() =>
                      setMarkers((current) =>
                        current.filter((item) => item.id !== marker.id)
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                    title="Treffer entfernen"
                  >
                    {index + 1}: {shot.score} Punkte ×
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onImport(detectedShots.map((item) => item.shot))}
                className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
              >
                {detectedShots.length} Treffer übernehmen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
