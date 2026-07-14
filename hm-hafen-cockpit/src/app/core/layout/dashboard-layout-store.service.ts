/**
 * Der Zustand des Cockpits und die einzige Schreibstelle für das Layout.
 * JEDE Mutation persistiert sofort - Persistenz ist damit kein Feature, an das
 * man denken muss, sondern eine Eigenschaft des Stores.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { WIDGET_REGISTRY } from '../widgets/widget-registry';
import type { DashboardWidgetInstance, WidgetType } from '../widgets/widget.model';
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayout,
  nextWidgetInstanceId,
} from './dashboard-layout.model';
import { DashboardLayoutRepository } from './dashboard-layout.repository';

@Injectable({ providedIn: 'root' })
export class DashboardLayoutStore {
  /** Nur der Vertrag, nicht die Implementierung - welche Technik dahintersteckt, entscheidet app.config.ts. */
  private readonly repository = inject(DashboardLayoutRepository);

  /** Initialwert direkt aus dem Speicher: localStorage ist synchron, kein Lade-Flackern. */
  private readonly layoutSignal = signal<DashboardLayout>(this.repository.load());

  /** Nach außen nur lesbar - Schreiben geht ausschließlich über die Methoden. */
  readonly layout = this.layoutSignal.asReadonly();

  readonly widgets = computed<readonly DashboardWidgetInstance[]>(() =>
    [...this.layoutSignal().widgets].sort((a, b) => a.position - b.position),
  );

  readonly isEmpty = computed(() => this.widgets().length === 0);

  /** Widget-Typen, die noch nicht auf dem Board liegen - speist das "Hinzufügen"-Menü. */
  readonly availableWidgetTypes = computed<readonly WidgetType[]>(() => {
    const used = new Set(this.widgets().map((widget) => widget.type));
    return Object.values(WIDGET_REGISTRY)
      .filter((definition) => !used.has(definition.type))
      .map((definition) => definition.type);
  });

  /**
   * Kachel verschieben. Indizes statt IDs, weil das CDK genau das liefert
   * (previousIndex / currentIndex bezogen auf die gerenderte Liste).
   */
  moveWidget(previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) {
      return;
    }

    const reordered = [...this.widgets()];
    moveItemInArray(reordered, previousIndex, currentIndex);
    this.updateWidgets(reordered);
  }

  addWidget(type: WidgetType): void {
    const current = this.widgets();

    const instance: DashboardWidgetInstance = {
      id: nextWidgetInstanceId(type, current),
      type,
      position: current.length,
    };

    this.updateWidgets([...current, instance]);
  }

  removeWidget(id: string): void {
    const remaining = this.widgets().filter((widget) => widget.id !== id);

    if (remaining.length === this.widgets().length) {
      return; // ID unbekannt - nichts zu tun, nichts zu speichern.
    }

    this.updateWidgets(remaining);
  }

  /** Löscht zusätzlich den Speicherstand, damit der nächste Kaltstart wirklich beim Default landet. */
  resetLayout(): void {
    this.repository.clear();
    this.layoutSignal.set(DEFAULT_DASHBOARD_LAYOUT);
    this.repository.save(DEFAULT_DASHBOARD_LAYOUT);
  }

  /**
   * Die einzige private Schreiboperation: neu nummerieren, Signal setzen, persistieren -
   * immer zusammen. So kann kein Aufrufer das Speichern vergessen.
   */
  private updateWidgets(widgets: readonly DashboardWidgetInstance[]): void {
    const renumbered = widgets.map((widget, index) => ({ ...widget, position: index }));

    const nextLayout: DashboardLayout = {
      version: DASHBOARD_LAYOUT_VERSION,
      widgets: renumbered,
    };

    this.layoutSignal.set(nextLayout);
    this.repository.save(nextLayout);
  }
}
