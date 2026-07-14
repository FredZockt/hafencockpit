/**
 * App-weites Fehlermodell. Die Repositories mappen JEDEN Fehler hierauf, damit
 * die Widgets nur `AppError` kennen und sich einheitlich verhalten.
 */

/** Grobe Fehlerklasse - steuert die Formulierung im ErrorState, nicht die Diagnose. */
export type AppErrorKind =
  /** Server nicht erreichbar, DNS/Offline, CORS-Abbruch (HTTP-Status 0). */
  | 'network'
  | 'client'
  | 'server'
  /** Antwort kam an, sah aber nicht aus wie erwartet (Type Guard schlug fehl). */
  | 'format'
  | 'unknown';

/**
 * Der EINE Fehlertyp, den die UI kennt.
 *
 * `| undefined` ist explizit deklariert, weil `exactOptionalPropertyTypes: true`
 * gesetzt ist und die Mapper `x ?? undefined` zuweisen.
 */
export interface AppError {
  readonly message: string;
  readonly kind: AppErrorKind;
  readonly statusCode?: number | undefined;
  /** Die aufgerufene URL - hilft im Support. */
  readonly source?: string | undefined;
  /** Originalmeldung der Gegenstelle, nur für Details/Debug. */
  readonly technicalMessage?: string | undefined;
}
