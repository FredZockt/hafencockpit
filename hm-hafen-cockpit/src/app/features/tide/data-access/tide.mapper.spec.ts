import {
  computeTrend,
  curveExtremes,
  downsampleCurve,
  mapLevelState,
  mapMeasurements,
  mapToTideOverview,
  toMeterAboveSeaLevel,
} from './tide.mapper';
import type {
  PegelOnlineCurrentMeasurementDto,
  PegelOnlineMeasurementDto,
  PegelOnlineStationDto,
  PegelOnlineTimeseriesDto,
} from './pegelonline.dto';

/* Fixtures = echte PEGELONLINE-Antworten vom 2026-07-14 (Pegel HAMBURG ST. PAULI). */

const STATION: PegelOnlineStationDto = {
  uuid: 'd488c5cc-4de9-4631-8ce1-0db0e700b546',
  number: '5952020',
  shortname: 'ST.PAULI',
  longname: 'HAMBURG ST. PAULI',
  water: { shortname: 'ELBE', longname: 'ELBE' },
};

const TIMESERIES: PegelOnlineTimeseriesDto = {
  shortname: 'W',
  longname: 'WASSERSTAND ROHDATEN',
  unit: 'cm',
  equidistance: 1,
  gaugeZero: { unit: 'm. ü. NHN', value: -5.004, validFrom: '2019-11-01' },
};

const CURRENT: PegelOnlineCurrentMeasurementDto = {
  timestamp: '2026-07-14T14:32:00+02:00',
  value: 599.0,
  stateMnwMhw: 'unknown',
  stateNswHsw: 'unknown',
};

/** Baut eine synthetische Messreihe im 1-Minuten-Raster (wie die echte API). */
function buildMeasurements(values: readonly (number | null)[]): PegelOnlineMeasurementDto[] {
  const start = new Date('2026-07-14T12:00:00+02:00').getTime();
  return values.map((value, index) => ({
    timestamp: new Date(start + index * 60_000).toISOString(),
    value,
  }));
}

describe('mapLevelState', () => {
  it('übersetzt die API-Zustände ins Domain-Modell', () => {
    expect(mapLevelState('low')).toBe('niedrig');
    expect(mapLevelState('normal')).toBe('normal');
    expect(mapLevelState('high')).toBe('hoch');
    expect(mapLevelState('out-dated')).toBe('veraltet');
  });

  it('behandelt "unknown", "commented" und fehlende Angabe als unbekannt', () => {
    // 'unknown' ist der häufige Fall (live liefert St. Pauli genau das) und darf
    // weder als Fehler noch als "normal" durchgehen.
    expect(mapLevelState('unknown')).toBe('unbekannt');
    expect(mapLevelState('commented')).toBe('unbekannt');
    expect(mapLevelState(undefined)).toBe('unbekannt');
  });
});

describe('toMeterAboveSeaLevel', () => {
  it('rechnet cm über Pegelnull korrekt in m ü. NHN um', () => {
    // 599 cm sind NICHT 5,99 m über dem Meeresspiegel: 599/100 + (-5.004) = 0,99.
    expect(toMeterAboveSeaLevel(599, TIMESERIES)).toBe(0.99);
  });

  it('liefert null ohne Messwert', () => {
    expect(toMeterAboveSeaLevel(null, TIMESERIES)).toBeNull();
  });

  it('liefert null, wenn die API keinen Pegelnullpunkt mitliefert', () => {
    // Der Key wird WEGGELASSEN, nicht auf `undefined` gesetzt - JSON kennt kein
    // `undefined`. Genau das erzwingt `exactOptionalPropertyTypes: true`.
    const { gaugeZero: _ignored, ...withoutGaugeZero } = TIMESERIES;

    // Lieber keine Höhe als eine erfundene.
    expect(toMeterAboveSeaLevel(599, withoutGaugeZero satisfies PegelOnlineTimeseriesDto)).toBeNull();
  });

  it('liefert null, wenn der Pegelnullpunkt einen fremden Höhenbezug hat', () => {
    // Ein PNP in einem anderen Bezugssystem darf nicht als "ü. NHN" verkauft werden.
    const foreignDatum: PegelOnlineTimeseriesDto = {
      ...TIMESERIES,
      gaugeZero: { unit: 'm ue. Adria', value: -5.004 },
    };
    expect(toMeterAboveSeaLevel(599, foreignDatum)).toBeNull();
  });
});

