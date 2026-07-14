/** Tide-Repository (abstrakter Vertrag). Das Widget kennt nur diese Klasse. */

import type { Observable } from 'rxjs';
import type { TideOverview } from './tide.model';

export abstract class TideRepository {
  /** Alles in EINEM Aufruf - sonst müsste das Widget Antworten zusammenführen. */
  abstract getTideOverview(): Observable<TideOverview>;
}
