/** Tide-Widget: kein HttpClient, kein DTO, keine Umrechnung - nur Anzeige. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RefreshScheduler } from '../../../core/refresh/refresh-scheduler.service';
import type { AppError } from '../../../core/http/http-error.model';
import { injectWidgetContext } from '../../../core/widgets/widget-context';
import { WIDGET_REGISTRY } from '../../../core/widgets/widget-registry';
import { LineChartComponent, type LineChartPoint } from '../../../shared/chart/line-chart.component';
import {
  type RemoteData,
  pollRemoteData,
  remoteIdle,
  remoteLoadedAt,
  remoteValue,
  widgetStatus,
} from '../../../shared/models/remote-data.model';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import { WidgetFrameComponent } from '../../../shared/ui/widget-frame/widget-frame.component';
import { TideRepository } from '../data-access/tide.repository';
import type { TideOverview, TideTrend } from '../data-access/tide.model';

/** Reine Darstellung - deshalb hier, nicht im Domain-Modell. */
const TREND_ARROW: Record<TideTrend, string> = {
  steigend: '↑',
  fallend: '↓',
  gleichbleibend: '→',
  unbekannt: '–',
};

@Component({
  selector: 'app-tide-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    WidgetFrameComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    LineChartComponent,
  ],
  templateUrl: './tide-widget.component.html',
  styleUrl: './tide-widget.component.scss',
})
export class TideWidgetComponent {
  /** Nur der Vertrag - im Test steht hier ein Mock. */
  private readonly repository = inject(TideRepository);

  /** Zentraler Takt: EIN Herzschlag für alle Kacheln. */
  private readonly scheduler = inject(RefreshScheduler);

  protected readonly context = injectWidgetContext();
  protected readonly definition = WIDGET_REGISTRY['tide'];

  private readonly tide = toSignal(
    pollRemoteData(() => this.repository.getTideOverview(), this.scheduler.ticks$),
    { initialValue: remoteIdle<TideOverview>() satisfies RemoteData<TideOverview> },
  );

  /**
   * Gefüllt auch während 'refreshing' und nach fehlgeschlagenem Abruf ('stale') -
   * die Kachel verliert nach dem ersten Erfolg nie wieder Inhalt (kein Content-Jump).
   */
  protected readonly data = computed<TideOverview | null>(() => remoteValue(this.tide()));

  /** grün / orange / rot für den Marker im Rahmen. */
  protected readonly status = computed(() => widgetStatus(this.tide()));

  /** Zeitpunkt der ANGEZEIGTEN Daten, nicht des letzten Versuchs. */
  protected readonly loadedAt = computed<Date | null>(() => remoteLoadedAt(this.tide()));

  /** Nur wenn noch NIE Daten geladen wurden; sonst zeigt sich ein Fehler allein am Marker. */
  protected readonly fatalError = computed<AppError | null>(() => {
    const state = this.tide();
    return state.state === 'error' ? state.error : null;
  });

  /** Abbildung ins fachneutrale Chart-Format - shared/chart weiß nichts von Tide. */
  protected readonly chartPoints = computed<readonly LineChartPoint[]>(() => {
    const overview = this.data();
    if (overview === null) {
      return [];
    }

    return overview.curve.map((point) => ({
      timestamp: point.timestamp,
      value: point.waterLevelCm,
    }));
  });

  protected trendArrow(trend: TideTrend): string {
    return TREND_ARROW[trend];
  }

  protected trendClass(trend: TideTrend): string {
    return `tide__trend--${trend}`;
  }
}
