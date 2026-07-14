/** Tide-Mapper: PEGELONLINE-DTOs -> TideOverview. Reine Funktionen, ohne HTTP. */

import type {
  PegelOnlineCurrentMeasurementDto,
  PegelOnlineMeasurementDto,
  PegelOnlineStateMnwMhw,
  PegelOnlineStationDto,
  PegelOnlineTimeseriesDto,
} from './pegelonline.dto';
import type { TideCurvePoint, TideLevelState, TideOverview, TideTrend } from './tide.model';

/** Darunter ist es Messrauschen bzw. der Kenterpunkt der Tide. */
const TREND_THRESHOLD_CM = 2;

const TREND_WINDOW_MINUTES = 15;

/** 'commented' heißt "Anmerkung vorhanden", nicht "hoch/niedrig" - daher wie 'unknown'. */
export function mapLevelState(state: PegelOnlineStateMnwMhw | undefined): TideLevelState {
  switch (state) {
    case 'low':
      return 'niedrig';
    case 'normal':
      return 'normal';
    case 'high':
      return 'hoch';
    case 'out-dated':
      return 'veraltet';
    case 'commented':
    case 'unknown':
    case undefined:
      return 'unbekannt';
  }
}

/**
 * Wasserstand von "cm über PNP" auf "m ü. NHN" umrechnen.
 *
 * Formel:   höhe_ü_NHN [m] = wasserstand [cm] / 100 + PNP [m ü. NHN]
 * Beispiel: 599 / 100 + (-5.004) = 0.986 m ü. NHN
 *
 * Ohne Messwert, ohne PNP oder wenn der PNP sich nicht auf NHN/NN bezieht,
 * gibt es KEIN Ergebnis - eine erfundene Höhe wäre schlimmer als keine.
 */
export function toMeterAboveSeaLevel(
  waterLevelCm: number | null,
  timeseries: PegelOnlineTimeseriesDto,
): number | null {
  const gaugeZero = timeseries.gaugeZero;

  if (waterLevelCm === null || gaugeZero === undefined) {
    return null;
  }

  if (!/NHN|NN/i.test(gaugeZero.unit)) {
    return null;
  }

  const meters = waterLevelCm / 100 + gaugeZero.value;
  return Math.round(meters * 100) / 100; // auf cm genau - mehr gibt die Quelle nicht her
}

/**
 * Kaputte Zeitstempel fliegen raus: `new Date('kaputt')` liefert NaN und würde
 * die gesamte Chart-Skalierung zerstören. Lieber ein Punkt weniger als keine Kurve.
 */
export function mapMeasurements(
  measurements: readonly PegelOnlineMeasurementDto[],
): readonly TideCurvePoint[] {
  return measurements
    .map((measurement) => ({
      timestamp: new Date(measurement.timestamp),
      waterLevelCm: measurement.value,
    }))
    .filter((point) => !Number.isNaN(point.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Dünnt die Kurve gleichmäßig auf höchstens `maxPoints` aus.
 *
 * WARUM: Die Zeitreihe löst minütlich auf, `?start=P1D` liefert ~1437 Punkte -
 * in einer ~600 px breiten Kachel gut zwei Punkte pro Pixel. 1437 -> 144 ergibt
 * ein 10-Minuten-Raster; eine Tidekurve ist darüber glatt genug, der flache
 * Scheitel eines Hoch-/Niedrigwassers geht nicht verloren.
 *
 * EHRLICH BLEIBT DAS, WEIL: Min, Max und Spanne kommen aus den ROHDATEN
 * (`curveExtremes`), nicht aus dieser Kurve. Die angezeigten Zahlen sind exakt,
 * nur die gezeichnete Linie ist vereinfacht.
 */
export function downsampleCurve(
  points: readonly TideCurvePoint[],
  maxPoints: number,
): readonly TideCurvePoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxPoints);
  const sampled: TideCurvePoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    const point = points[index];
    if (point !== undefined) {
      // Guard nur wegen noUncheckedIndexedAccess.
      sampled.push(point);
    }
  }

  // Der jüngste Messwert MUSS in die Kurve: Er trägt den Marker im Chart und
  // muss zum großen Zahlenwert daneben passen.
  const last = points.at(-1);
  const lastSampled = sampled.at(-1);
  if (last !== undefined && lastSampled !== last) {
    sampled.push(last);
  }

  return sampled;
}