describe('mapMeasurements', () => {
  it('wandelt Zeitstempel in Date-Objekte und sortiert aufsteigend', () => {
    const points = mapMeasurements([
      { timestamp: '2026-07-14T12:05:00+02:00', value: 610 },
      { timestamp: '2026-07-14T12:00:00+02:00', value: 600 },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]?.waterLevelCm).toBe(600);
    expect(points[1]?.waterLevelCm).toBe(610);
    expect(points[0]?.timestamp.getTime()).toBeLessThan(points[1]!.timestamp.getTime());
  });

  it('wirft Punkte mit unbrauchbarem Zeitstempel weg', () => {
    // Ein einziges "Invalid Date" würde die Chart-Skalierung auf NaN ziehen.
    const points = mapMeasurements([
      { timestamp: 'kaputt', value: 600 },
      { timestamp: '2026-07-14T12:00:00+02:00', value: 610 },
    ]);

    expect(points).toHaveLength(1);
    expect(points[0]?.waterLevelCm).toBe(610);
  });

  it('behält Messlücken (null) als Lücken - nicht als 0', () => {
    const points = mapMeasurements([{ timestamp: '2026-07-14T12:00:00+02:00', value: null }]);
    expect(points[0]?.waterLevelCm).toBeNull();
  });
});

describe('downsampleCurve', () => {
  it('dünnt die realen ~1437 Punkte auf das konfigurierte Maximum aus', () => {
    const raw = mapMeasurements(buildMeasurements(Array.from({ length: 1437 }, (_, i) => 500 + i)));

    const sampled = downsampleCurve(raw, 144);

    // Schritt ceil(1437/144) = 10 -> 144 Punkte + evtl. der angehängte letzte.
    expect(sampled.length).toBeLessThanOrEqual(145);
    expect(sampled.length).toBeGreaterThan(100);
  });

  it('enthält IMMER den jüngsten Messwert', () => {
    // Der Chart-Marker sitzt auf dem letzten Punkt und muss zur großen Zahl
    // daneben passen - sonst widerspricht die Kachel sich selbst.
    const raw = mapMeasurements(buildMeasurements(Array.from({ length: 1437 }, (_, i) => 500 + i)));

    const sampled = downsampleCurve(raw, 144);

    expect(sampled.at(-1)?.waterLevelCm).toBe(raw.at(-1)?.waterLevelCm);
    expect(sampled.at(-1)?.waterLevelCm).toBe(500 + 1436);
  });

  it('lässt kurze Kurven unverändert', () => {
    const raw = mapMeasurements(buildMeasurements([600, 610, 620]));
    expect(downsampleCurve(raw, 144)).toHaveLength(3);
  });
});

describe('curveExtremes', () => {
  it('berechnet Min, Max und Spanne aus den GEMESSENEN Werten', () => {
    const points = mapMeasurements(buildMeasurements([620, 480, null, 700, 550]));

    const extremes = curveExtremes(points);

    expect(extremes.min).toBe(480);
    expect(extremes.max).toBe(700);
    expect(extremes.range).toBe(220);
  });

  it('liefert null, wenn es gar keinen Messwert gibt', () => {
    const points = mapMeasurements(buildMeasurements([null, null]));
    expect(curveExtremes(points)).toEqual({ min: null, max: null, range: null });
  });
});

