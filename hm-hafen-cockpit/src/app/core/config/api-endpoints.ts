/**
 * Die einzige Stelle, an der API-URLs gebaut werden.
 * Quellen: PEGELONLINE (WSV) und Bright Sky (DWD-Open-Data als CORS-fähiges JSON).
 * Beide ohne API-Key und mit "Access-Control-Allow-Origin: *" - kein Proxy nötig.
 */

import { HttpParams } from '@angular/common/http';
import type { GeoLocation, HarborCockpitConfig } from './app-config';

/* PEGELONLINE */

/** Stationsstammdaten: liefert `longname` und `water.longname` für die Herkunftsangabe. */
export function pegelOnlineStationUrl(config: HarborCockpitConfig, stationUuid: string): string {
  return `${config.pegelOnline.baseUrl}/stations/${encodeURIComponent(stationUuid)}.json`;
}

/** Fuzzy-Suche - nur Fallback, falls die UUID ins Leere läuft. */
export function pegelOnlineStationSearchUrl(config: HarborCockpitConfig): string {
  const params = new HttpParams().set('fuzzyId', config.pegelOnline.stationFuzzyId);
  return `${config.pegelOnline.baseUrl}/stations.json?${params.toString()}`;
}

/**
 * Metadaten der Zeitreihe W (Wasserstand).
 *
 * Wird mitgeladen, weil PEGELONLINE-Wasserstände Werte ÜBER PEGELNULLPUNKT (PNP)
 * sind, nicht über NHN. Erst `gaugeZero` (St. Pauli: -5,004 m ü. NHN) erlaubt die
 * Umrechnung; ohne diesen Bezug ist die Zahl "599" für eine Leitstelle wertlos.
 * `unit` ist die amtliche Einheit - wir zeigen sie an, statt sie zu raten.
 */
export function pegelOnlineWaterLevelTimeseriesUrl(
  config: HarborCockpitConfig,
  stationUuid: string,
): string {
  return `${config.pegelOnline.baseUrl}/stations/${encodeURIComponent(stationUuid)}/W.json`;
}

/** Aktueller Messwert der Zeitreihe W. */
export function pegelOnlineCurrentMeasurementUrl(
  config: HarborCockpitConfig,
  stationUuid: string,
): string {
  return `${config.pegelOnline.baseUrl}/stations/${encodeURIComponent(stationUuid)}/W/currentmeasurement.json`;
}

/** Messreihe der Zeitreihe W (= Wasserstandskurve). `start` ist eine ISO-8601-Dauer relativ zu "jetzt". */
export function pegelOnlineMeasurementsUrl(
  config: HarborCockpitConfig,
  stationUuid: string,
): string {
  const params = new HttpParams().set('start', config.pegelOnline.curvePeriod);
  return `${config.pegelOnline.baseUrl}/stations/${encodeURIComponent(stationUuid)}/W/measurements.json?${params.toString()}`;
}

/* BRIGHT SKY */

/** `tz` sorgt für lokale Zeitstempel statt UTC. */
function brightSkyLocationParams(location: GeoLocation, timezone: string): HttpParams {
  return new HttpParams()
    .set('lat', location.latitude)
    .set('lon', location.longitude)
    .set('tz', timezone);
}

/**
 * Aktuelles Wetter der nächstgelegenen DWD-Station.
 *
 * ACHTUNG: `/current_weather` hat ANDERE Feldnamen als `/weather`:
 *   /weather         -> wind_speed, wind_direction, wind_gust_speed
 *   /current_weather -> wind_speed_10 / _30 / _60, wind_direction_10 / ...
 */
export function brightSkyCurrentWeatherUrl(config: HarborCockpitConfig): string {
  const params = brightSkyLocationParams(
    config.harborLocation,
    config.brightSky.timezone,
  ).set('units', config.brightSky.units);

  return `${config.brightSky.baseUrl}/current_weather?${params.toString()}`;
}

/**
 * Amtliche DWD-Warnungen für die Warnzelle des Standorts.
 *
 * Ein leeres `alerts`-Array ist der NORMALFALL, kein Fehler -> Empty-State,
 * nicht Error-State. `units` ist bewusst nicht gesetzt: /alerts liefert keine Messwerte.
 */
export function brightSkyAlertsUrl(config: HarborCockpitConfig): string {
  const params = brightSkyLocationParams(config.harborLocation, config.brightSky.timezone);
  return `${config.brightSky.baseUrl}/alerts?${params.toString()}`;
}
