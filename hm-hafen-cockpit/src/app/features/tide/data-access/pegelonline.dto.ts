/** PEGELONLINE-DTOs - das fremde Datenformat. DTO -> Mapper -> tide.model.ts -> Widget. */

/** Stammdaten einer Messstelle. GET /stations/{uuid}.json */
export interface PegelOnlineStationDto {
  readonly uuid: string;
  readonly number: string;
  readonly shortname: string;
  readonly longname: string;
  readonly km?: number;
  readonly agency?: string;
  readonly longitude?: number;
  readonly latitude?: number;
  readonly water: {
    readonly shortname: string;
    readonly longname: string;
  };
}

/**
 * Pegelnullpunkt (PNP) - die Bezugshöhe der Messwerte.
 *
 * PEGELONLINE liefert Wasserstände ÜBER PNP, nicht über NHN: "599 cm" heißt
 * NICHT 5,99 m über dem Meeresspiegel. St. Pauli: PNP = -5,004 m ü. NHN,
 * also 599 cm über PNP = ~0,99 m ü. NHN.
 */
export interface PegelOnlineGaugeZeroDto {
  /** z.B. "m. ue. NHN" */
  readonly unit: string;
  /** Höhe des PNP in der angegebenen Einheit (bei St. Pauli negativ). */
  readonly value: number;
  readonly validFrom?: string;
}

/** Metadaten der Zeitreihe "W" (Wasserstand). GET /stations/{uuid}/W.json */
export interface PegelOnlineTimeseriesDto {
  readonly shortname: string;
  readonly longname: string;
  readonly unit: string;
  /**
   * Messtakt in MINUTEN. Bei St. Pauli 1 - deshalb liefert `?start=P1D`
   * ~1437 Punkte, die für die Kachel ausgedünnt werden (tide.mapper.ts).
   */
  readonly equidistance?: number;
  /** Fehlt bei manchen Zeitreihen. */
  readonly gaugeZero?: PegelOnlineGaugeZeroDto;
}

/**
 * Bewertung gegen MNW/MHW (mittleres Niedrig-/Hochwasser).
 * 'unknown' ist der HÄUFIGE Fall, nicht der Ausnahmefall.
 */
export type PegelOnlineStateMnwMhw =
  | 'low'
  | 'normal'
  | 'high'
  | 'unknown'
  | 'commented'
  | 'out-dated';

/** Analog, bezogen auf NSW/HSW (niedrigster/höchster schiffbarer Wasserstand). */
export type PegelOnlineStateNswHsw = 'normal' | 'high' | 'unknown' | 'commented' | 'out-dated';

/** Aktueller Messwert. GET /stations/{uuid}/W/currentmeasurement.json */
export interface PegelOnlineCurrentMeasurementDto {
  /** ISO-8601 mit Offset (+02:00), also eindeutig. */
  readonly timestamp: string;
  /** `null` = Sensorausfall/Wartung, NICHT 0 cm. */
  readonly value: number | null;
  readonly stateMnwMhw?: PegelOnlineStateMnwMhw;
  readonly stateNswHsw?: PegelOnlineStateNswHsw;
}

/** Ein Punkt der Messreihe. GET /stations/{uuid}/W/measurements.json?start=P1D */
export interface PegelOnlineMeasurementDto {
  readonly timestamp: string;
  /** `null` = Messlücke, NICHT 0 cm. */
  readonly value: number | null;
}
