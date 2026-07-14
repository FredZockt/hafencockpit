import { mapArea, mapSeverity, mapToWarningsOverview, mapWarning } from './warnings.mapper';
import type {
  BrightSkyAlertDto,
  BrightSkyAlertLocationDto,
  BrightSkyAlertsResponseDto,
} from './brightsky-alerts.dto';

/** Live-Warnzelle für die Hamburger Koordinaten. */
const LOCATION: BrightSkyAlertLocationDto = {
  warn_cell_id: 702000106,
  name: 'Hamburg-Mitte/Ost',
  name_short: 'HH-Mitte/Ost',
  district: 'Hamburg',
  state: 'Hamburg',
  state_short: 'HH',
};

/** Warnung im Format der Bright-Sky-OpenAPI-Spec. */
function alert(overrides: Partial<BrightSkyAlertDto> = {}): BrightSkyAlertDto {
  return {
    id: 279977,
    alert_id: '2.49.0.0.276.0.DWD.PVW.1691344680000.2cf9fad6-dc83-44ba-9e88-f2827439da59',
    status: 'actual',
    effective: '2026-07-14T10:00:00+02:00',
    onset: '2026-07-14T12:00:00+02:00',
    expires: '2026-07-14T18:00:00+02:00',
    category: 'met',
    response_type: 'prepare',
    urgency: 'immediate',
    severity: 'severe',
    certainty: 'likely',
    event_code: 51,
    event_de: 'WINDBOEEN',
    event_en: 'wind gusts',
    headline_de: 'Amtliche WARNUNG vor WINDBOEEN',
    headline_en: 'Official WARNING of WIND GUSTS',
    description_de: 'Es treten Windboeen mit Geschwindigkeiten bis 60 km/h auf.',
    description_en: 'There is a risk of wind gusts.',
    instruction_de: 'Achten Sie auf herabfallende Aeste.',
    instruction_en: 'Watch out for falling branches.',
    ...overrides,
  };
}

const NOW = new Date('2026-07-14T14:00:00+02:00');

describe('mapSeverity', () => {
  it('übersetzt die CAP-Warnstufen', () => {
    expect(mapSeverity('minor')).toBe('gering');
    expect(mapSeverity('moderate')).toBe('mäßig');
    expect(mapSeverity('severe')).toBe('schwer');
    expect(mapSeverity('extreme')).toBe('extrem');
  });

  it('macht aus einer fehlenden Stufe "unbekannt" - nicht "gering"', () => {
    // CAP erlaubt severity: null. Das als harmlos zu deuten wäre die
    // gefährlichste Abkürzung im ganzen Projekt.
    expect(mapSeverity(null)).toBe('unbekannt');
  });
});

describe('mapWarning', () => {
  it('liest die DEUTSCHEN Textfelder (headline_de, nicht headline)', () => {
    // Die Felder heißen headline_de / headline_en. Ein Zugriff auf `headline`
    // hätte die Kachel stumm leer gelassen.
    const warning = mapWarning(alert(), NOW);

    expect(warning?.headline).toBe('Amtliche WARNUNG vor WINDBOEEN');
    expect(warning?.event).toBe('WINDBOEEN');
    expect(warning?.instruction).toBe('Achten Sie auf herabfallende Aeste.');
  });

  it('nutzt die CAP-Kennung als stabile ID (nicht die interne Zahl)', () => {
    expect(mapWarning(alert(), NOW)?.id).toBe(
      '2.49.0.0.276.0.DWD.PVW.1691344680000.2cf9fad6-dc83-44ba-9e88-f2827439da59',
    );
  });

  it('erkennt eine laufende Warnung', () => {
    // onset 12:00, expires 18:00, jetzt 14:00 -> läuft.
    expect(mapWarning(alert(), NOW)?.isActive).toBe(true);
  });

  it('erkennt eine angekündigte, noch nicht begonnene Warnung', () => {
    const upcoming = alert({
      onset: '2026-07-14T20:00:00+02:00',
      expires: '2026-07-14T23:00:00+02:00',
    });
    expect(mapWarning(upcoming, NOW)?.isActive).toBe(false);
  });

  it('erkennt eine abgelaufene Warnung', () => {
    const expired = alert({
      onset: '2026-07-14T06:00:00+02:00',
      expires: '2026-07-14T09:00:00+02:00',
    });
    expect(mapWarning(expired, NOW)?.isActive).toBe(false);
  });

  it('behandelt eine Warnung OHNE Ende als weiterhin laufend', () => {
    // `expires` ist laut Spec nullable - eine Warnung ohne Ende als "vorbei" zu
    // behandeln wäre die gefährlichste aller Annahmen.
    const openEnded = mapWarning(alert({ expires: null }), NOW);

    expect(openEnded?.endsAt).toBeNull();
    expect(openEnded?.isActive).toBe(true);
  });

  it('verwirft eine Warnung mit unbrauchbarem Beginn', () => {
    expect(mapWarning(alert({ onset: 'kaputt' }), NOW)).toBeNull();
  });
});

