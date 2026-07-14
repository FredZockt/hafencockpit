/** Tide-Repository: Implementierung gegen PEGELONLINE. */

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, forkJoin, map, switchMap, throwError } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { createTtlCache } from '../../../shared/util/ttl-cache';
import { PegelOnlineApiService } from './pegelonline-api.service';
import type { PegelOnlineStationDto } from './pegelonline.dto';
import { mapToTideOverview } from './tide.mapper';
import type { TideOverview } from './tide.model';
import { TideRepository } from './tide.repository';

@Injectable()
export class PegelOnlineTideRepository extends TideRepository {
  private readonly api = inject(PegelOnlineApiService);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  /**
   * TTL = halbes Refresh-Intervall: bündelt mehrere Tide-Kacheln zu EINEM
   * Request, ohne den nächsten regulären Takt zu blockieren.
   */
  private readonly loadOverview = createTtlCache(
    () => this.fetchTideOverview(),
    this.config.refreshIntervalMs / 2,
  );

  override getTideOverview(): Observable<TideOverview> {
    return this.loadOverview();
  }

  /**
   * Station auflösen, dann die drei datentragenden Endpunkte PARALLEL holen.
   *
   * `forkJoin` statt verketteter switchMaps: Die Anfragen sind voneinander
   * unabhängig, nacheinander würden sie die Ladezeit verdreifachen. Dass
   * forkJoin bei EINEM Fehler komplett scheitert, ist gewollt - eine Tide-Kachel
   * ohne Messwert oder ohne Einheit wäre irreführend, nicht halb informativ.
   */
  private fetchTideOverview(): Observable<TideOverview> {
    return this.resolveStation().pipe(
      switchMap((station) =>
        forkJoin({
          timeseries: this.api.getWaterLevelTimeseries(station.uuid),
          current: this.api.getCurrentMeasurement(station.uuid),
          measurements: this.api.getMeasurements(station.uuid),
        }).pipe(
          map((responses) =>
            mapToTideOverview({
              station,
              timeseries: responses.timeseries,
              current: responses.current,
              measurements: responses.measurements,
              maxCurvePoints: this.config.pegelOnline.curveMaxPoints,
            }),
          ),
        ),
      ),
    );
  }

  /**
   * Station über die konfigurierte UUID laden.
   *
   * Die Fuzzy-Suche greift NUR bei HTTP 404 (Station umgebaut/neu angelegt ->
   * UUID gewechselt). Alle anderen Fehler werden unverändert durchgereicht.
   */
  private resolveStation(): Observable<PegelOnlineStationDto> {
    return this.api.getStation(this.config.pegelOnline.stationUuid).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return this.api.findStationByFuzzyId();
        }
        return throwError(() => error);
      }),
    );
  }
}
