/**
 * RemoteData<T> - Ladezustände als Discriminated Union statt isLoading/hasError/data===null.
 *
 * 'refreshing' und 'stale' gibt es, damit einmal geladene Daten sichtbar bleiben: kein
 * Content-Jump, kein Höhen-Kollaps der Kachel. 'loading'/'error' heißen deshalb präzise
 * "wir hatten noch NIE Daten". Ein zwei Minuten alter Wasserstand ('stale') ist in einer
 * Leitstelle nützlicher als eine leere Kachel - der Status-Marker wird dafür rot.
 */

import { type Observable, type OperatorFunction, catchError, defer, map, of, startWith, switchMap } from 'rxjs';
import { mapUnknownError } from '../../core/http/http-error.mapper';
import type { AppError } from '../../core/http/http-error.model';

export type RemoteData<T> =
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | { readonly state: 'success'; readonly data: T; readonly loadedAt: Date }
  | { readonly state: 'refreshing'; readonly data: T; readonly loadedAt: Date }
  | { readonly state: 'error'; readonly error: AppError }
  | {
      readonly state: 'stale';
      readonly data: T;
      /** Wann die ANGEZEIGTEN (also alten) Daten geladen wurden. */
      readonly loadedAt: Date;
      readonly error: AppError;
    };

/**
 * Betriebszustand für den Status-Marker im Rahmen - bewusst eine eigene, kleinere Union:
 * Der Marker interessiert sich nur für die Farbe, nicht dafür, ob Daten da sind.
 */
export type WidgetStatus = 'idle' | 'refreshing' | 'live' | 'error';

export function widgetStatus<T>(remote: RemoteData<T>): WidgetStatus {
  switch (remote.state) {
    case 'idle':
      return 'idle';
    case 'success':
      return 'live';
    case 'loading':
    case 'refreshing':
      return 'refreshing';
    // 'stale' zeigt zwar Daten - aber die sind eben NICHT live. Rot.
    case 'error':
    case 'stale':
      return 'error';
  }
}

/** Die angezeigten Daten, sofern es welche gibt (auch bei 'refreshing'/'stale'). */
export function remoteValue<T>(remote: RemoteData<T>): T | null {
  switch (remote.state) {
    case 'success':
    case 'refreshing':
    case 'stale':
      return remote.data;
    case 'idle':
    case 'loading':
    case 'error':
      return null;
  }
}

export function remoteLoadedAt<T>(remote: RemoteData<T>): Date | null {
  switch (remote.state) {
    case 'success':
    case 'refreshing':
    case 'stale':
      return remote.loadedAt;
    case 'idle':
    case 'loading':
    case 'error':
      return null;
  }
}

export function remoteIdle<T>(): RemoteData<T> {
  return { state: 'idle' };
}

export function remoteLoading<T>(): RemoteData<T> {
  return { state: 'loading' };
}

export function remoteSuccess<T>(data: T, loadedAt: Date = new Date()): RemoteData<T> {
  return { state: 'success', data, loadedAt };
}

export function remoteError<T>(error: AppError): RemoteData<T> {
  return { state: 'error', error };
}

/** Für Abrufe ohne Polling (z.B. in Tests). */
export function toRemoteData<T>(): OperatorFunction<T, RemoteData<T>> {
  return (source$) =>
    source$.pipe(
      map((data) => remoteSuccess(data)),
      startWith(remoteLoading<T>()),
      catchError((error: unknown) => of(remoteError<T>(mapUnknownError(error)))),
    );
}

/**
 * Wiederholt einen Abruf bei jedem Tick und liefert RemoteData.
 *
 * Der Takt kommt von AUSSEN (RefreshScheduler): Alle Kacheln laden gleichzeitig, und der
 * Countdown in der Kopfzeile beschreibt genau den Abruf, der hier stattfindet.
 *
 * `catchError` liegt INNERHALB von `switchMap` - läge er außen, würde ein einziger HTTP-Fehler
 * das Polling für immer beenden. `defer` gibt jedem Abonnenten seinen eigenen `last`-Zustand,
 * sonst teilten sich zwei Kacheln die Variable.
 */
export function pollRemoteData<T>(
  load: () => Observable<T>,
  ticks$: Observable<number>,
): Observable<RemoteData<T>> {
  return defer(() => {
    /** Der letzte ERFOLGREICHE Abruf. Solange null, hatten wir noch nie Daten. */
    let last: { data: T; loadedAt: Date } | null = null;

    return ticks$.pipe(
      switchMap(() => {
        // Was zeigen wir, während der Abruf läuft?
        const pending: RemoteData<T> =
          last === null
            ? remoteLoading<T>()
            : { state: 'refreshing', data: last.data, loadedAt: last.loadedAt };

        return load().pipe(
          map((data): RemoteData<T> => {
            last = { data, loadedAt: new Date() };
            return { state: 'success', data, loadedAt: last.loadedAt };
          }),

          catchError((error: unknown): Observable<RemoteData<T>> => {
            const appError = mapUnknownError(error);

            return of(
              last === null
                ? { state: 'error', error: appError }
                : { state: 'stale', data: last.data, loadedAt: last.loadedAt, error: appError },
            );
          }),

          startWith(pending),
        );
      }),
    );
  });
}

/** Type Guard für Tests. */
export function isRemoteSuccess<T>(
  value: RemoteData<T>,
): value is { state: 'success'; data: T; loadedAt: Date } {
  return value.state === 'success';
}
