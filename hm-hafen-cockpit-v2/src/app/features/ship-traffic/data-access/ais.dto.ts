/**
 * AIS-DTOs - das fremde Datenformat.
 *
 * WICHTIG: Der Proxy ist bewusst DUMM. Er hält den API-Key, bündelt die
 * WebSocket-Verbindung und filtert auf die Bounding-Box - aber er INTERPRETIERT
 * nichts. Die AIS-Semantik (Sentinel-Werte, Zahlencodes, ETA ohne Jahr) wird an
 * genau EINER Stelle ausgewertet: in ship-traffic.mapper.ts. Sonst läge die
 * Fachlogik in zwei Codebasen und liefe auseinander.
 *
 * ACHTUNG - AIS ist voller Fallstricke. "Unbekannt" wird nicht als null kodiert,
 * sondern als Zahl:
 *
 *   sog          102.3  = unbekannt   (NICHT 102,3 Knoten!)
 *   cog          360.0  = unbekannt
 *   trueHeading  511    = unbekannt
 *   latitude     91     = unbekannt
 *   longitude    181    = unbekannt
 *
 * Wer das nicht abfängt, zeigt ein Schiff mit 102 Knoten am Nordpol an.
 * Diese Werte MÜSSEN gegen den konkret gewählten Anbieter verifiziert werden -
 * manche normalisieren bereits, manche reichen die Rohwerte durch.
 */

/** ETA laut AIS: Monat/Tag/Stunde/Minute - OHNE Jahr. 0 bedeutet "nicht gesetzt". */
export interface AisEtaDto {
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface AisVesselDto {
  /** Die stabile ID. Schiffsnamen sind weder eindeutig noch unveränderlich. */
  readonly mmsi: number;

  readonly name: string | null;
  readonly callSign: string | null;

  /** AIS-Typcode 0..99 (70-79 Fracht, 80-89 Tanker, ...). Kein Klartext. */
  readonly shipType: number | null;
  /** AIS-Statuscode 0..15 (0 = in Fahrt, 1 = vor Anker, 5 = festgemacht, ...). */
  readonly navigationalStatus: number | null;

  /** 91 = unbekannt. */
  readonly latitude: number;
  /** 181 = unbekannt. */
  readonly longitude: number;

  /** Speed over Ground in Knoten. 102.3 = unbekannt. */
  readonly sog: number | null;
  /** Course over Ground in Grad. 360.0 = unbekannt. */
  readonly cog: number | null;
  /** 511 = unbekannt. */
  readonly trueHeading: number | null;

  /** FREITEXT, von der Brücke eingetippt: "HAMBURG", "DEHAM", "HH", "HAMBURG,GER". */
  readonly destination: string | null;

  readonly eta: AisEtaDto | null;

  /** Zeitpunkt des AIS-Pakets (ISO 8601). Kann deutlich älter sein als der Abruf. */
  readonly timeUtc: string;
}

/** Was unser Proxy auf GET /ships liefert. */
export interface AisSnapshotDto {
  readonly generatedAt: string;
  readonly vessels: readonly AisVesselDto[];
}
