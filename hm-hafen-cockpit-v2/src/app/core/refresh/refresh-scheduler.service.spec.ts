/**
 * Sichert zwei Zusagen: ALLE Kacheln laden gleichzeitig (nur ein Takt), und der
 * angezeigte Countdown hängt an derselben Uhr wie der tatsächliche Abruf.
 */

import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { DEFAULT_HARBOR_COCKPIT_CONFIG, HARBOR_COCKPIT_CONFIG } from '../config/app-config';
import { RefreshScheduler } from './refresh-scheduler.service';

const INTERVAL = DEFAULT_HARBOR_COCKPIT_CONFIG.refreshIntervalMs; // 60_000

describe('RefreshScheduler', () => {
  let scheduler: RefreshScheduler;
  const subscriptions: Subscription[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: HARBOR_COCKPIT_CONFIG, useValue: DEFAULT_HARBOR_COCKPIT_CONFIG }],
    });

    scheduler = TestBed.inject(RefreshScheduler);
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    subscriptions.length = 0;
    vi.useRealTimers();
  });

  /** Meldet eine "Kachel" am Takt an und protokolliert ihre Ticks. */
  function mountWidget(): number[] {
    const ticks: number[] = [];
    subscriptions.push(scheduler.ticks$.subscribe((tick) => ticks.push(tick)));
    return ticks;
  }

  it('liefert sofort einen ersten Tick', () => {
    const ticks = mountWidget();

    vi.advanceTimersByTime(0);

    // Die Kacheln sollen nicht erst nach 60 Sekunden Daten zeigen.
    expect(ticks).toEqual([0]);
  });

  it('tickt im konfigurierten Takt weiter', () => {
    const ticks = mountWidget();
    vi.advanceTimersByTime(0);

    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toEqual([0, 1]);

    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toEqual([0, 1, 2]);
  });

  it('lässt ALLE Kacheln im selben Moment laden', () => {
    // Drei Kacheln, drei identische Tick-Folgen: Zwei nebeneinander stehende
    // Zahlen können damit nie unterschiedlich alt sein.
    const tide = mountWidget();
    const weather = mountWidget();
    const warnings = mountWidget();

    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(INTERVAL);

    expect(tide).toEqual([0, 1]);
    expect(weather).toEqual([0, 1]);
    expect(warnings).toEqual([0, 1]);
  });

  it('meldet die Fälligkeit passend zum Tick', () => {
    mountWidget();
    vi.advanceTimersByTime(0);

    // Genau diese Zahl zeigt die Kopfzeile an.
    expect(scheduler.nextRefreshAt()).toBe(Date.now() + INTERVAL);
  });

  it('schiebt die Fälligkeit bei jedem Tick weiter', () => {
    mountWidget();
    vi.advanceTimersByTime(0);

    const firstDue = scheduler.nextRefreshAt();

    vi.advanceTimersByTime(INTERVAL);

    expect(scheduler.nextRefreshAt()).toBe((firstDue ?? 0) + INTERVAL);
  });

  it('gibt einer später hinzugefügten Kachel sofort den letzten Tick', () => {
    const first = mountWidget();
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(INTERVAL);

    const late = mountWidget();

    // bufferSize: 1 - die neue Kachel zeigt sofort Daten (aus dem TTL-Cache),
    // statt bis zu 60 Sekunden leer zu bleiben.
    expect(late).toEqual([1]);
    expect(first).toEqual([0, 1]);
  });

  it('meldet noch keine Fälligkeit, solange niemand abonniert hat', () => {
    expect(scheduler.nextRefreshAt()).toBeNull();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('hält den Takt am Leben, wenn kurzzeitig keine Kachel abonniert ist', () => {
    // refCount: false - der Herzschlag gehört dem Cockpit, nicht einer einzelnen
    // Kachel. Sonst spränge der Countdown beim nächsten Hinzufügen auf Anfang.
    const subscription = scheduler.ticks$.subscribe();
    vi.advanceTimersByTime(0);
    const dueAt = scheduler.nextRefreshAt();

    subscription.unsubscribe();

    vi.advanceTimersByTime(INTERVAL);

    expect(scheduler.nextRefreshAt()).toBe((dueAt ?? 0) + INTERVAL);
  });

  it('kennt das konfigurierte Intervall', () => {
    expect(scheduler.intervalMs).toBe(INTERVAL);
  });
});
