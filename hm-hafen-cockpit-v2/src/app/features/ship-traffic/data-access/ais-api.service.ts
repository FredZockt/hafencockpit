/**
 * Dünner HTTP-Adapter für unseren AIS-Proxy. Mappt nichts.
 *
 * WARUM EIN PROXY UND NICHT DIREKT?
 * Anders als PEGELONLINE und Bright Sky ist AIS nicht aus dem Browser abrufbar -
 * aus ZWEI unabhängigen Gründen:
 *
 *   1. API-Key. Jeder Anbieter (aisstream.io, AISHub, MarineTraffic) verlangt
 *      einen. Ein Key im Frontend-Bundle ist öffentlich - das ist kein Risiko,
 *      das ist eine Tatsache.
 *   2. CORS. aisstream.io schließt Browser-Verbindungen ausdrücklich aus.
 *
 * Der Proxy hält den Key, hält EINE WebSocket-Verbindung für alle Nutzer, pflegt
 * daraus eine Map<mmsi, Schiff> und liefert auf GET /ships einen Snapshot mit
 * CORS-Header. Dadurch wird aus dem Datenstrom wieder Request/Response - und die
 * Quelle passt ohne Sonderfall in die bestehende Architektur (gemeinsamer Takt,
 * Countdown, refreshing/stale).
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import type { AisSnapshotDto } from './ais.dto';

@Injectable({ providedIn: 'root' })
export class AisApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  /** GET {proxy}/ships - aktueller Snapshot der Bounding-Box. */
  getSnapshot(): Observable<AisSnapshotDto> {
    return this.http.get<AisSnapshotDto>(`${this.config.ais.proxyBaseUrl}/ships`);
  }
}
