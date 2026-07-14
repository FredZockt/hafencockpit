/**
 * Schiffsverkehr-Widget.
 *
 * Wie die anderen Kacheln: kein HttpClient, kein DTO, kein AIS-Code. Nur das
 * Repository - und das kann heute ein Mock und morgen ein Backend-Proxy sein,
 * ohne dass sich hier eine Zeile ändert.
 *
 * Bewusst KEINE Seekarte: In einer 400px-Kachel wäre sie unlesbar, und eine
 * Karten-Library kostet schnell 150 kB. Eine verdichtete Liste ist für die
 * Leitstelle ohnehin nützlicher (Wer kommt? Wann? Wie weit?).
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import type { AppError } from '../../../core/http/http-error.model';
import { RefreshScheduler } from '../../../core/refresh/refresh-scheduler.service';
import { injectWidgetContext } from '../../../core/widgets/widget-context';
import { WIDGET_REGISTRY } from '../../../core/widgets/widget-registry';
import {
  type RemoteData,
  pollRemoteData,
  remoteIdle,
  remoteLoadedAt,
  remoteValue,
  widgetStatus,
} from '../../../shared/models/remote-data.model';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import { WidgetFrameComponent } from '../../../shared/ui/widget-frame/widget-frame.component';
import type { ShipDirection, ShipTrafficOverview, ShipType } from '../data-access/ship-traffic.model';
import { ShipTrafficRepository } from '../data-access/ship-traffic.repository';

/** Reine Darstellung - deshalb hier, nicht im Domain-Modell. */
const DIRECTION_ARROW: Record<ShipDirection, string> = {
  einlaufend: '↓',
  auslaufend: '↑',
  liegt: '■',
  unbekannt: '–',
};

const TYPE_ICON: Record<ShipType, string> = {
  Frachter: '📦',
  Tanker: '🛢️',
  Passagierschiff: '🛳️',
  Schlepper: '🚤',
  Lotsenboot: '⚓',
  Fischerei: '🎣',
  Segler: '⛵',
  Sonstige: '🚢',
  unbekannt: '❔',
};

/** Ab diesem Alter ist ein AIS-Paket nicht mehr aktuell. */
const STALE_PACKET_MINUTES = 10;

@Component({
  selector: 'app-ship-traffic-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    WidgetFrameComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './ship-traffic-widget.component.html',
  styleUrl: './ship-traffic-widget.component.scss',
})
export class ShipTrafficWidgetComponent {
  private readonly repository = inject(ShipTrafficRepository);
  /** Gemeinsamer Takt - alle Kacheln laden im selben Moment. */
  private readonly scheduler = inject(RefreshScheduler);

  protected readonly context = injectWidgetContext();
  protected readonly definition = WIDGET_REGISTRY['ship-traffic'];

  private readonly traffic = toSignal(
    pollRemoteData(() => this.repository.getShipTraffic(), this.scheduler.ticks$),
    { initialValue: remoteIdle<ShipTrafficOverview>() satisfies RemoteData<ShipTrafficOverview> },
  );

  /** Auch bei 'refreshing' und 'stale' gefüllt - die Kachel springt nicht. */
  protected readonly data = computed<ShipTrafficOverview | null>(() =>
    remoteValue(this.traffic()),
  );

  protected readonly status = computed(() => widgetStatus(this.traffic()));
  protected readonly loadedAt = computed<Date | null>(() => remoteLoadedAt(this.traffic()));

  protected readonly fatalError = computed<AppError | null>(() => {
    const state = this.traffic();
    return state.state === 'error' ? state.error : null;
  });

  protected readonly emptyHint = computed<string | null>(() => {
    const overview = this.data();
    return overview === null ? null : `Umkreis ${overview.radiusKm} km um den Hafenstandort`;
  });

  protected directionArrow(direction: ShipDirection): string {
    return DIRECTION_ARROW[direction];
  }

  protected typeIcon(type: ShipType): string {
    return TYPE_ICON[type];
  }

  /**
   * Ein Schiff kann "stehen", weil es schlicht nicht mehr sendet. Das ist etwas
   * anderes als "es liegt fest" - und muss sichtbar sein.
   */
  protected isPacketStale(lastSeenAt: Date, now: Date | null): boolean {
    if (now === null) {
      return false;
    }
    return now.getTime() - lastSeenAt.getTime() > STALE_PACKET_MINUTES * 60_000;
  }
}
