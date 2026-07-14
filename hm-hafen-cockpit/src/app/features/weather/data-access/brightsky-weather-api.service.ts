/**
 * Dünner HTTP-Adapter für Bright Sky. Mappt nichts.
 * Die URL (inkl. `units=dwd`, `tz=Europe/Berlin`) baut core/config/api-endpoints.ts.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { brightSkyCurrentWeatherUrl } from '../../../core/config/api-endpoints';
import type { BrightSkyCurrentWeatherResponseDto } from './brightsky-weather.dto';

@Injectable({ providedIn: 'root' })
export class BrightSkyWeatherApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  /** Koordinaten kommen aus der Config - ein zweiter Standort wäre reine Konfiguration. */
  getCurrentWeather(): Observable<BrightSkyCurrentWeatherResponseDto> {
    return this.http.get<BrightSkyCurrentWeatherResponseDto>(
      brightSkyCurrentWeatherUrl(this.config),
    );
  }
}
