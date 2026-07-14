import { Subject, throwError } from 'rxjs';
import {
  type RemoteData,
  pollRemoteData,
  widgetStatus,
  remoteValue,
} from './remote-data.model';

describe('widgetStatus', () => {
  it('bildet die Ladezustände auf die Marker-Farben ab', () => {
    expect(widgetStatus({ state: 'idle' })).toBe('idle');

    expect(widgetStatus({ state: 'success', data: 1, loadedAt: new Date() })).toBe('live');

    // Erstes Laden und Hintergrund-Refresh sind für den Marker dasselbe.
    expect(widgetStatus({ state: 'loading' })).toBe('refreshing');
    expect(widgetStatus({ state: 'refreshing', data: 1, loadedAt: new Date() })).toBe('refreshing');

    expect(widgetStatus({ state: 'error', error: { message: 'x', kind: 'network' } })).toBe('error');
  });

  it('markiert "stale" als FEHLER, obwohl Daten angezeigt werden', () => {
    // Die Kachel zeigt den Wasserstand von vorhin - der letzte Abruf schlug aber
    // fehl. Die Zahl ist NICHT live, deshalb der rote Marker.
    const stale: RemoteData<number> = {
      state: 'stale',
      data: 599,
      loadedAt: new Date(),
      error: { message: 'weg', kind: 'network' },
    };

    expect(widgetStatus(stale)).toBe('error');
    expect(remoteValue(stale)).toBe(599);
  });
});

describe('pollRemoteData', () => {
  it('zeigt beim ERSTEN Abruf den Ladezustand', () => {
    const ticks = new Subject<number>();
    const source = new Subject<string>();
    const states: RemoteData<string>[] = [];

    pollRemoteData(() => source.asObservable(), ticks.asObservable()).subscribe((state) =>
      states.push(state),
    );

    ticks.next(0);
    expect(states.map((s) => s.state)).toEqual(['loading']);

    source.next('daten');
    expect(states.map((s) => s.state)).toEqual(['loading', 'success']);
  });

  it('zeigt beim REFRESH die alten Daten weiter - kein Spinner, kein Kollaps', () => {
    // Beim zweiten Tick darf NIEMALS 'loading' kommen: Die Kachel würde ihren
    // Inhalt gegen einen Spinner tauschen, in sich zusammenfallen (Content-Jump)
    // und danach wieder aufspringen. Stattdessen: 'refreshing' MIT alten Daten.
    const ticks = new Subject<number>();
    let current = new Subject<string>();
    const states: RemoteData<string>[] = [];

    pollRemoteData(() => current.asObservable(), ticks.asObservable()).subscribe((state) =>
      states.push(state),
    );

    ticks.next(0);
    current.next('alt');

    // Zweiter Tick - der Hintergrund-Refresh
    current = new Subject<string>();
    ticks.next(1);

    const pending = states.at(-1);
    expect(pending?.state).toBe('refreshing');
    expect(remoteValue(pending!)).toBe('alt');

    current.next('neu');
    expect(states.at(-1)?.state).toBe('success');
    expect(remoteValue(states.at(-1)!)).toBe('neu');
  });

  it('behält bei einem Fehler die letzten Daten ("stale")', () => {
    // Ein zwei Minuten alter Wasserstand ist nützlicher als eine leere Kachel:
    // Daten bleiben stehen, der Marker wird rot.
    const ticks = new Subject<number>();
    const first = new Subject<string>();
    let failing = false;
    const states: RemoteData<string>[] = [];

    pollRemoteData(
      () => (failing ? throwError(() => new Error('boom')) : first.asObservable()),
      ticks.asObservable(),
    ).subscribe((state) => states.push(state));

    ticks.next(0);
    first.next('599 cm');
    expect(states.at(-1)?.state).toBe('success');

    // Der nächste Abruf scheitert.
    failing = true;
    ticks.next(1);

    const last = states.at(-1);
    expect(last?.state).toBe('stale');
    expect(remoteValue(last!)).toBe('599 cm');
    expect(widgetStatus(last!)).toBe('error');
  });

  it('zeigt einen Fehler nur dann als leere Kachel, wenn es NIE Daten gab', () => {
    const ticks = new Subject<number>();
    const states: RemoteData<string>[] = [];

    pollRemoteData(
      () => throwError(() => new Error('sofort kaputt')),
      ticks.asObservable(),
    ).subscribe((state) => states.push(state));

    ticks.next(0);

    // Kein 'stale' - es gab ja noch nie etwas anzuzeigen.
    expect(states.at(-1)?.state).toBe('error');
    expect(remoteValue(states.at(-1)!)).toBeNull();
  });

  it('pollt nach einem Fehler weiter und erholt sich', () => {
    // catchError liegt INNERHALB von switchMap - ein HTTP-500 darf das Polling
    // nicht für immer beenden.
    const ticks = new Subject<number>();
    let failing = true;
    const recovered = new Subject<string>();
    const states: RemoteData<string>[] = [];

    pollRemoteData(
      () => (failing ? throwError(() => new Error('boom')) : recovered.asObservable()),
      ticks.asObservable(),
    ).subscribe((state) => states.push(state));

    ticks.next(0);
    expect(states.at(-1)?.state).toBe('error');

    failing = false;
    ticks.next(1);
    recovered.next('wieder da');

    expect(states.at(-1)?.state).toBe('success');
  });

  it('gibt jedem Abonnenten seinen EIGENEN Verlauf (defer)', () => {
    // Ohne `defer` liefe der `last`-Zustand beider Kacheln über dieselbe Closure.
    const ticks = new Subject<number>();
    const source = new Subject<string>();
    const stream = pollRemoteData(() => source.asObservable(), ticks.asObservable());

    const a: RemoteData<string>[] = [];
    const b: RemoteData<string>[] = [];

    stream.subscribe((state) => a.push(state));
    ticks.next(0);
    source.next('daten');

    // Der zweite Abonnent beginnt bei 'loading' - er selbst hatte nie Daten.
    stream.subscribe((state) => b.push(state));
    ticks.next(1);

    expect(b[0]?.state).toBe('loading');
    expect(a.at(-1)?.state).toBe('refreshing');
  });
});
