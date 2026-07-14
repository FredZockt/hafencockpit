/**
 * Bright Sky /alerts - amtliche DWD-Warnungen (CAP).
 * Struktur aus der OpenAPI-3.1-Spec von Bright Sky, live verifiziert.
 *
 * Der DWD selbst liefert Warnstatusdaten als JSONP bzw. CAP/XML - aus einem
 * Frontend unsauber konsumierbar. Bright Sky stellt dieselben Daten als
 * CORS-fähiges JSON bereit.
 */

/** 'test' = Übungsmeldung, KEINE echte Warnung (wird im Mapper ausgefiltert). */
export type BrightSkyAlertStatus = 'actual' | 'test';

export type BrightSkyAlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme' | null;
export type BrightSkyAlertCategory = 'met' | 'health' | null;
export type BrightSkyAlertUrgency = 'immediate' | 'future' | null;
export type BrightSkyAlertCertainty = 'observed' | 'likely' | null;
export type BrightSkyAlertResponseType = 'prepare' | 'allclear' | 'none' | 'monitor' | null;

/**
 * Eine Warnung.
 *
 * Achtung, drei Feinheiten, die man leicht falsch annimmt:
 *  - Die Texte sind LOKALISIERT: `headline_de` / `headline_en`, nicht `headline`.
 *  - `id` ist eine Zahl (Bright-Sky-intern); die stabile CAP-Kennung ist `alert_id`.
 *  - `expires` ist nullable - eine Warnung ohne definiertes Ende ist zulässig.
 */
export interface BrightSkyAlertDto {
  readonly id: number;
  readonly alert_id: string;
  readonly status: BrightSkyAlertStatus;

  readonly effective: string;
  readonly onset: string;
  readonly expires: string | null;

  readonly category: BrightSkyAlertCategory;
  readonly response_type: BrightSkyAlertResponseType;
  readonly urgency: BrightSkyAlertUrgency;
  readonly severity: BrightSkyAlertSeverity;
  readonly certainty: BrightSkyAlertCertainty;

  readonly event_code: number | null;
  readonly event_de: string | null;
  readonly event_en: string | null;

  readonly headline_de: string;
  readonly headline_en: string;
  readonly description_de: string;
  readonly description_en: string;
  readonly instruction_de: string | null;
  readonly instruction_en: string | null;
}

/**
 * Die Warnzelle, für die die Warnungen gelten - DWD-Warnungen gelten nicht "für
 * Hamburg", sondern für eine konkrete Gemeinde-Warnzelle.
 */
export interface BrightSkyAlertLocationDto {
  readonly warn_cell_id: number;
  readonly name: string;
  readonly name_short: string;
  readonly district: string;
  readonly state: string;
  readonly state_short: string;
}

export interface BrightSkyAlertsResponseDto {
  /** Ein leeres Array ist der NORMALFALL bei ruhiger Wetterlage - kein Fehler. */
  readonly alerts: readonly BrightSkyAlertDto[];
  readonly location: BrightSkyAlertLocationDto | null;
}
