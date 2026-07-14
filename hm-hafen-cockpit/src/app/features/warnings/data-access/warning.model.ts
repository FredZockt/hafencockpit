/** Warnungen - Domain-Modell. */

/**
 * Warnstufe. 'unbekannt' ist bewusst Teil der Union: CAP erlaubt `severity: null`,
 * und eine Warnung ohne Stufe darf nicht stillschweigend als harmlos durchgehen.
 */
export type WarningSeverity = 'gering' | 'mäßig' | 'schwer' | 'extrem' | 'unbekannt';

/** Fachliche Rangfolge zum Sortieren - gehört ins Domain-Modell, nicht ins Template. */
export const SEVERITY_RANK: Readonly<Record<WarningSeverity, number>> = {
  extrem: 4,
  schwer: 3,
  mäßig: 2,
  gering: 1,
  unbekannt: 0,
};

export interface WeatherWarning {
  /** Die CAP-Kennung - stabiler als die Bright-Sky-interne Zahl. */
  readonly id: string;

  readonly headline: string;
  readonly event: string | null;
  readonly description: string;
  readonly instruction: string | null;
  readonly severity: WarningSeverity;

  readonly startsAt: Date;
  /** `null`, wenn der DWD kein Ende angibt (laut CAP-Spec zulässig). */
  readonly endsAt: Date | null;

  /** Läuft die Warnung JETZT? Wird beim Mappen gegen die aktuelle Zeit bestimmt. */
  readonly isActive: boolean;

  readonly urgency: 'unmittelbar' | 'zukünftig' | 'unbekannt';
  readonly certainty: 'beobachtet' | 'wahrscheinlich' | 'unbekannt';
}

export interface WarningArea {
  readonly warnCellId: number;
  readonly name: string;
  readonly district: string;
  readonly state: string;
}

export interface WarningsOverview {
  /** Nach Dringlichkeit sortiert. LEER ist der Normalfall - und kein Fehler. */
  readonly warnings: readonly WeatherWarning[];
  readonly area: WarningArea | null;
  /** Ausgefilterte Testmeldungen - wird angezeigt, damit "0 Warnungen" ehrlich bleibt. */
  readonly filteredTestCount: number;
}
