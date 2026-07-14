/**
 * Der Schwerpunkt liegt auf den AIS-Fallen: Sentinel-Werte, Zahlencodes und die
 * ETA ohne Jahr. Genau das ist die Sorte Fehler, die stillschweigend Unsinn
 * anzeigt, statt zu krachen.
 */

import { DEFAULT_HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import type { AisSnapshotDto, AisVesselDto } from './ais.dto';
import {
  deriveDirection,
  distanceKm,
  isBoundForHamburg,
  mapNavStatus,
  mapShipType,
  mapToShipTraffic,
  mapVessel,
  parseEta,
  toCourseDeg,
  toPosition,
  toSpeedKn,
} from './ship-traffic.mapper';

const HARBOR = DEFAULT_HARBOR_COCKPIT_CONFIG.harborLocation; // 53.5511 / 9.9937
const NOW = new Date('2026-07-14T14:00:00+02:00');

const OPTIONS = { harbor: HARBOR, radiusKm: 25, maxVessels: 25 };

function vessel(overrides: Partial<AisVesselDto> = {}): AisVesselDto {
  return {
    mmsi: 211331640,
    name: 'CMA CGM MARCO POLO',
    callSign: 'DHBN',
    shipType: 70,
    navigationalStatus: 0,
    latitude: 53.54,
    longitude: 9.9,
    sog: 11.4,
    cog: 78,
    trueHeading: 80,
    destination: 'DEHAM',
    eta: { month: 7, day: 14, hour: 18, minute: 20 },
    timeUtc: '2026-07-14T11:59:00Z',
    ...overrides,
  };
}

describe('Sentinel-Werte', () => {
  it('macht aus SOG 102.3 ein null - nicht 102 Knoten', () => {
    // Der klassische AIS-Fehler: 102.3 heißt "unbekannt", nicht "sehr schnell".
    expect(toSpeedKn(102.3)).toBeNull();
    expect(toSpeedKn(11.4)).toBe(11.4);
    expect(toSpeedKn(0)).toBe(0); // 0 kn ist ein gültiger Messwert!
  });

  it('macht aus COG 360 ein null', () => {
    expect(toCourseDeg(360)).toBeNull();
    expect(toCourseDeg(78)).toBe(78);
    expect(toCourseDeg(0)).toBe(0); // Kurs Nord ist gültig
  });

  it('verwirft die Position lat 91 / lon 181', () => {
    expect(toPosition(91, 181)).toBeNull();
    expect(toPosition(53.54, 9.9)).toEqual({ lat: 53.54, lon: 9.9 });
  });

  it('verwirft ein Schiff ohne brauchbare Position komplett', () => {
    expect(mapVessel(vessel({ latitude: 91, longitude: 181 }), HARBOR, NOW)).toBeNull();
  });
});

describe('AIS-Zahlencodes', () => {
  it('übersetzt den Schiffstyp', () => {
    expect(mapShipType(70)).toBe('Frachter');
    expect(mapShipType(79)).toBe('Frachter');
    expect(mapShipType(80)).toBe('Tanker');
    expect(mapShipType(60)).toBe('Passagierschiff');
    expect(mapShipType(52)).toBe('Schlepper');
    expect(mapShipType(50)).toBe('Lotsenboot');
    expect(mapShipType(null)).toBe('unbekannt');
  });

  it('übersetzt den Navigationsstatus', () => {
    expect(mapNavStatus(0)).toBe('in Fahrt');
    expect(mapNavStatus(1)).toBe('vor Anker');
    expect(mapNavStatus(5)).toBe('festgemacht');
  });

  it('behandelt Status 15 ("undefined") als unbekannt - das ist der Alltag', () => {
    expect(mapNavStatus(15)).toBe('unbekannt');
    expect(mapNavStatus(null)).toBe('unbekannt');
  });
});

describe('parseEta', () => {
  it('baut aus Monat/Tag/Stunde/Minute ein Datum im passenden Jahr', () => {
    // AIS liefert KEIN Jahr. Wir wählen das Jahr, das am nächsten an "jetzt" liegt.
    const eta = parseEta({ month: 7, day: 14, hour: 18, minute: 20 }, NOW);

    expect(eta?.getFullYear()).toBe(2026);
    expect(eta?.getMonth()).toBe(6); // Juli
    expect(eta?.getDate()).toBe(14);
    expect(eta?.getHours()).toBe(18);
  });

  it('wählt das nächste Jahr, wenn das plausibler ist', () => {
    // Silvester: Eine Januar-ETA gehört ins Folgejahr, nicht elf Monate zurück.
    const dezember = new Date('2026-12-28T10:00:00+01:00');
    const eta = parseEta({ month: 1, day: 3, hour: 6, minute: 0 }, dezember);

    expect(eta?.getFullYear()).toBe(2027);
  });

  it('liefert null bei den AIS-Codes für "nicht gesetzt"', () => {
    // Monat/Tag 0 und Stunde 24 / Minute 60 heißen laut Spec "nicht verfügbar".
    expect(parseEta({ month: 0, day: 0, hour: 24, minute: 60 }, NOW)).toBeNull();
    expect(parseEta({ month: 13, day: 1, hour: 0, minute: 0 }, NOW)).toBeNull();
    expect(parseEta(null, NOW)).toBeNull();
  });
});

describe('isBoundForHamburg', () => {
  it('erkennt die üblichen Schreibweisen im Freitext-Zielfeld', () => {
    // Das Feld wird auf der Brücke von Hand eingetippt.
    expect(isBoundForHamburg('HAMBURG')).toBe(true);
    expect(isBoundForHamburg('hamburg,ger')).toBe(true);
    expect(isBoundForHamburg('DEHAM')).toBe(true);
    expect(isBoundForHamburg('DE HAM')).toBe(true);
    expect(isBoundForHamburg('HH')).toBe(true);
  });

  it('lässt sich von anderen Zielen nicht täuschen', () => {
    expect(isBoundForHamburg('ROTTERDAM')).toBe(false);
    expect(isBoundForHamburg('BREMERHAVEN')).toBe(false);
    expect(isBoundForHamburg(null)).toBe(false);
  });
});

describe('deriveDirection', () => {
  const westlichVomHafen = { lat: 53.54, lon: 9.8 }; // Hafen liegt östlich davon
  const harbor = { lat: HARBOR.latitude, lon: HARBOR.longitude };

  it('meldet "liegt" für festgemachte Schiffe - egal was im Zielfeld steht', () => {
    expect(
      deriveDirection(
        { destination: 'HAMBURG', courseDeg: 15, navStatus: 'festgemacht' },
        westlichVomHafen,
        harbor,
      ),
    ).toBe('liegt');
  });

  it('nimmt Hamburg im Zielfeld als stärkstes Signal', () => {
    expect(
      deriveDirection(
        { destination: 'DEHAM', courseDeg: 78, navStatus: 'in Fahrt' },
        westlichVomHafen,
        harbor,
      ),
    ).toBe('einlaufend');
  });

  it('leitet die Richtung sonst aus dem Kurs ab', () => {
    // Kurs Ost (~90°) zeigt vom Punkt westlich des Hafens auf den Hafen zu.
    expect(
      deriveDirection(
        { destination: 'ROTTERDAM', courseDeg: 90, navStatus: 'in Fahrt' },
        westlichVomHafen,
        harbor,
      ),
    ).toBe('einlaufend');

    // Kurs West führt vom Hafen weg.
    expect(
      deriveDirection(
        { destination: 'ROTTERDAM', courseDeg: 270, navStatus: 'in Fahrt' },
        westlichVomHafen,
        harbor,
      ),
    ).toBe('auslaufend');
  });

  it('sagt "unbekannt" statt zu raten, wenn der Kurs fehlt', () => {
    expect(
      deriveDirection(
        { destination: 'ROTTERDAM', courseDeg: null, navStatus: 'in Fahrt' },
        westlichVomHafen,
        harbor,
      ),
    ).toBe('unbekannt');
  });
});

describe('distanceKm', () => {
  it('rechnet die Luftlinie plausibel', () => {
    const nullDistanz = distanceKm(
      { lat: HARBOR.latitude, lon: HARBOR.longitude },
      { lat: HARBOR.latitude, lon: HARBOR.longitude },
    );
    expect(nullDistanz).toBeCloseTo(0, 5);

    // ~0.1° Länge auf dieser Breite sind grob 6-7 km.
    const einStueck = distanceKm(
      { lat: 53.5511, lon: 9.9937 },
      { lat: 53.5511, lon: 9.8937 },
    );
    expect(einStueck).toBeGreaterThan(5);
    expect(einStueck).toBeLessThan(8);
  });
});

describe('mapToShipTraffic', () => {
  function snapshot(vessels: readonly AisVesselDto[]): AisSnapshotDto {
    return { generatedAt: '2026-07-14T12:00:00Z', vessels };
  }

  it('sortiert nach Entfernung zum Hafen', () => {
    const overview = mapToShipTraffic(
      snapshot([
        vessel({ mmsi: 1, latitude: 53.54, longitude: 9.7 }), // weiter weg
        vessel({ mmsi: 2, latitude: 53.55, longitude: 9.99 }), // fast am Hafen
      ]),
      OPTIONS,
      NOW,
    );

    expect(overview.vessels.map((ship) => ship.id)).toEqual(['2', '1']);
  });

  it('verwirft Schiffe außerhalb des Radius - und ZÄHLT sie', () => {
    // "12 Schiffe" darf nicht heimlich heißen, dass 30 unter den Tisch fielen.
    const overview = mapToShipTraffic(
      snapshot([
        vessel({ mmsi: 1 }),
        vessel({ mmsi: 2, latitude: 54.5, longitude: 8.0 }), // weit weg
        vessel({ mmsi: 3, latitude: 91, longitude: 181 }), // ohne Position
      ]),
      OPTIONS,
      NOW,
    );

    expect(overview.vessels).toHaveLength(1);
    expect(overview.discardedCount).toBe(2);
  });

  it('zählt ein- und auslaufende Schiffe', () => {
    const overview = mapToShipTraffic(
      snapshot([
        vessel({ mmsi: 1, destination: 'HAMBURG' }),
        vessel({ mmsi: 2, destination: 'ROTTERDAM', latitude: 53.54, longitude: 9.9, cog: 270 }),
      ]),
      OPTIONS,
      NOW,
    );

    expect(overview.inboundCount).toBe(1);
    expect(overview.outboundCount).toBe(1);
  });

  it('begrenzt die Liste auf maxVessels', () => {
    const viele = Array.from({ length: 40 }, (_, index) =>
      vessel({ mmsi: index + 1, latitude: 53.55, longitude: 9.99 }),
    );

    const overview = mapToShipTraffic(snapshot(viele), { ...OPTIONS, maxVessels: 10 }, NOW);

    expect(overview.vessels).toHaveLength(10);
  });

  it('zeigt statt eines fehlenden Namens die MMSI - eine leere Zeile hilft niemandem', () => {
    const overview = mapToShipTraffic(snapshot([vessel({ mmsi: 4242, name: null })]), OPTIONS, NOW);

    expect(overview.vessels[0]?.name).toBe('MMSI 4242');
  });

  it('fängt einen kaputten Snapshot-Zeitstempel ab', () => {
    const overview = mapToShipTraffic(
      { generatedAt: 'unsinn', vessels: [vessel()] },
      OPTIONS,
      NOW,
    );

    expect(Number.isNaN(overview.generatedAt.getTime())).toBe(false);
  });
});
