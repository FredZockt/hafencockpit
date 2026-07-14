/**
 * Schiffsverkehr gegen den eigenen AIS-Proxy.
 *
 * Noch nicht verdrahtet - in app.config.ts steht derzeit das Mock-Repository.
 * Der Umstieg auf echte Daten ist genau eine Zeile dort, sobald der Proxy läuft
 * (siehe README, Abschnitt "Schiffsverkehr-Widget").
 */

import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { createTtlCache } from '../../../shared/util/ttl-cache';
import { AisApiService } from './ais-api.service';
import type { ShipTrafficOverview } from './ship-traffic.model';
import { mapToShipTraffic } from './ship-traffic.mapper';
import { ShipTrafficRepository } from './ship-traffic.repository';

@Injectable()
export class BackendShipTrafficRepository extends ShipTrafficRepository {
  private readonly api = inject(AisApiService);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  private readonly loadTraffic = createTtlCache(
    () =>
      this.api.getSnapshot().pipe(
        // `new Date()` bei jedem Abruf frisch: Die ETA-Rekonstruktion und das
        // Paketalter hängen an der aktuellen Zeit.
        map((snapshot) =>
          mapToShipTraffic(
            snapshot,
            {
              harbor: this.config.harborLocation,
              radiusKm: this.config.ais.radiusKm,
              maxVessels: this.config.ais.maxVessels,
            },
            new Date(),
          ),
        ),
      ),
    this.config.refreshIntervalMs / 2,
  );

  override getShipTraffic(): Observable<ShipTrafficOverview> {
    return this.loadTraffic();
  }
}
