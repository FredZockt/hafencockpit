/**
 * Abstrakter Persistenz-Vertrag. Der Store kennt nur ihn, nie eine konkrete
 * Speichertechnik (localStorage, IndexedDB, Backend-Profil, In-Memory im Test).
 *
 * Abstrakte Klasse statt Interface, weil ein Interface zur Laufzeit nicht
 * existiert und damit kein DI-Token sein kann.
 */

import type { DashboardLayout } from './dashboard-layout.model';

export abstract class DashboardLayoutRepository {
  /**
   * Wirft NICHT: Ein fehlender, kaputter oder veralteter Speicherstand führt zum
   * Default-Layout. Ein Dashboard, das an einem kaputten localStorage-Eintrag gar
   * nicht mehr startet, wäre unbrauchbar.
   */
  abstract load(): DashboardLayout;

  /** Speichert das Layout. Wirft ebenfalls nicht (siehe Implementierung). */
  abstract save(layout: DashboardLayout): void;

  /** Löscht den Speicherstand (für "Layout zurücksetzen"). */
  abstract clear(): void;
}
