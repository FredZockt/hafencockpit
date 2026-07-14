/**
 * Warnungen-Widget.
 *
 * Der Empty-State ist hier der NORMALFALL: Bei ruhiger Wetterlage liefert /alerts ein
 * leeres Array. Eine Kachel, die bei schönem Wetter dauerhaft rot leuchtet, wird nach
 * zwei Tagen ignoriert - und dann übersieht jemand die echte Sturmflutwarnung.
 * "Keine Warnungen" ist deshalb ein ERFOLG: Der Status-Marker steht auf grün.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
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
import type { WarningSeverity, WarningsOverview } from '../data-access/warning.model';
import { WarningsRepository } from '../data-access/warnings.repository';

/** ASCII-Schlüssel für die CSS-Klasse - der Domain-Wert 'mäßig' trägt einen Umlaut. */
const SEVERITY_CLASS: Readonly<Record<WarningSeverity, string>> = {
  extrem: 'extrem',
  schwer: 'schwer',
  mäßig: 'maessig',
  gering: 'gering',
  unbekannt: 'unbekannt',
};

@Component({
  selector: 'app-warnings-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    WidgetFrameComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './warnings-widget.component.html',
  styleUrl: './warnings-widget.component.scss',
})
export class WarningsWidgetComponent {
  private readonly repository = inject(WarningsRepository);
  /** Gemeinsamer Takt - alle Kacheln laden im selben Moment. */
  private readonly scheduler = inject(RefreshScheduler);

  protected readonly context = injectWidgetContext();
  protected readonly definition = WIDGET_REGISTRY['warnings'];

  private readonly warnings = toSignal(
    pollRemoteData(() => this.repository.getWarnings(), this.scheduler.ticks$),
    { initialValue: remoteIdle<WarningsOverview>() satisfies RemoteData<WarningsOverview> },
  );

  /** Auch bei 'refreshing' und 'stale' gefüllt - deshalb springt die Kachel nicht. */
  protected readonly data = computed<WarningsOverview | null>(() => remoteValue(this.warnings()));

  protected readonly status = computed(() => widgetStatus(this.warnings()));
  protected readonly loadedAt = computed<Date | null>(() => remoteLoadedAt(this.warnings()));

  /** Fehler nur anzeigen, wenn es noch NIE Daten gab. */
  protected readonly fatalError = computed<AppError | null>(() => {
    const state = this.warnings();
    return state.state === 'error' ? state.error : null;
  });

  /** "Keine Warnungen" allein wäre eine Behauptung - mit der Warnzelle wird sie überprüfbar. */
  protected readonly emptyHint = computed<string | null>(() => {
    const overview = this.data();
    if (overview === null || overview.area === null) {
      return null;
    }
    return `Geprüft für Warnzelle ${overview.area.name} (${overview.area.warnCellId})`;
  });

  protected severityClass(severity: WarningSeverity): string {
    return SEVERITY_CLASS[severity];
  }
}
