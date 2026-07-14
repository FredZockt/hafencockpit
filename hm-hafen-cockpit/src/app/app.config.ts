/**
 * Die einzige Stelle, an der die abstrakten VERTRÄGE (TideRepository, WeatherRepository, ...) auf
 * ihre konkreten IMPLEMENTIERUNGEN treffen. Umstellen auf Mock-Daten, einen Backend-Proxy oder
 * eine andere Wetter-API heißt: HIER eine Zeile ändern. Kein Widget, kein Template, kein Test.
 */

import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { DashboardLayoutRepository } from './core/layout/dashboard-layout.repository';
import { LocalStorageDashboardLayoutRepository } from './core/layout/local-storage-dashboard-layout.repository';

import { TideRepository } from './features/tide/data-access/tide.repository';
import { PegelOnlineTideRepository } from './features/tide/data-access/pegelonline-tide.repository';

import { WeatherRepository } from './features/weather/data-access/weather.repository';
import { BrightSkyWeatherRepository } from './features/weather/data-access/brightsky-weather.repository';

import { WarningsRepository } from './features/warnings/data-access/warnings.repository';
import { BrightSkyWarningsRepository } from './features/warnings/data-access/brightsky-warnings.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    /*
     * `withFetch()`: Beide Datenquellen senden `Access-Control-Allow-Origin: *` - wir brauchen
     * weder Cookies noch einen Proxy, nur schlanke Cross-Origin-GETs.
     *
     * BEWUSST KEIN Fehler-Interceptor: Die Fehlerbehandlung sitzt in den Repositories bzw. in
     * `mapUnknownError`. Ein Interceptor kennt den fachlichen Kontext nicht (ist ein 404 hier
     * "Station verschwunden" oder "Warnzelle unbekannt"?).
     */
    provideHttpClient(withFetch()),

    // Persistenz: Dass hinter dem Layout-Store localStorage steckt, steht nur in dieser Zeile.
    {
      provide: DashboardLayoutRepository,
      useClass: LocalStorageDashboardLayoutRepository,
    },

    // Links der Vertrag (den die Widgets kennen), rechts die Implementierung (die sie NICHT kennen).
    { provide: TideRepository, useClass: PegelOnlineTideRepository },
    { provide: WeatherRepository, useClass: BrightSkyWeatherRepository },
    { provide: WarningsRepository, useClass: BrightSkyWarningsRepository },

    /*
     * HARBOR_COCKPIT_CONFIG fehlt hier absichtlich: Das InjectionToken bringt seine eigene
     * Factory mit (providedIn: 'root'). Standortwechsel überschreibt es an dieser Stelle:
     *   { provide: HARBOR_COCKPIT_CONFIG, useValue: cuxhavenConfig }
     */
  ],
};
