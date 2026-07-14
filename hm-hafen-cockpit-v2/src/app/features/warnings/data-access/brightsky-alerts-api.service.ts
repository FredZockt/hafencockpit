/** Dünner HTTP-Adapter für Bright Sky /alerts. Kein Mapping, keine Fachlogik. */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { brightSkyAlertsUrl } from '../../../core/config/api-endpoints';
import type { BrightSkyAlertsResponseDto } from './brightsky-alerts.dto';

@Injectable({ providedIn: 'root' })
export class BrightSkyAlertsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  getAlerts(): Observable<BrightSkyAlertsResponseDto> {
    return this.http.get<BrightSkyAlertsResponseDto>(brightSkyAlertsUrl(this.config));
  }
}
