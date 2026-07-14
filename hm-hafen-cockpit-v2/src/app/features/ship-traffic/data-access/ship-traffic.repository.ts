/**
 * Schiffsverkehr-Repository (abstrakter Vertrag).
 *
 * Das Widget kennt nur diese Klasse - keinen AIS-Code, keinen Sentinel-Wert,
 * keinen API-Key, kein WebSocket. Es bekommt nur `ShipTrafficOverview`.
 *
 * Dieser Vertrag ist hier mehr als Zeremonie: AIS ist die erste Quelle, die
 * NICHT direkt aus dem Browser abrufbar ist (Key + fehlendes CORS). Welche Welt
 * dahintersteckt, entscheidet eine Zeile in app.config.ts:
 *
 *   MockShipTrafficRepository     - Demo, ohne Netz
 *   BackendShipTrafficRepository  - eigener Proxy, der den Key hält
 */

import type { Observable } from 'rxjs';
import type { ShipTrafficOverview } from './ship-traffic.model';

export abstract class ShipTrafficRepository {
  abstract getShipTraffic(): Observable<ShipTrafficOverview>;
}
