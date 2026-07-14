/** Wetter-Repository: Implementierung gegen Bright Sky. */

import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { createTtlCache } from '../../../shared/util/ttl-cache';
import { BrightSkyWeatherApiService } from './brightsky-weather-api.service';
import { mapToHarborWeather } from './weather.mapper';
import type { HarborWeather } from './weather.model';
import { WeatherRepository } from './weather.repository';

@Injectable()
export class BrightSkyWeatherRepository extends WeatherRepository {
  private readonly api = inject(BrightSkyWeatherApiService);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  /** TTL = halbes Refresh-Intervall: bündelt mehrere Bezieher zu einem Request. */
  private readonly loadWeather = createTtlCache(
    () => this.api.getCurrentWeather().pipe(map(mapToHarborWeather)),
    this.config.refreshIntervalMs / 2,
  );

  override getCurrentWeather(): Observable<HarborWeather> {
    return this.loadWeather();
  }
}
