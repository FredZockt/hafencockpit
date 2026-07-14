/**
 * Die Grenze zwischen Core und Features: Core kennt die Widget-TYPEN, aber nichts
 * von PEGELONLINE, Pegelnullpunkten oder Tidekurven.
 */

import type { Type } from '@angular/core';

/**
 * String-Union statt Enum, weil der Wert 1:1 in localStorage landet.
 * Neuer Widget-Typ = ein Eintrag hier + ein Eintrag in der Registry.
 */
export type WidgetType = 'tide' | 'weather' | 'warnings' | 'ship-traffic';

/** `satisfies` sorgt für einen Compile-Fehler, wenn oben ein Typ ergänzt und hier vergessen wird. */
export const ALL_WIDGET_TYPES = [
  'tide',
  'weather',
  'warnings',
  'ship-traffic',
] as const satisfies readonly WidgetType[];

/**
 * Typ != Instanz: Der Nutzer darf zweimal "Tide" auf sein Board legen; dann gibt
 * es zwei Instanzen ('tide-main', 'tide-2') vom selben Typ 'tide'.
 */
export type WidgetInstanceId = string;

/*
 * Es gibt bewusst KEINE WidgetSize mehr: Das Cockpit zeigt ein gleichförmiges
 * Raster - jede Kachel ist ein Drittel breit und exakt so hoch wie alle anderen.
 */

/** Statische Beschreibung eines Widget-TYPS (nicht einer Instanz). Lebt in der WIDGET_REGISTRY. */
export interface WidgetDefinition {
  readonly type: WidgetType;
  readonly title: string;
  readonly description: string;
  /** Die Datenquelle im Klartext - im Widget-Rahmen sichtbar, damit klar ist, woher eine Zahl stammt. */
  readonly dataSource: string;

  /** Lazy-Loader; das `import()` im Registry-Eintrag ist die Bedingung für einen eigenen Chunk. */
  readonly loadComponent: () => Promise<Type<unknown>>;
}

/** EINE konkrete Kachel auf dem Board - genau dieses Objekt wird persistiert. */
export interface DashboardWidgetInstance {
  readonly id: WidgetInstanceId;
  readonly type: WidgetType;
  /** Reihenfolge im Grid, nach jedem Drop neu durchnummeriert (0..n-1). */
  readonly position: number;
}

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && (ALL_WIDGET_TYPES as readonly string[]).includes(value);
}
