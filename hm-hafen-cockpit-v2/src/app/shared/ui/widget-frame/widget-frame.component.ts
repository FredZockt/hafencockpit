/**
 * Der Rahmen jeder Kachel: Titel, Herkunftsangabe, Zeitstempel, Griff, Entfernen-Knopf.
 * Kennt keine Fachlogik.
 *
 * Der `cdkDragHandle` sitzt hier, obwohl das `cdkDrag` in der Shell hängt und diese Komponente
 * dynamisch (NgComponentOutlet) erzeugt wird: CdkDragHandle sucht seinen Parent zuerst per DI
 * und läuft sonst den DOM nach oben, bis es ein cdkDrag findet (CDK-Fallback). Ohne das müsste
 * die ganze Kachel ziehbar sein - und jeder Klick auf einen Button wäre ein Drag-Start.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import type { WidgetStatus } from '../../models/remote-data.model';

/** Sprechender Text zum Status-Marker (Tooltip + Screenreader). */
const STATUS_LABEL: Readonly<Record<WidgetStatus, string>> = {
  live: 'Live - Daten sind aktuell',
  refreshing: 'Wird im Hintergrund aktualisiert',
  error: 'Fehler beim letzten Abruf - angezeigte Daten sind möglicherweise veraltet',
  idle: 'Noch keine Daten abgerufen',
};

@Component({
  selector: 'app-widget-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, CdkDragHandle],
  template: `
    <article class="frame">
      <header class="frame__head">
        <!-- Nur hier startet ein Drag - nicht auf dem ganzen Inhalt. -->
        <button
          type="button"
          class="frame__handle"
          cdkDragHandle
          [attr.aria-label]="'Kachel ' + title() + ' verschieben'"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <circle cx="5" cy="3" r="1.4" />
            <circle cx="11" cy="3" r="1.4" />
            <circle cx="5" cy="8" r="1.4" />
            <circle cx="11" cy="8" r="1.4" />
            <circle cx="5" cy="13" r="1.4" />
            <circle cx="11" cy="13" r="1.4" />
          </svg>
        </button>

        <!-- Status-Marker: grün = live, orange = Aktualisierung läuft, rot = Fehler.
             Farbe allein ist keine Information (Screenreader, Rot-Grün-Schwäche) - deshalb
             zusätzlich Titel/aria-label und eine unterscheidbare Form (Ring beim Aktualisieren). -->
        <span
          class="frame__status"
          [class]="'frame__status--' + status()"
          role="status"
          [title]="statusLabel()"
          [attr.aria-label]="statusLabel()"
        ></span>

        <div class="frame__titles">
          <h2 class="frame__title">{{ title() }}</h2>
          <p class="frame__source">{{ dataSource() }}</p>
        </div>

        <div class="frame__meta">
          @if (loadedAt(); as timestamp) {
            <!-- "Stand" statt "Aktualisiert": Es zählt, wie alt der Wert ist. -->
            <span class="frame__timestamp" [title]="timestamp | date: 'full'">
              Stand {{ timestamp | date: 'HH:mm:ss' }}
            </span>
          }

          @if (removable()) {
            <button
              type="button"
              class="frame__remove"
              (click)="remove.emit()"
              [attr.aria-label]="'Kachel ' + title() + ' entfernen'"
            >
              &times;
            </button>
          }
        </div>
      </header>

      <div class="frame__body">
        <ng-content />
      </div>
    </article>
  `,
  styleUrl: './widget-frame.component.scss',
})
export class WidgetFrameComponent {
  readonly title = input.required<string>();

  /** Klartext-Herkunft, z.B. "PEGELONLINE (WSV)" - muss ohne Nachfragen erkennbar sein. */
  readonly dataSource = input.required<string>();

  /** `null`, solange nichts geladen ist - dann zeigen wir gar keinen Stand an. */
  readonly loadedAt = input<Date | null>(null);

  readonly removable = input<boolean>(true);

  /** Wird vom Widget aus seinem RemoteData-Zustand abgeleitet (`widgetStatus()`). */
  readonly status = input<WidgetStatus>('idle');

  protected readonly statusLabel = computed(() => STATUS_LABEL[this.status()]);

  /** Der Rahmen entfernt sich nicht selbst - er meldet den Wunsch nach oben. */
  readonly remove = output<void>();
}
