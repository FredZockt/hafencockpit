/** Schiffsverkehr - Domain-Modell (unser Format, frei von AIS-Codes). */

/** Aus dem AIS-Typcode übersetzt. */
export type ShipType =
  | 'Frachter'
  | 'Tanker'
  | 'Passagierschiff'
  | 'Schlepper'
  | 'Lotsenboot'
  | 'Fischerei'
  | 'Segler'
  | 'Sonstige'
  | 'unbekannt';

/** Aus dem AIS-Statuscode übersetzt. */
export type NavStatus =
  | 'in Fahrt'
  | 'vor Anker'
  | 'festgemacht'
  | 'manövrierbehindert'
  | 'auf Grund'
  | 'unbekannt';

/**
 * Fahrtrichtung relativ zum Hafen - abgeleitet, AIS liefert das nicht.
 * Für eine Leitstelle ist genau das die operative Information.
 */
export type ShipDirection = 'einlaufend' | 'auslaufend' | 'liegt' | 'unbekannt';

export interface ShipMovement {
  /** MMSI als String - stabile ID für @for(track). */
  readonly id: string;
  readonly name: string;
  readonly callSign: string | null;

  readonly shipType: ShipType;
  readonly navStatus: NavStatus;
  readonly direction: ShipDirection;

  /** Knoten. `null` bei AIS-Sentinel 102.3 - NICHT 0. */
  readonly speedKn: number | null;
  /** Grad. `null` bei AIS-Sentinel 360. */
  readonly courseDeg: number | null;

  /** Luftlinie zum Hafenstandort. */
  readonly distanceKm: number;

  /** Ziel, so wie es die Brücke eingetippt hat (Freitext, unbereinigt). */
  readonly destinationRaw: string | null;
  /** `null`, wenn die AIS-ETA unbrauchbar ist (kein Jahr, Nullwerte, Unsinn). */
  readonly eta: Date | null;

  /** Alter des AIS-Pakets - ein Schiff kann "stehen", weil es nicht mehr sendet. */
  readonly lastSeenAt: Date;
}

export interface ShipTrafficOverview {
  /** Nach Entfernung zum Hafen aufsteigend sortiert. */
  readonly vessels: readonly ShipMovement[];

  readonly inboundCount: number;
  readonly outboundCount: number;

  /** Suchradius um den Hafenstandort (aus der Config). */
  readonly radiusKm: number;

  /**
   * Wie viele Meldungen verworfen wurden (keine gültige Position, außerhalb des
   * Radius). Wird angezeigt - "12 Schiffe" darf nicht heimlich heißen, dass 30
   * unter den Tisch gefallen sind.
   */
  readonly discardedCount: number;

  /** Zeitpunkt des Snapshots laut Quelle. */
  readonly generatedAt: Date;
}
