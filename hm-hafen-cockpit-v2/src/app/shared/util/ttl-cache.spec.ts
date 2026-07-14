import { Subject, of, throwError } from 'rxjs';
import { createTtlCache } from './ttl-cache';

describe('createTtlCache', () => {
  it('führt bei zwei GLEICHZEITIGEN Aufrufen nur EINE Anfrage aus', () => {
    // Der Fall "zwei Tide-Kacheln auf dem Board".
    const source = new Subject<string>();
    let calls = 0;

    const load = createTtlCache(() => {
      calls += 1;
      return source.asObservable();
    }, 1000);

    const results: string[] = [];
    load().subscribe((value) => results.push(value));
    load().subscribe((value) => results.push(value));

    expect(calls).toBe(1);

    source.next('daten');
    source.complete();

    expect(results).toEqual(['daten', 'daten']);
  });

  it('liefert innerhalb der TTL den zwischengespeicherten Wert', () => {
    let calls = 0;
    let now = 1_000;

    const load = createTtlCache(
      () => {
        calls += 1;
        return of(`antwort-${calls}`);
      },
      5_000,
      () => now,
    );

    let first = '';
    let second = '';
    load().subscribe((value) => (first = value));

    now = 3_000; // 2 s später - noch innerhalb der TTL von 5 s
    load().subscribe((value) => (second = value));

    expect(calls).toBe(1);
    expect(second).toBe(first);
  });

  it('lädt nach Ablauf der TTL neu', () => {
    let calls = 0;
    let now = 1_000;

    const load = createTtlCache(
      () => {
        calls += 1;
        return of(`antwort-${calls}`);
      },
      5_000,
      () => now,
    );

    let first = '';
    let second = '';
    load().subscribe((value) => (first = value));

    now = 10_000; // 9 s später - TTL abgelaufen
    load().subscribe((value) => (second = value));

    // Der Cache darf den regulären Refresh des Widgets NICHT aushebeln.
    expect(calls).toBe(2);
    expect(first).toBe('antwort-1');
    expect(second).toBe('antwort-2');
  });

  it('cacht FEHLER NICHT - der nächste Poll darf es erneut versuchen', () => {
    // Ein gecachter Fehler hielte die Kachel bis zum Ablauf der TTL tot.
    let calls = 0;

    const load = createTtlCache(() => {
      calls += 1;
      return calls === 1 ? throwError(() => new Error('boom')) : of('endlich');
    }, 60_000);

    let error: unknown;
    load().subscribe({ error: (err: unknown) => (error = err) });
    expect(error).toBeInstanceOf(Error);

    // Sofortiger zweiter Versuch - trotz langer TTL.
    let value = '';
    load().subscribe((result) => (value = result));

    expect(calls).toBe(2);
    expect(value).toBe('endlich');
  });
});
