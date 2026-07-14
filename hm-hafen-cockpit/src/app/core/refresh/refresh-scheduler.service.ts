/**
 * EIN Takt für ALLE Kacheln. Sie laden im selben Moment - nur so beschreiben zwei
 * nebeneinander stehende Zahlen garantiert denselben Zeitpunkt, und der Countdown
 * in der Kopfzeile gilt für das gesamte Dashboard.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { type Observable, shareReplay, tap, timer } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../config/app-config';

@Injectable({ providedIn: 'root' })
export class RefreshScheduler {
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  readonly intervalMs = this.config.refreshIntervalMs;

  /**
   * Zeitpunkt der nächsten Aktualisierung (Epoch-Millisekunden). Genau diese Zahl
   * zeigt die Kopfzeile an - Anzeige und Abruf lesen damit dieselbe Uhr und können
   * nicht auseinanderlaufen.
   */
  private readonly nextRefreshAtSignal = signal<number | null>(null);

  readonly nextRefreshAt = this.nextRefreshAtSignal.asReadonly();

  /** Ob der Takt schon läuft (erste Kachel hat sich angemeldet). */
  readonly isRunning = computed(() => this.nextRefreshAtSignal() !== null);

  /**
   * Der Takt. Emittiert sofort (Tick 0), danach im konfigurierten Intervall.
   *   bufferSize: 1   -> eine neu hinzugefügte Kachel bekommt den letzten Tick sofort
   *                      nachgereicht und ist damit augenblicklich gefüllt.
   *   refCount: false -> der Herzschlag läuft weiter, auch wenn kurzzeitig keine
   *                      Kachel abonniert ist (leeres Board). Der Countdown bleibt stabil.
   */
  readonly ticks$: Observable<number> = timer(0, this.intervalMs).pipe(
    tap(() => this.nextRefreshAtSignal.set(Date.now() + this.intervalMs)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
}
