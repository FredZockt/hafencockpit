/**
 * Warnungen-Repository (abstrakter Vertrag).
 * Das Widget kennt keine CAP-Struktur, keine Bright-Sky-Feldnamen und keine
 * Test-/Echt-Unterscheidung - es bekommt nur `WarningsOverview`.
 */

import type { Observable } from 'rxjs';
import type { WarningsOverview } from './warning.model';

export abstract class WarningsRepository {
  abstract getWarnings(): Observable<WarningsOverview>;
}
