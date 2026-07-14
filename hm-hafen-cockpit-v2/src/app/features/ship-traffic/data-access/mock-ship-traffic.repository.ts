/**
 * Demo-Quelle für den Schiffsverkehr - ohne Netz, ohne Key, ohne Proxy.
 *
 * ZWEI DINGE SIND HIER ABSICHT:
 *
 * 1. Das Mock liefert ROHE AIS-DTOs und schickt sie durch DENSELBEN Mapper wie
 *    die echte Quelle. Es täuscht also nicht das Ergebnis vor, sondern die
 *    Schnittstelle. Damit ist der Mapper in der Demo tatsächlich in Betrieb -
 *    und der Umstieg auf den Proxy tauscht nur noch den HTTP-Teil.
 *
 * 2. Die Flotte enthält bewusst die typischen AIS-Fallen: ein Schiff ohne
 *    Positionsdaten (lat 91 / lon 181), einen Sentinel-Wert bei Geschwindigkeit
 *    (102.3) und Kurs (360), ein krude eingetipptes Zielfeld und eine ETA ohne
 *    Jahr. So sieht man in der Demo, dass der Mapper sie abfängt - statt "102
 *    Knoten am Nordpol" anzuzeigen.
 *
 * Die Schiffe bewegen sich mit der Zeit entlang ihres Kurses, damit jeder
 * Refresh sichtbar etwas ändert (Entfernung, Reihenfolge).
 */

import { Injectable, inject } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import type { AisSnapshotDto, AisVesselDto } from './ais.dto';
import type { ShipTrafficOverview } from './ship-traffic.model';
import { mapToShipTraffic } from './ship-traffic.mapper';
import { ShipTrafficRepository } from './ship-traffic.repository';

/** Ein Flottenmitglied im Ausgangszustand. */
interface FleetEntry {
  readonly vessel: AisVesselDto;
  /** Startposition; von hier aus wird entlang `cog` mit `sog` weitergerechnet. */
  readonly startLat: number;
  readonly startLon: number;
}

const KNOTS_TO_KM_PER_MIN = 1.852 / 60;

/**
 * Die Flotte. Positionen liegen auf bzw. an der Elbe zwischen Hafen und
 * Elbmündung; die Kurse zeigen entsprechend elbauf- oder elbabwärts.
 */
const FLEET: readonly FleetEntry[] = [
  {
    startLat: 53.5401,
    startLon: 9.9,
    vessel: {
      mmsi: 211331640,
      name: 'CMA CGM MARCO POLO',
      callSign: 'DHBN',
      shipType: 70, // Frachter
      navigationalStatus: 0, // in Fahrt
      latitude: 0,
      longitude: 0,
      sog: 11.4,
      cog: 78, // elbaufwärts, Richtung Hafen
      trueHeading: 80,
      destination: 'DEHAM', // UN/LOCODE - der Mapper muss das als Hamburg erkennen
      eta: { month: 7, day: 14, hour: 18, minute: 20 },
      timeUtc: '',
    },
  },
  {
    startLat: 53.5289,
    startLon: 9.83,
    vessel: {
      mmsi: 218793000,
      name: 'SEASPAN HAMBURG',
      callSign: 'DEBM',
      shipType: 71,
      navigationalStatus: 0,
      latitude: 0,
      longitude: 0,
      sog: 9.8,
      cog: 72,
      trueHeading: 74,
      destination: 'hamburg,ger', // Freitext, kleingeschrieben, mit Komma
      eta: { month: 7, day: 14, hour: 19, minute: 45 },
      timeUtc: '',
    },
  },
  {
    startLat: 53.5495,
    startLon: 10.03,
    vessel: {
      mmsi: 244660000,
      name: 'STOLT KITTIWAKE',
      callSign: 'PBTZ',
      shipType: 80, // Tanker
      navigationalStatus: 0,
      latitude: 0,
      longitude: 0,
      sog: 7.2,
      cog: 265, // elbabwärts -> auslaufend
      trueHeading: 262,
      destination: 'ROTTERDAM',
      eta: { month: 7, day: 16, hour: 6, minute: 0 },
      timeUtc: '',
    },
  },
  {
    startLat: 53.5443,
    startLon: 9.9689,
    vessel: {
      mmsi: 211512560,
      name: 'BUGSIER 6',
      callSign: 'DDBS',
      shipType: 52, // Schlepper
      navigationalStatus: 0,
      latitude: 0,
      longitude: 0,
      sog: 4.1,
      cog: 190,
      trueHeading: 188,
      destination: null,
      eta: null,
      timeUtc: '',
    },
  },
  {
    startLat: 53.5388,
    startLon: 9.9702,
    vessel: {
      mmsi: 211234500,
      name: 'MSC PREZIOSA',
      callSign: 'IBPZ',
      shipType: 60, // Passagierschiff
      navigationalStatus: 5, // festgemacht -> Richtung "liegt"
      latitude: 0,
      longitude: 0,
      sog: 0,
      cog: 15,
      trueHeading: 12,
      destination: 'HAMBURG',
      eta: { month: 7, day: 14, hour: 8, minute: 0 }, // liegt bereits: ETA in der Vergangenheit
      timeUtc: '',
    },
  },
  {
    startLat: 53.5622,
    startLon: 9.9105,
    vessel: {
      mmsi: 211456000,
      name: 'ELBE PILOT 3',
      callSign: 'DELP',
      shipType: 50, // Lotsenboot
      navigationalStatus: 15, // "undefined" - kein Fehler, sondern Alltag
      latitude: 0,
      longitude: 0,
      // FALLE: Sentinel-Werte. Ohne Abfangen: "102,3 kn" und ein Kurs von 360°.
      sog: 102.3,
      cog: 360,
      trueHeading: 511,
      destination: '  ',
      eta: { month: 0, day: 0, hour: 24, minute: 60 }, // AIS-Codes für "nicht gesetzt"
      timeUtc: '',
    },
  },
  {
    startLat: 53.51,
    startLon: 9.62,
    vessel: {
      mmsi: 305123000,
      name: 'ATLANTIC SAIL',
      callSign: 'V2GT',
      shipType: 79,
      navigationalStatus: 0,
      latitude: 0,
      longitude: 0,
      sog: 13.9,
      cog: 85,
      trueHeading: 86,
      destination: 'DE HAM', // wieder anders geschrieben
      eta: { month: 7, day: 14, hour: 22, minute: 10 },
      timeUtc: '',
    },
  },
  {
    startLat: 53.9,
    startLon: 8.9,
    vessel: {
      mmsi: 236111000,
      name: 'NORDIC BULK',
      callSign: 'ZDLM',
      shipType: 70,
      navigationalStatus: 0,
      latitude: 0,
      longitude: 0,
      sog: 12.0,
      cog: 110,
      trueHeading: 112,
      destination: 'BREMERHAVEN',
      eta: { month: 7, day: 15, hour: 4, minute: 0 },
      timeUtc: '',
    },
  },
  {
    // FALLE: keine Positionsdaten. Muss vom Mapper verworfen und in
    // `discardedCount` gezählt werden - nicht angezeigt, aber auch nicht verschwiegen.
    startLat: 91,
    startLon: 181,
    vessel: {
      mmsi: 999999999,
      name: null,
      callSign: null,
      shipType: null,
      navigationalStatus: null,
      latitude: 91,
      longitude: 181,
      sog: null,
      cog: null,
      trueHeading: null,
      destination: null,
      eta: null,
      timeUtc: '',
    },
  },
];

