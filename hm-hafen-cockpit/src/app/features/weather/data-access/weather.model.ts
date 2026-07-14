/** Wetter - Domain-Modell. Die Einheit steckt im Feldnamen (`windSpeedKmh`). */

/** Wetterlage in deutschem Klartext (aus Bright Skys `condition` gemappt). */
export type WeatherCondition =
  | 'trocken'
  | 'Nebel'
  | 'Regen'
  | 'Schneeregen'
  | 'Schnee'
  | 'Hagel'
  | 'Gewitter'
  | 'unbekannt';

/** 16-teilige Kompassrose - "NNO" ist für eine Leitstelle verständlich, "23°" nicht. */
export type CompassDirection =
  | 'N'
  | 'NNO'
  | 'NO'
  | 'ONO'
  | 'O'
  | 'OSO'
  | 'SO'
  | 'SSO'
  | 'S'
  | 'SSW'
  | 'SW'
  | 'WSW'
  | 'W'
  | 'WNW'
  | 'NW'
  | 'NNW';

export interface WeatherSource {
  readonly stationName: string | null;
  /** KILOMETER (API liefert Meter). Live ~9,1 km - der Wind wird nicht an der Kaikante gemessen. */
  readonly distanceKm: number | null;
  /** z.B. "synop" - Art der Beobachtung. */
  readonly observationType: string | null;
  readonly dwdStationId: string | null;
}

export interface HarborWeather {
  /** Grad Celsius. */
  readonly temperatureCelsius: number | null;

  readonly condition: WeatherCondition;
  /** Icon-Alias von Bright Sky. Rein dekorativ. */
  readonly icon: string | null;

  /** km/h - OHNE Umrechnung übernommen (units=dwd, siehe DTO-Kopfkommentar). */
  readonly windSpeedKmh: number | null;
  readonly windGustKmh: number | null;
  /** Windrichtung in Grad (0 = Nord). */
  readonly windDirectionDegrees: number | null;
  readonly windDirection: CompassDirection | null;
  /** Aus km/h abgeleitet - Bright Sky liefert kein Beaufort. */
  readonly beaufort: number | null;

  /** Zeitpunkt der Messung, nicht des Abrufs. */
  readonly measuredAt: Date;

  /** Mittelungszeitraum der Windwerte: 10, 30 oder 60 min. */
  readonly windAveragingMinutes: 10 | 30 | 60 | null;

  readonly source: WeatherSource;
}
