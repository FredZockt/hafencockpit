/**
 * BRIGHT SKY /current_weather - DTOs.
 *
 * FALLE 1 - Feldnamen: /current_weather hat KEINE Felder wind_speed,
 * wind_gust_speed, wind_direction. Die gehören zu /weather (stündlich). Hier
 * heißen sie wind_speed_10/30/60, wind_direction_10/30/60 usw. Wer die falschen
 * Namen deklariert, bekommt zur Laufzeit `undefined` und ein Widget, das
 * dauerhaft "–" anzeigt, ohne dass je ein Fehler auftritt.
 *
 * FALLE 2 - Einheiten: Bright Sky liefert mit `units=dwd` (Default, und wir
 * fragen es explizit an) bereits °C und km/h. Eine Umrechnung `* 3.6` wäre also
 * FALSCH - nur `units=si` liefert m/s und Kelvin. Live, selbe Station:
 * dwd wind_speed_10 = 16.9 km/h, si = 4.7 m/s. `16.9 * 3.6` hätte 61 km/h
 * angezeigt: in einer Leitstelle der Unterschied zwischen "ruhig" und "steife Brise".
 */

/**
 * Wetterzustand. Von Bright Sky aus Rohfeldern ABGELEITET ("best effort"),
 * keine Messung - und kann `null` sein.
 */
export type BrightSkyCondition =
  | 'dry'
  | 'fog'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'hail'
  | 'thunderstorm'
  | null;

/** Ein Messsatz von /current_weather. Nur die Felder, die wir wirklich verwenden. */
export interface BrightSkyCurrentWeatherDto {
  /** ISO-8601 mit Offset (dank tz-Parameter in lokaler Zeit). */
  readonly timestamp: string;

  /** Bindeglied zu `sources`. */
  readonly source_id: number;

  /** Grad Celsius (units=dwd). */
  readonly temperature: number | null;

  readonly condition: BrightSkyCondition;
  readonly icon: string | null;

  /* Wind: 10-Minuten-Mittel (bevorzugt). Geschwindigkeiten in km/h,
   * Richtung in Grad (0 = Nord, 90 = Ost). */
  readonly wind_speed_10: number | null;
  readonly wind_direction_10: number | null;
  readonly wind_gust_speed_10: number | null;

  /* Rückfallebenen: Nicht jede Stationsart liefert die 10-Minuten-Werte. */
  readonly wind_speed_30: number | null;
  readonly wind_direction_30: number | null;
  readonly wind_gust_speed_30: number | null;

  readonly wind_speed_60: number | null;
  readonly wind_direction_60: number | null;
  readonly wind_gust_speed_60: number | null;
}

/** Die Messstation, aus der die Werte stammen - der Beleg für die Herkunft. */
export interface BrightSkySourceDto {
  readonly id: number;
  readonly dwd_station_id: string | null;
  readonly wmo_station_id: string | null;
  readonly station_name: string | null;
  /** z.B. "synop" (Stationsmeldung), "current" oder "forecast". */
  readonly observation_type: string;
  /** Entfernung zum angefragten Punkt in METERN. */
  readonly distance: number;
  readonly lat: number;
  readonly lon: number;
  readonly height: number;
}

export interface BrightSkyCurrentWeatherResponseDto {
  readonly weather: BrightSkyCurrentWeatherDto;
  readonly sources: readonly BrightSkySourceDto[];
}