@Injectable()
export class MockShipTrafficRepository extends ShipTrafficRepository {
  private readonly config = inject(HARBOR_COCKPIT_CONFIG);

  override getShipTraffic(): Observable<ShipTrafficOverview> {
    const now = new Date();

    return of(
      mapToShipTraffic(
        this.buildSnapshot(now),
        {
          harbor: this.config.harborLocation,
          radiusKm: this.config.ais.radiusKm,
          maxVessels: this.config.ais.maxVessels,
        },
        now,
      ),
    );
  }

  /** Erzeugt einen Snapshot, in dem die Schiffe seit dem Seitenaufruf gefahren sind. */
  private buildSnapshot(now: Date): AisSnapshotDto {
    // Minuten seit der vollen Stunde - dadurch ändert sich die Lage bei jedem
    // 60-Sekunden-Takt sichtbar, ohne dass wir Zustand halten müssen.
    const minutes = now.getMinutes() + now.getSeconds() / 60;

    const vessels = FLEET.map((entry) => this.advance(entry, minutes, now));

    return { generatedAt: now.toISOString(), vessels };
  }

  /** Rechnet eine Startposition entlang des Kurses weiter. */
  private advance(entry: FleetEntry, minutes: number, now: Date): AisVesselDto {
    const speedKn = entry.vessel.sog;
    const courseDeg = entry.vessel.cog;

    // Sentinel-Schiffe und Liegeplätze bewegen sich nicht.
    const moves =
      speedKn !== null && speedKn > 0 && speedKn < 102 && courseDeg !== null && courseDeg < 360;

    if (!moves) {
      return {
        ...entry.vessel,
        latitude: entry.startLat,
        longitude: entry.startLon,
        timeUtc: now.toISOString(),
      };
    }

    const distanceKm = speedKn * KNOTS_TO_KM_PER_MIN * minutes;
    const courseRad = (courseDeg * Math.PI) / 180;

    // Grobe, für eine Demo völlig ausreichende Umrechnung km -> Grad.
    const dLat = (distanceKm * Math.cos(courseRad)) / 111;
    const dLon =
      (distanceKm * Math.sin(courseRad)) / (111 * Math.cos((entry.startLat * Math.PI) / 180));

    return {
      ...entry.vessel,
      latitude: entry.startLat + dLat,
      longitude: entry.startLon + dLon,
      // Das Lotsenboot sendet seit Minuten nichts mehr - so sieht man, dass die
      // Kachel das Paketalter kennt.
      timeUtc: new Date(now.getTime() - 20_000).toISOString(),
    };
  }
}
