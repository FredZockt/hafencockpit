/**
 * Widget-Komponenten werden dynamisch erzeugt (NgComponentOutlet) - es gibt kein
 * Template, in dem man Inputs binden oder Outputs abfangen könnte. Der Loader gibt
 * ihnen deshalb per Injector diesen Kontext mit; das Widget zieht ihn per `inject()`.
 *
 * Bewusst NICHT der Layout-Store: Ein Widget soll nur wissen "Ich habe eine ID, und
 * es gibt eine Aktion 'entferne mich'" - nicht, wer das ausführt und wo es persistiert.
 */

import { InjectionToken, inject } from '@angular/core';
import type { DashboardWidgetInstance } from './widget.model';

export interface WidgetContext {
  readonly instance: DashboardWidgetInstance;
  /** "Nimm mich vom Board." Die Umsetzung liegt beim Dashboard. */
  readonly remove: () => void;
}

export const WIDGET_CONTEXT = new InjectionToken<WidgetContext>('WIDGET_CONTEXT');

/**
 * `optional: true` ist wichtig: Im Unit-Test wird ein Widget oft ohne Dashboard
 * gerendert. Fehlender Kontext darf kein DI-Fehler sein - das Widget zeigt dann
 * eben keinen Entfernen-Knopf.
 */
export function injectWidgetContext(): WidgetContext | null {
  return inject(WIDGET_CONTEXT, { optional: true });
}
