/**
 * TTL-Cache auf Repository-Ebene. Löst zwei Probleme, die gern verwechselt werden:
 * Deduplizierung paralleler Anfragen (`inflight`: zwei Tide-Kacheln -> ein Request) und
 * zeitliche Wiederverwendung (`cached` + TTL).
 *
 * Fehler werden NICHT gecacht - sonst wäre die Kachel bis zum TTL-Ablauf tot. Die TTL muss
 * deutlich kürzer sein als das Refresh-Intervall, sonst hebelt sie die Aktualisierung aus.
 */

import { type Observable, finalize, of, shareReplay, tap } from 'rxjs';

/**
 * @param now Zeitquelle - injizierbar, damit Tests die Uhr kontrollieren können.
 */
export function createTtlCache<T>(
  load: () => Observable<T>,
  ttlMs: number,
  now: () => number = () => Date.now(),
): () => Observable<T> {
  let inflight: Observable<T> | null = null;
  let cached: { value: T; expiresAt: number } | null = null;

  return (): Observable<T> => {
    if (cached !== null && cached.expiresAt > now()) {
      return of(cached.value);
    }

    if (inflight !== null) {
      return inflight;
    }

    inflight = load().pipe(
      tap((value) => {
        cached = { value, expiresAt: now() + ttlMs };
      }),
      // `finalize` läuft bei complete UND bei error: Der Cache wird im Fehlerfall nicht
      // befüllt (das macht nur `tap`), aber `inflight` wird freigegeben - der nächste
      // Poll darf es erneut versuchen.
      finalize(() => {
        inflight = null;
      }),
      // `refCount: false`: Meldet sich der erste Abonnent während des Ladens ab, läuft
      // der Request trotzdem zu Ende und der zweite bekommt sein Ergebnis.
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return inflight;
  };
}