/** Min/Max der GEMESSENEN Werte (Lücken werden übersprungen). */
export function curveExtremes(points: readonly TideCurvePoint[]): {
  min: number | null;
  max: number | null;
  range: number | null;
} {
  const values = points
    .map((point) => point.waterLevelCm)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return { min: null, max: null, range: null };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min };
}

/**
 * Trend wird ABGELEITET - PEGELONLINE liefert keinen, für eine Leitstelle ist
 * "läuft auf / läuft ab" aber die operative Information. Verglichen wird der
 * jüngste Wert mit dem jüngsten, der mindestens TREND_WINDOW_MINUTES älter ist.
 */
export function computeTrend(points: readonly TideCurvePoint[]): TideTrend {
  const measured = points.filter(
    (point): point is { timestamp: Date; waterLevelCm: number } => point.waterLevelCm !== null,
  );

  const latest = measured.at(-1);
  if (latest === undefined) {
    return 'unbekannt';
  }

  const windowStart = latest.timestamp.getTime() - TREND_WINDOW_MINUTES * 60_000;

  const reference = [...measured]
    .reverse()
    .find((point) => point.timestamp.getTime() <= windowStart);

  if (reference === undefined) {
    return 'unbekannt'; // Kurve deckt das Fenster nicht ab
  }

  const delta = latest.waterLevelCm - reference.waterLevelCm;

  if (delta > TREND_THRESHOLD_CM) {
    return 'steigend';
  }
  if (delta < -TREND_THRESHOLD_CM) {
    return 'fallend';
  }
  return 'gleichbleibend';
}

/**
 * Reihenfolge ist bewusst: Rohkurve normalisieren -> Kennzahlen aus der ROHKURVE
 * ziehen (exakt!) -> erst DANN ausdünnen (nur die Darstellung wird vereinfacht).
 */
export function mapToTideOverview(input: {
  readonly station: PegelOnlineStationDto;
  readonly timeseries: PegelOnlineTimeseriesDto;
  readonly current: PegelOnlineCurrentMeasurementDto;
  readonly measurements: readonly PegelOnlineMeasurementDto[];
  readonly maxCurvePoints: number;
}): TideOverview {
  const rawCurve = mapMeasurements(input.measurements);
  const extremes = curveExtremes(rawCurve);
  const trend = computeTrend(rawCurve);
  const sampledCurve = downsampleCurve(rawCurve, input.maxCurvePoints);

  const measuredAt = new Date(input.current.timestamp);

  return {
    stationName: input.station.longname,
    waterName: input.station.water.longname,

    currentWaterLevelCm: input.current.value,
    unit: input.timeseries.unit,
    // Kaputter Zeitstempel darf nicht als "Invalid Date" in die UI durchschlagen.
    measuredAt: Number.isNaN(measuredAt.getTime())
      ? (rawCurve.at(-1)?.timestamp ?? new Date())
      : measuredAt,
    levelState: mapLevelState(input.current.stateMnwMhw),
    trend,

    waterLevelMeterAboveSeaLevel: toMeterAboveSeaLevel(input.current.value, input.timeseries),
    gaugeZeroMeter: input.timeseries.gaugeZero?.value ?? null,

    curve: sampledCurve,
    curveMinCm: extremes.min,
    curveMaxCm: extremes.max,
    curveRangeCm: extremes.range,

    rawPointCount: rawCurve.length,
    sampledPointCount: sampledCurve.length,
  };
}
