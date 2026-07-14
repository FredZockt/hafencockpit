/**
 * Das persistierte Datenmodell des Cockpits - das Einzige, was in localStorage landet.
 * Es trägt eine `version`, weil auf einem Rechner noch alte Stände liegen können.
 */

import type { DashboardWidgetInstance } from '../widgets/widget.model';

/**
 * Bei inkompatibler Änderung erhöhen: Das Repository verwirft alte Stände dann
 * kontrolliert und fällt auf das Default-Layout zurück.
 */
export const DASHBOARD_LAYOUT_VERSION = 1;

export interface DashboardLayout {
  readonly version: typeof DASHBOARD_LAYOUT_VERSION;
  readonly widgets: readonly DashboardWidgetInstance[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: DASHBOARD_LAYOUT_VERSION,
  widgets: [
    { id: 'tide-main', type: 'tide', position: 0 },
    { id: 'weather-main', type: 'weather', position: 1 },
    { id: 'warnings-main', type: 'warnings', position: 2 },
    { id: 'ship-traffic-main', type: 'ship-traffic', position: 3 },
  ],
};

/**
 * Neue, kollisionsfreie Instanz-ID für einen Widget-Typ.
 * Bewusst kein `crypto.randomUUID()`: 'tide-2' ist im localStorage-Inspector lesbar,
 * und wir brauchen nur Eindeutigkeit innerhalb eines Boards.
 */
export function nextWidgetInstanceId(
  type: string,
  existing: readonly DashboardWidgetInstance[],
): string {
  const taken = new Set(existing.map((widget) => widget.id));

  const preferred = `${type}-main`;
  if (!taken.has(preferred)) {
    return preferred;
  }

  let counter = 2;
  while (taken.has(`${type}-${counter}`)) {
    counter += 1;
  }
  return `${type}-${counter}`;
}
