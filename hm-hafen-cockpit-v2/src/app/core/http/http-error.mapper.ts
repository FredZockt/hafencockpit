/**
 * Fehler-Mapper: unknown -> AppError.
 * `catchError` liefert `unknown`; der Typ wird per `instanceof` eingeengt, damit
 * an keiner Stelle ein `any` in die App gelangt.
 */

import { HttpErrorResponse } from '@angular/common/http';
import type { AppError, AppErrorKind } from './http-error.model';

/**
 * Wird geworfen, wenn eine API zwar antwortet, die Antwort aber den Type Guard
 * nicht besteht. Macht "API-Vertrag verletzt" von "Netzwerk kaputt" unterscheidbar.
 */
export class DataFormatError extends Error {
  constructor(
    message: string,
    readonly sourceUrl?: string,
  ) {
    super(message);
    this.name = 'DataFormatError';
  }
}

function kindFromStatus(status: number): AppErrorKind {
  // Status 0 = Request kam nicht durch: offline, DNS, abgebrochen oder von CORS
  // blockiert. Der Browser verrät aus Sicherheitsgründen nicht, welches davon.
  if (status === 0) {
    return 'network';
  }
  if (status >= 400 && status < 500) {
    return 'client';
  }
  if (status >= 500) {
    return 'server';
  }
  return 'unknown';
}

function messageFromStatus(status: number): string {
  switch (kindFromStatus(status)) {
    case 'network':
      return 'Die Datenquelle ist nicht erreichbar. Bitte Netzwerkverbindung prüfen.';
    case 'client':
      return status === 404
        ? 'Die angefragte Messstelle wurde nicht gefunden (HTTP 404).'
        : `Die Anfrage wurde von der Datenquelle abgelehnt (HTTP ${status}).`;
    case 'server':
      return `Die Datenquelle meldet eine Störung (HTTP ${status}).`;
    case 'format':
    case 'unknown':
      return `Unerwartete Antwort der Datenquelle (HTTP ${status}).`;
  }
}

/** Der zentrale Mapper - jeder `catchError` in der App geht hier durch. */
export function mapUnknownError(error: unknown): AppError {
  if (error instanceof HttpErrorResponse) {
    return {
      message: messageFromStatus(error.status),
      kind: kindFromStatus(error.status),
      statusCode: error.status,
      source: error.url ?? undefined,
      technicalMessage: error.message,
    };
  }

  if (error instanceof DataFormatError) {
    return {
      message: 'Die Datenquelle hat ein unerwartetes Datenformat geliefert.',
      kind: 'format',
      source: error.sourceUrl,
      technicalMessage: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      kind: 'unknown',
      technicalMessage: error.stack ?? undefined,
    };
  }

  // Es wurde etwas geworfen, das gar kein Error ist (String, Objekt, ...).
  return {
    message: 'Unbekannter Fehler beim Laden der Daten.',
    kind: 'unknown',
  };
}
