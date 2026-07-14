/**
 * Zentrale App-Konfiguration: Standort, Stations-UUIDs, Refresh-Takt.
 * Per InjectionToken bereitgestellt, damit Tests eine abweichende Config injizieren können.
 */

import { InjectionToken } from '@angular/core';

/** Geografische Position (WGS84, Dezimalgrad). */
export interface GeoLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
}

/** ISO-8601-Dauer, die PEGELONLINE als `start`-Parameter erwartet. */
export type PegelOnlineCurvePeriod = 'P1D' | 'P2D' | 'P7D';

/**
 * Einheitensystem von Bright Sky.
 * 'dwd' liefert Grad Celsius und Wind in km/h (NICHT m/s), 'si' Kelvin und m/s.
 * Wir fragen 'dwd' explizit an, damit im Mapper keine Umrechnung nötig ist und
 * ein geänderter API-Default uns nicht trifft.
 */
export type BrightSkyUnitSystem = 'dwd' | 'si';

export interface PegelOnlineConfig {
  readonly baseUrl: string;

  /** UUID des Pegels "HAMBURG ST. PAULI" - stabil, im Gegensatz zu Name/Nummer. */
  readonly stationUuid: string;

  /** Fallback-Suche, falls die UUID ins Leere läuft (HTTP 404). */
  readonly stationFuzzyId: string;
  readonly stationLongnameContains: string;

  readonly curvePeriod: PegelOnlineCurvePeriod;

  /**
   * Die Zeitreihe W löst minütlich auf: P1D liefert real ~1437 Punkte. Für eine
   * Kachel von ~600px ist das Sub-Pixel-Rauschen - der Mapper reduziert darauf.
   */
  readonly curveMaxPoints: number;
}

export interface BrightSkyConfig {
  readonly baseUrl: string;
  readonly units: BrightSkyUnitSystem;
  /** IANA-Zeitzone; ohne diesen Parameter liefert Bright Sky UTC. */
  readonly timezone: string;
}

export interface HarborCockpitConfig {
  readonly harborLocation: GeoLocation;
  readonly pegelOnline: PegelOnlineConfig;
  readonly brightSky: BrightSkyConfig;

  /**
   * EIN Refresh-Intervall für ALLE Kacheln: nur so beschreiben zwei nebeneinander
   * stehende Zahlen garantiert denselben Zeitpunkt, und der Countdown in der
   * Kopfzeile gilt für das gesamte Dashboard. 60 s richtet sich nach der
   * schnellsten Quelle (Pegel: minütliche Rohdaten, Cache-Control max-age=46).
   */
  readonly refreshIntervalMs: number;
}

/** Default für den Standort Hamburg. */
export const DEFAULT_HARBOR_COCKPIT_CONFIG: HarborCockpitConfig = {
  harborLocation: {
    latitude: 53.5511,
    longitude: 9.9937,
    label: 'Hamburg',
  },
  pegelOnline: {
    baseUrl: 'https://www.pegelonline.wsv.de/webservices/rest-api/v2',
    stationUuid: 'd488c5cc-4de9-4631-8ce1-0db0e700b546',
    stationFuzzyId: 'hamburg',
    stationLongnameContains: 'HAMBURG ST. PAULI',
    curvePeriod: 'P1D',
    curveMaxPoints: 144, // 24 h bei ~10-Minuten-Raster
  },
  brightSky: {
    baseUrl: 'https://api.brightsky.dev',
    units: 'dwd',
    timezone: 'Europe/Berlin',
  },
  refreshIntervalMs: 60_000,
};

export const HARBOR_COCKPIT_CONFIG = new InjectionToken<HarborCockpitConfig>(
  'HARBOR_COCKPIT_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEFAULT_HARBOR_COCKPIT_CONFIG,
  },
);
