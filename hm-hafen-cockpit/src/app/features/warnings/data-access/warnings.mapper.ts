/**
 * CAP-DTOs -> WarningsOverview.
 *
 * Drei fachliche Entscheidungen, die nicht ins Template gehören:
 * Testmeldungen aussortieren, nach Schwere sortieren, "aktiv" gegen die Uhr bestimmen.
 */

import type {
  BrightSkyAlertCertainty,
  BrightSkyAlertDto,
  BrightSkyAlertLocationDto,
  BrightSkyAlertSeverity,
  BrightSkyAlertUrgency,
  BrightSkyAlertsResponseDto,
} from './brightsky-alerts.dto';
import {
  SEVERITY_RANK,
  type WarningArea,
  type WarningSeverity,
  type WarningsOverview,
  type WeatherWarning,
} from './warning.model';

/** `null` wird zu 'unbekannt', nicht zu 'gering' - eine Warnung ohne Stufe ist nicht harmlos. */
export function mapSeverity(severity: BrightSkyAlertSeverity): WarningSeverity {
  switch (severity) {
    case 'minor':
      return 'gering';
    case 'moderate':
      return 'mäßig';
    case 'severe':
      return 'schwer';
    case 'extreme':
      return 'extrem';
    case null:
      return 'unbekannt';
  }
}

export function mapUrgency(urgency: BrightSkyAlertUrgency): WeatherWarning['urgency'] {
  switch (urgency) {
    case 'immediate':
      return 'unmittelbar';
    case 'future':
      return 'zukünftig';
    case null:
      return 'unbekannt';
  }
}

export function mapCertainty(certainty: BrightSkyAlertCertainty): WeatherWarning['certainty'] {
  switch (certainty) {
    case 'observed':
      return 'beobachtet';
    case 'likely':
      return 'wahrscheinlich';
    case null:
      return 'unbekannt';
  }
}

/** `new Date(null)` wäre 1970, `new Date('')` "Invalid Date" - beides darf nie als Warnzeitraum erscheinen. */
function parseDate(value: string | null): Date | null {
  if (value === null || value === '') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param now Referenzzeit für `isActive` - hereingereicht, damit der Test die Uhr kontrolliert.
 * @returns `null`, wenn die Warnung keinen brauchbaren Beginn hat.
 */
export function mapWarning(dto: BrightSkyAlertDto, now: Date): WeatherWarning | null {
  const startsAt = parseDate(dto.onset);
  if (startsAt === null) {
    return null;
  }

  const endsAt = parseDate(dto.expires);

  const hasStarted = startsAt.getTime() <= now.getTime();
  // Fehlt `expires` (laut Spec zulässig), gilt die Warnung als weiterhin laufend.
  // Sie als "vorbei" zu behandeln wäre die gefährlichste aller Annahmen.
  const hasEnded = endsAt !== null && endsAt.getTime() < now.getTime();

  return {
    id: dto.alert_id,
    headline: dto.headline_de,
    event: dto.event_de,
    description: dto.description_de,
    instruction: dto.instruction_de,
    severity: mapSeverity(dto.severity),
    startsAt,
    endsAt,
    isActive: hasStarted && !hasEnded,
    urgency: mapUrgency(dto.urgency),
    certainty: mapCertainty(dto.certainty),
  };
}

export function mapArea(location: BrightSkyAlertLocationDto | null): WarningArea | null {
  if (location === null) {
    return null;
  }

  return {
    warnCellId: location.warn_cell_id,
    name: location.name,
    district: location.district,
    state: location.state,
  };
}

export function mapToWarningsOverview(
  response: BrightSkyAlertsResponseDto,
  now: Date = new Date(),
): WarningsOverview {
  // Testmeldungen raus: Eine Übungsmeldung, die wie eine echte Sturmflutwarnung
  // aussieht, ist ein Sicherheitsproblem. Sie werden aber mitgezählt, damit
  // "0 Warnungen" nicht heimlich "3 verschwiegen" heißt.
  const testAlerts = response.alerts.filter((alert) => alert.status === 'test');
  const realAlerts = response.alerts.filter((alert) => alert.status !== 'test');

  const warnings = realAlerts
    .map((alert) => mapWarning(alert, now))
    .filter((warning): warning is WeatherWarning => warning !== null)
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      return bySeverity !== 0 ? bySeverity : a.startsAt.getTime() - b.startsAt.getTime();
    });

  return {
    warnings,
    area: mapArea(response.location),
    filteredTestCount: testAlerts.length,
  };
}
