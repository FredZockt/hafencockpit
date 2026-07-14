/**
 * Wetter-Repository (abstrakter Vertrag). Das Widget kennt nur diese Klasse -
 * ein Anbieterwechsel wäre eine Provider-Zeile in app.config.ts.
 */

import type { Observable } from 'rxjs';
import type { HarborWeather } from './weather.model';

export abstract class WeatherRepository {
  abstract getCurrentWeather(): Observable<HarborWeather>;
}