describe('mapArea', () => {
  it('übernimmt die Warnzelle', () => {
    const area = mapArea(LOCATION);

    expect(area?.warnCellId).toBe(702000106);
    expect(area?.name).toBe('Hamburg-Mitte/Ost');
  });

  it('kommt ohne Warnzelle zurecht', () => {
    expect(mapArea(null)).toBeNull();
  });
});

describe('mapToWarningsOverview', () => {
  it('filtert TESTWARNUNGEN heraus - zählt sie aber mit', () => {
    // Sicherheitsrelevant: Eine Übungsmeldung darf nicht wie eine echte Warnung
    // aussehen. Sie wird ausgeblendet, aber GEZÄHLT - "0 Warnungen" darf nie
    // heimlich heißen "wir haben etwas verschwiegen".
    const response: BrightSkyAlertsResponseDto = {
      alerts: [alert({ status: 'test' }), alert({ alert_id: 'echt-1', status: 'actual' })],
      location: LOCATION,
    };

    const overview = mapToWarningsOverview(response, NOW);

    expect(overview.warnings).toHaveLength(1);
    expect(overview.warnings[0]?.id).toBe('echt-1');
    expect(overview.filteredTestCount).toBe(1);
  });

  it('sortiert nach Schwere - die dringendste Warnung steht oben', () => {
    const response: BrightSkyAlertsResponseDto = {
      alerts: [
        alert({ alert_id: 'gering', severity: 'minor' }),
        alert({ alert_id: 'extrem', severity: 'extreme' }),
        alert({ alert_id: 'maessig', severity: 'moderate' }),
      ],
      location: LOCATION,
    };

    const ids = mapToWarningsOverview(response, NOW).warnings.map((warning) => warning.id);

    expect(ids).toEqual(['extrem', 'maessig', 'gering']);
  });

  it('sortiert bei gleicher Schwere nach Beginn (ältere zuerst)', () => {
    const response: BrightSkyAlertsResponseDto = {
      alerts: [
        alert({ alert_id: 'spaeter', severity: 'severe', onset: '2026-07-14T13:00:00+02:00' }),
        alert({ alert_id: 'frueher', severity: 'severe', onset: '2026-07-14T11:00:00+02:00' }),
      ],
      location: LOCATION,
    };

    const ids = mapToWarningsOverview(response, NOW).warnings.map((warning) => warning.id);

    expect(ids).toEqual(['frueher', 'spaeter']);
  });

  it('behandelt "keine Warnungen" als gültiges Ergebnis, nicht als Fehler', () => {
    const overview = mapToWarningsOverview({ alerts: [], location: LOCATION }, NOW);

    expect(overview.warnings).toEqual([]);
    expect(overview.filteredTestCount).toBe(0);
    // Die Warnzelle bleibt erhalten - der Empty-State kann belegen, WOFÜR geprüft wurde.
    expect(overview.area?.name).toBe('Hamburg-Mitte/Ost');
  });
});
