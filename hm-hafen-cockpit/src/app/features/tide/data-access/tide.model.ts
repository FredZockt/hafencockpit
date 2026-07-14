/** Tide - Domain-Modell (unser Format, unabhängig von PEGELONLINE). */

/** Unsere Fassung von `stateMnwMhw`. 'unbekannt' ist ein völlig normaler Zustand. */
export type TideLevelState = 'niedrig' | 'normal' | 'hoch' | 'unbekannt' | 'veraltet';

/** Tendenz - aus dem Kurvenverlauf abgeleitet, die API liefert so etwas nicht. */
export type TideTrend = 'steigend' | 'fallend' | 'gleichbleibend' | 'unbekannt';

export interface TideCurvePoint {
  readonly timestamp: Date;
  /** `null` = Messlücke. Das Chart bricht die Linie dort auf. */
  readonly waterLevelCm: number | null;
}

export interface TideOverview {
  readonly stationName: string;
  readonly waterName: string;

  /** Wasserstand über Pegelnull (PNP). `null` bei Sensorausfall. */
  readonly currentWaterLevelCm: number | null;
  readonly unit: string;
  readonly measuredAt: Date;
  readonly levelState: TideLevelState;
  readonly trend: TideTrend;

  /** Derselbe Wasserstand in m ü. NHN. `null`, wenn die API keinen PNP liefert. */
  readonly waterLevelMeterAboveSeaLevel: number | null;
  /** Der PNP selbst, z.B. -5.004 (m ü. NHN). */
  readonly gaugeZeroMeter: number | null;

  /** Bereits ausgedünnte Kurve (siehe Mapper). Zeitlich aufsteigend. */
  readonly curve: readonly TideCurvePoint[];
  readonly curveMinCm: number | null;
  readonly curveMaxCm: number | null;
  /** Bewusst NICHT "Tidenhub": nur die 24-h-Spanne, nicht die amtliche Differenz Thw/Tnw. */
  readonly curveRangeCm: number | null;

  readonly rawPointCount: number;
  readonly sampledPointCount: number;
}
