/** Warnungen-Repository: Implementierung gegen Bright Sky /alerts. */

import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { createTtlCache } from '../../../shared/util/ttl-cache';
import { BrightSkyAlertsApiService } from './brightsky-alerts-api.service';
import type { WarningsOverview } from './warning.model';
import { mapToWarningsOverview } from './warnings.mapper';
import { WarningsRepository } from './warnings.repository';

@Injectable()
export class BrightSkyWarningsRepository extends WarningsRepository {
  private readonly api = inject(BrightSkyAlertsApiService);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  private readonly loadWarnings = createTtlCache(
    () =>
      this.api.getAlerts().pipe(
        // `new Date()` bei JEDEM Abruf frisch: `isActive` hängt an der aktuellen Uhrzeit.
        // Einmalig beim Anlegen bestimmt, würde eine Warnung nie mehr ablaufen.
        map((response) => mapToWarningsOverview(response, new Date())),
      ),
    this.config.refreshIntervalMs / 2,
  );

  override getWarnings(): Observable<WarningsOverview> {
    return this.loadWarnings();
  }
}
