/** Dünner HTTP-Adapter für PEGELONLINE. Mappt nicht, cacht nicht, entscheidet nicht. */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import {
  HARBOR_COCKPIT_CONFIG,
  type PegelOnlineCurvePeriod,
} from '../../../core/config/app-config';
import {
  pegelOnlineCurrentMeasurementUrl,
  pegelOnlineMeasurementsUrl,
  pegelOnlineStationSearchUrl,
  pegelOnlineStationUrl,
  pegelOnlineWaterLevelTimeseriesUrl,
} from '../../../core/config/api-endpoints';
import type {
  PegelOnlineCurrentMeasurementDto,
  PegelOnlineMeasurementDto,
  PegelOnlineStationDto,
  PegelOnlineTimeseriesDto,
} from './pegelonline.dto';

@Injectable({ providedIn: 'root' })
export class PegelOnlineApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  get stationUuid(): string {
    return this.config.pegelOnline.stationUuid;
  }

  get curvePeriod(): PegelOnlineCurvePeriod {
    return this.config.pegelOnline.curvePeriod;
  }

  getStation(stationUuid: string): Observable<PegelOnlineStationDto> {
    return this.http.get<PegelOnlineStationDto>(pegelOnlineStationUrl(this.config, stationUuid));
  }

  /**
   * FALLBACK: Station über die Fuzzy-Suche finden.
   *
   * Normalweg ist die konfigurierte UUID (nur sie ist laut PEGELONLINE stabil).
   * Diese Suche greift nur bei HTTP 404 - siehe pegelonline-tide.repository.ts.
   */
  findStationByFuzzyId(): Observable<PegelOnlineStationDto> {
    const expectedName = this.config.pegelOnline.stationLongnameContains.toUpperCase();

    return this.http
      .get<readonly PegelOnlineStationDto[]>(pegelOnlineStationSearchUrl(this.config))
      .pipe(
        map((stations) => {
          /*
           * Die Suche nach "hamburg" liefert "HAMBURG ST. PAULI" UND
           * "HAMBURG-HARBURG". Eine Verwechslung wäre fachlich fatal - die
           * beiden Pegel liegen an verschiedenen Elbarmen.
           */
          const station = stations.find((candidate) =>
            candidate.longname.toUpperCase().includes(expectedName),
          );

          if (station === undefined) {
            throw new Error(
              `Pegel "${this.config.pegelOnline.stationLongnameContains}" wurde bei PEGELONLINE nicht gefunden.`,
            );
          }

          return station;
        }),
      );
  }

  /** Metadaten der Zeitreihe: liefert Einheit und Pegelnullpunkt - beides wird nicht geraten. */
  getWaterLevelTimeseries(stationUuid: string): Observable<PegelOnlineTimeseriesDto> {
    return this.http.get<PegelOnlineTimeseriesDto>(
      pegelOnlineWaterLevelTimeseriesUrl(this.config, stationUuid),
    );
  }

  getCurrentMeasurement(stationUuid: string): Observable<PegelOnlineCurrentMeasurementDto> {
    return this.http.get<PegelOnlineCurrentMeasurementDto>(
      pegelOnlineCurrentMeasurementUrl(this.config, stationUuid),
    );
  }

  /** Messreihe für die Kurve (Zeitraum aus der Config, Vorgabe P1D = 24 h). */
  getMeasurements(stationUuid: string): Observable<readonly PegelOnlineMeasurementDto[]> {
    return this.http.get<readonly PegelOnlineMeasurementDto[]>(
      pegelOnlineMeasurementsUrl(this.config, stationUuid),
    );
  }
}
