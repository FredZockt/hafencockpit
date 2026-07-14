/**
 * Layout-Persistenz in localStorage.
 *
 * localStorage ist UNTRUSTED INPUT: Der Inhalt kann fehlen, von einer älteren
 * App-Version stammen, in den DevTools manipuliert oder schlicht Müll sein.
 * Der geparste Wert wird deshalb als `unknown` behandelt und Feld für Feld durch
 * Type Guards geschleust; was nicht standhält, wird verworfen statt repariert.
 *
 * Alte Stände tragen je Kachel noch ein `size`-Feld. Wir lesen gezielt nur die
 * bekannten Felder - `size` wird damit ignoriert. Das Weglassen eines Feldes ist
 * abwärtskompatibel und braucht keine neue Schema-Version.
 */

import { Injectable } from '@angular/core';
import { type DashboardWidgetInstance, isWidgetType } from '../widgets/widget.model';
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayout,
} from './dashboard-layout.model';
import { DashboardLayoutRepository } from './dashboard-layout.repository';

@Injectable()
export class LocalStorageDashboardLayoutRepository extends DashboardLayoutRepository {
  /** Version im Key: Ein künftiges v2-Layout kollidiert nicht mit v1. */
  private readonly storageKey = 'harbor-cockpit.dashboard-layout.v1';

  override load(): DashboardLayout {
    const rawValue = this.readRaw();
    if (rawValue === null) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }

    return this.sanitize(parsedValue);
  }

  override save(layout: DashboardLayout): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(layout));
    } catch {
      /*
       * Bewusst geschluckt (Quota, Safari-Privatmodus, Browser-Policy). Keiner
       * dieser Gründe rechtfertigt es, das Cockpit zu zerschießen - das Layout
       * bleibt dann eben nur für diese Sitzung bestehen.
       */
    }
  }

  override clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* siehe save() */
    }
  }

  private readRaw(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  /**
   * Baut aus dem geparsten Wert ein garantiert gültiges Layout.
   * Bewusst tolerant: Einzelne kaputte Kacheln werden aussortiert, der Rest des
   * Boards bleibt erhalten. Nur wenn nichts Brauchbares übrig ist, greift der Default.
   */
  private sanitize(value: unknown): DashboardLayout {
    if (!this.isRecord(value)) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }

    // Ein v2-Stand wird von dieser v1-App nicht interpretiert.
    if (value['version'] !== DASHBOARD_LAYOUT_VERSION) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }

    const rawWidgets: unknown = value['widgets'];
    if (!Array.isArray(rawWidgets)) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }

    const seenIds = new Set<string>();
    const widgets: DashboardWidgetInstance[] = [];

    for (const candidate of rawWidgets as readonly unknown[]) {
      const widget = this.toWidgetInstance(candidate);
      if (widget === null) {
        continue;
      }
      if (seenIds.has(widget.id)) {
        continue; // doppelte IDs würden @for(track) und Drag & Drop durcheinanderbringen
      }
      seenIds.add(widget.id);
      widgets.push(widget);
    }

    if (widgets.length === 0) {
      // Ein leeres Board ist zulässig (Nutzer hat alles entfernt) - aber nur, wenn
      // die Quelle auch wirklich leer war. War sie voller Müll, ist der Default ehrlicher.
      return rawWidgets.length === 0
        ? { version: DASHBOARD_LAYOUT_VERSION, widgets: [] }
        : DEFAULT_DASHBOARD_LAYOUT;
    }

    // Positionen lückenlos neu vergeben - der gespeicherte Stand kann Lücken haben.
    const ordered = [...widgets]
      .sort((a, b) => a.position - b.position)
      .map((widget, index) => ({ ...widget, position: index }));

    return { version: DASHBOARD_LAYOUT_VERSION, widgets: ordered };
  }

  /** Prüft EINE Kachel. `null`, wenn sie nicht rettbar ist. */
  private toWidgetInstance(value: unknown): DashboardWidgetInstance | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const id: unknown = value['id'];
    const type: unknown = value['type'];
    const position: unknown = value['position'];

    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }

    /*
     * Der wichtigste Guard: Entfernt eine künftige App-Version einen Widget-Typ,
     * liegt er weiterhin in localStorage. Ohne diesen Check lieferte
     * WIDGET_REGISTRY[type] `undefined` und der WidgetLoader stürzte bei
     * loadComponent() ab.
     */
    if (!isWidgetType(type)) {
      return null;
    }

    return {
      id,
      type,
      // Unbrauchbare Position -> ans Ende sortieren, statt die Kachel zu verlieren.
      position:
        typeof position === 'number' && Number.isFinite(position)
          ? position
          : Number.MAX_SAFE_INTEGER,
    };
  }

  /** `Record<string, unknown>` statt `object`, damit `value['x']` typsicher `unknown` liefert. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