describe('computeTrend', () => {
  it('erkennt steigendes Wasser (Flut)', () => {
    const points = mapMeasurements(buildMeasurements(Array.from({ length: 30 }, (_, i) => 500 + i)));
    expect(computeTrend(points)).toBe('steigend');
  });

  it('erkennt fallendes Wasser (Ebbe)', () => {
    const points = mapMeasurements(buildMeasurements(Array.from({ length: 30 }, (_, i) => 700 - i)));
    expect(computeTrend(points)).toBe('fallend');
  });

  it('meldet "gleichbleibend" bei Messrauschen unterhalb der Schwelle', () => {
    // +/- 1 cm über 30 Minuten ist der Kenterpunkt der Tide, keine Bewegung.
    const values = Array.from({ length: 30 }, (_, i) => 600 + (i % 2));
    const points = mapMeasurements(buildMeasurements(values));
    expect(computeTrend(points)).toBe('gleichbleibend');
  });

  it('meldet "unbekannt", wenn die Kurve das Zeitfenster nicht abdeckt', () => {
    // Nur 5 Minuten Daten -> keine Aussage über 15 Minuten möglich.
    const points = mapMeasurements(buildMeasurements([600, 601, 602, 603, 604]));
    expect(computeTrend(points)).toBe('unbekannt');
  });

  it('meldet "unbekannt" ohne jeden Messwert', () => {
    expect(computeTrend([])).toBe('unbekannt');
  });
});

describe('mapToTideOverview', () => {
  it('setzt die vier API-Antworten zum Domain-Modell zusammen', () => {
    const measurements = buildMeasurements(Array.from({ length: 1437 }, (_, i) => 500 + (i % 200)));

    const overview = mapToTideOverview({
      station: STATION,
      timeseries: TIMESERIES,
      current: CURRENT,
      measurements,
      maxCurvePoints: 144,
    });

    expect(overview.stationName).toBe('HAMBURG ST. PAULI');
    expect(overview.waterName).toBe('ELBE');

    expect(overview.currentWaterLevelCm).toBe(599);
    expect(overview.unit).toBe('cm');

    expect(overview.waterLevelMeterAboveSeaLevel).toBe(0.99);
    expect(overview.gaugeZeroMeter).toBe(-5.004);

    // Transparenz über die Aufbereitung: Rohpunkte vs. dargestellte Punkte.
    expect(overview.rawPointCount).toBe(1437);
    expect(overview.sampledPointCount).toBeLessThan(overview.rawPointCount);
  });

  it('berechnet Min/Max aus den ROHDATEN, nicht aus der ausgedünnten Kurve', () => {
    // Der Extremwert (999) auf Index 3 fällt beim Ausdünnen (Schritt 10) dem
    // Raster zum Opfer. Die angezeigte Zahl behauptet "Höchster Stand (24 h)" -
    // sie muss ihn trotzdem kennen.
    const values = Array.from({ length: 1437 }, () => 600);
    values[3] = 999;

    const overview = mapToTideOverview({
      station: STATION,
      timeseries: TIMESERIES,
      current: CURRENT,
      measurements: buildMeasurements(values),
      maxCurvePoints: 144,
    });

    expect(overview.curveMaxCm).toBe(999);
    // Gegenprobe: In der gezeichneten Kurve taucht der Punkt nicht auf.
    expect(overview.curve.some((point) => point.waterLevelCm === 999)).toBe(false);
  });

  it('fängt einen kaputten Zeitstempel des aktuellen Messwerts ab', () => {
    const overview = mapToTideOverview({
      station: STATION,
      timeseries: TIMESERIES,
      current: { ...CURRENT, timestamp: 'nicht-datum' },
      measurements: buildMeasurements([600, 610]),
      maxCurvePoints: 144,
    });

    expect(Number.isNaN(overview.measuredAt.getTime())).toBe(false);
  });

  it('behandelt einen fehlenden Messwert (null) korrekt', () => {
    const overview = mapToTideOverview({
      station: STATION,
      timeseries: TIMESERIES,
      current: { ...CURRENT, value: null },
      measurements: buildMeasurements([600]),
      maxCurvePoints: 144,
    });

    expect(overview.currentWaterLevelCm).toBeNull();
    // Ohne Messwert keine NHN-Höhe - und keine erfundene 0.
    expect(overview.waterLevelMeterAboveSeaLevel).toBeNull();
  });
});
