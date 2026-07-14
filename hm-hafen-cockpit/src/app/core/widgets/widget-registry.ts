/**
 * Die einzige Stelle, an der Core die Features erwähnt - ausschließlich als
 * Lazy-Import: Ein Widget-Bundle wird erst geladen, wenn die Kachel auf dem Board liegt.
 * Ein neues Widget = neues Feature-Verzeichnis + EIN Eintrag hier.
 *
 * `Record<WidgetType, WidgetDefinition>` erzwingt Vollständigkeit: Ein neuer Typ ohne
 * Eintrag ist ein Compile-Fehler, kein Runtime-undefined.
 */

import type { WidgetDefinition, WidgetType } from './widget.model';

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  tide: {
    type: 'tide',
    title: 'Tide Hamburg St. Pauli',
    description: 'Aktueller Wasserstand und Wasserstandskurve der letzten 24 Stunden.',
    dataSource: 'PEGELONLINE (WSV)',
    loadComponent: () =>
      import('../../features/tide/ui/tide-widget.component').then((m) => m.TideWidgetComponent),
  },

  weather: {
    type: 'weather',
    title: 'Wetter Hamburg',
    description: 'Temperatur, Wind, Böen und Wetterlage der nächsten DWD-Station.',
    dataSource: 'Bright Sky / DWD',
    loadComponent: () =>
      import('../../features/weather/ui/weather-widget.component').then(
        (m) => m.WeatherWidgetComponent,
      ),
  },

  warnings: {
    type: 'warnings',
    title: 'DWD-Warnungen',
    description: 'Amtliche Unwetterwarnungen für die Warnzelle des Standorts.',
    dataSource: 'Bright Sky / DWD (CAP)',
    loadComponent: () =>
      import('../../features/warnings/ui/warnings-widget.component').then(
        (m) => m.WarningsWidgetComponent,
      ),
  },
};

/**
 * `noUncheckedIndexedAccess` greift hier nicht, weil `Record<WidgetType, ...>` ein
 * Mapped Type über einen endlichen Union ist - der Zugriff liefert `WidgetDefinition`.
 */
export function widgetDefinition(type: WidgetType): WidgetDefinition {
  return WIDGET_REGISTRY[type];
}
