/**
 * Die Dashboard-Seite: Grid aufspannen, Drag & Drop an den Layout-Store melden,
 * Kacheln hinzufügen / entfernen / zurücksetzen. Sie kennt weder die Datenquellen
 * noch die konkreten Widgets (das steht in der Registry) - ein viertes Widget
 * kostet hier deshalb keine Zeile.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';
import {
  CdkDrag,
  CdkDragPlaceholder,
  CdkDropList,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { DashboardLayoutStore } from '../layout/dashboard-layout-store.service';
import { RefreshScheduler } from '../refresh/refresh-scheduler.service';
import { WIDGET_REGISTRY } from '../widgets/widget-registry';
import { WidgetLoaderComponent } from '../widgets/widget-loader.component';
import type { DashboardWidgetInstance, WidgetType } from '../widgets/widget.model';

@Component({
  selector: 'app-harbor-cockpit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, WidgetLoaderComponent],
  templateUrl: './harbor-cockpit-page.component.html',
  styleUrl: './harbor-cockpit-page.component.scss',
})
export class HarborCockpitPageComponent {
  private readonly store = inject(DashboardLayoutStore);
  private readonly scheduler = inject(RefreshScheduler);

  protected readonly widgets = this.store.widgets;
  protected readonly isEmpty = this.store.isEmpty;

  /**
   * Sekundentakt NUR für die Darstellung - er löst keinen Abruf aus. Die Abrufe
   * hängen am RefreshScheduler; wären es zwei unabhängige Uhren, zeigte der
   * Countdown "0:00", während die Kachel noch schläft.
   */
  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  /** Verbleibende Sekunden bis zur nächsten Aktualisierung. `null`, solange der Takt nicht läuft. */
  protected readonly secondsUntilRefresh = computed<number | null>(() => {
    const dueAt = this.scheduler.nextRefreshAt();
    if (dueAt === null) {
      return null;
    }

    const remaining = Math.ceil((dueAt - this.now()) / 1000);

    /*
     * Nach unten auf 0 geklemmt: Zwischen "fällig" und "Antwort da" liegt die
     * Laufzeit der Requests - dort zeigen wir 0, nicht -3.
     * Nach oben aufs Intervall: `now` tickt nur sekündlich und ist im Moment eines
     * Ticks bis zu 1 s alt; ohne Klemme stünde kurz "1:01" statt "1:00".
     */
    const intervalSeconds = Math.ceil(this.scheduler.intervalMs / 1000);
    return Math.min(intervalSeconds, Math.max(0, remaining));
  });

  /** Countdown als "m:ss". */
  protected readonly countdown = computed<string | null>(() => {
    const seconds = this.secondsUntilRefresh();
    if (seconds === null) {
      return null;
    }

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
  });

  /** Am Nullpunkt laden alle Kacheln - dann "Aktualisiert ..." statt eines scheinbar stehenden Zählers. */
  protected readonly isRefreshing = computed(() => this.secondsUntilRefresh() === 0);

  protected readonly availableTypes = this.store.availableWidgetTypes;

  /** Registry-Zugriff fürs Template (Titel im "Hinzufügen"-Menü). */
  protected readonly registry = WIDGET_REGISTRY;

  /**
   * Die Shell rechnet bewusst nichts aus: Der Store übernimmt Umsortieren,
   * Neu-Nummerieren UND Persistieren, damit hier niemand ans Speichern denken muss.
   */
  protected drop(event: CdkDragDrop<readonly DashboardWidgetInstance[]>): void {
    this.store.moveWidget(event.previousIndex, event.currentIndex);
  }

  protected addWidget(type: WidgetType): void {
    this.store.addWidget(type);
  }

  protected removeWidget(id: string): void {
    this.store.removeWidget(id);
  }

  protected resetLayout(): void {
    this.store.resetLayout();
  }
}
