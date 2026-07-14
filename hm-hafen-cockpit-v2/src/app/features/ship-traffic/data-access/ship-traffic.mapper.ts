/**
 * AIS-DTOs -> ShipTrafficOverview. Reine Funktionen, ohne HTTP.
 *
 * Hier liegt die gesamte AIS-Semantik: Sentinel-Werte, Zahlencodes, die ETA ohne
 * Jahr, der Freitext im Zielfeld. Bewusst NICHT im Proxy und erst recht nicht im
 * Template - so ist alles davon ohne Netz testbar.
 */

import type { GeoLocation } from '../../../core/config/app-config';
import type { AisEtaDto, AisSnapshotDto, AisVesselDto } from './ais.dto';
import type {
  NavStatus,
  ShipDirection,
  ShipMovement,
  ShipTrafficOverview,
  ShipType,
} from './ship-traffic.model';

/* AIS kodiert "unbekannt" als Zahl - siehe ais.dto.ts. */
const SOG_UNKNOWN = 102.3;
const COG_UNKNOWN = 360;
const LAT_UNKNOWN = 91;
const LON_UNKNOWN = 181;

const EARTH_RADIUS_KM = 6371;

/** AIS-Typcode -> Klartext. Die Bereiche sind in ITU-R M.1371 festgelegt. */
export function mapShipType(code: number | null): ShipType {
  if (code === null || code <= 0) {
    return 'unbekannt';
  }
  if (code === 30) {
    return 'Fischerei';
  }
  if (code === 31 || code === 32 || code === 52) {
    return 'Schlepper';
  }
  if (code === 50) {
    return 'Lotsenboot';
  }
  if (code === 36) {
    return 'Segler';
  }
  if (code >= 60 && code <= 69) {
    return 'Passagierschiff';
  }
  if (code >= 70 && code <= 79) {
    return 'Frachter';
  }
  if (code >= 80 && code <= 89) {
    return 'Tanker';
  }
  return 'Sonstige';
}

/** AIS-Statuscode -> Klartext. */
export function mapNavStatus(code: number | null): NavStatus {
  switch (code) {
    case 0:
      return 'in Fahrt';
    case 1:
      return 'vor Anker';
    case 3:
      return 'manövrierbehindert';
    case 5:
      return 'festgemacht';
    case 6:
      return 'auf Grund';
    default:
      // 15 = "undefined" ist der Regelfall bei vielen Sendern, nicht die Ausnahme.
      return 'unbekannt';
  }
}

/** `null` statt 102.3 - ein Schiff fährt keine 102 Knoten. */
export function toSpeedKn(sog: number | null): number | null {
  if (sog === null || !Number.isFinite(sog) || sog >= SOG_UNKNOWN) {
    return null;
  }
  return sog;
}

/** `null` statt 360. */
export function toCourseDeg(cog: number | null): number | null {
  if (cog === null || !Number.isFinite(cog) || cog >= COG_UNKNOWN || cog < 0) {
    return null;
  }
  return cog;
}

/** `null` statt lat 91 / lon 181. */
export function toPosition(
  latitude: number,
  longitude: number,
): { lat: number; lon: number } | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) >= LAT_UNKNOWN ||
    Math.abs(longitude) >= LON_UNKNOWN
  ) {
    return null;
  }
  return { lat: latitude, lon: longitude };
}

/** Luftlinie in km (Haversine). */
export function distanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Peilung von `from` nach `to` in Grad (0 = Nord). */
export function bearingDeg(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLon);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Baut aus der AIS-ETA ein Datum.
 *
 * AIS liefert nur Monat/Tag/Stunde/Minute - OHNE JAHR. Wir wählen das Jahr so,
 * dass die ETA möglichst nah an "jetzt" liegt (sonst wäre eine Januar-ETA im
 * Dezember elf Monate in der Vergangenheit statt einen Monat in der Zukunft).
 *
 * `0` in Monat oder Tag heißt laut Spec "nicht gesetzt" -> `null`, keine Krücke.
 */
export function parseEta(eta: AisEtaDto | null, now: Date): Date | null {
  if (eta === null || eta.month < 1 || eta.month > 12 || eta.day < 1 || eta.day > 31) {
    return null;
  }
  if (eta.hour > 23 || eta.minute > 59) {
    return null; // 24/60 sind die AIS-Codes für "nicht verfügbar"
  }

  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
    (year) => new Date(year, eta.month - 1, eta.day, eta.hour, eta.minute),
  );

  const valid = candidates.filter((date) => !Number.isNaN(date.getTime()));
  if (valid.length === 0) {
    return null;
  }

  // Das Jahr mit dem kleinsten Abstand zu "jetzt".
  return valid.reduce((best, candidate) =>
    Math.abs(candidate.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())
      ? candidate
      : best,
  );
}

/**
 * Erkennt Hamburg im Freitext-Zielfeld.
 *
 * Die Brücke tippt das von Hand: "HAMBURG", "DEHAM" (UN/LOCODE), "HH",
 * "HAMBURG,GER", "DE HAM". Deshalb Normalisierung statt Gleichheitsvergleich.
 */
export function isBoundForHamburg(destination: string | null): boolean {
  if (destination === null) {
    return false;
  }

  const normalized = destination.toUpperCase().replace(/[^A-Z]/g, '');
  return (
    normalized.includes('HAMBURG') || normalized.includes('DEHAM') || normalized === 'HH'
  );
}

/**
 * Fahrtrichtung ableiten - AIS liefert sie nicht.
 *
 * 1. Liegt das Schiff (festgemacht / vor Anker), fährt es nirgendwohin.
 * 2. Steht Hamburg im Zielfeld, ist es einlaufend - das ist das stärkste Signal.
 * 3. Sonst über die Geometrie: Zeigt der Kurs zum Hafen (Abweichung < 90° von der
 *    Peilung), läuft es ein, sonst aus.
 * 4. Ohne Kurs: keine Aussage. Lieber 'unbekannt' als geraten.
 */
export function deriveDirection(
  vessel: { destination: string | null; courseDeg: number | null; navStatus: NavStatus },
  position: { lat: number; lon: number },
  harbor: { lat: number; lon: number },
): ShipDirection {
  if (vessel.navStatus === 'festgemacht' || vessel.navStatus === 'vor Anker') {
    return 'liegt';
  }

  if (isBoundForHamburg(vessel.destination)) {
    return 'einlaufend';
  }

  if (vessel.courseDeg === null) {
    return 'unbekannt';
  }

  const bearing = bearingDeg(position, harbor);
  const delta = Math.abs(((vessel.courseDeg - bearing + 540) % 360) - 180);

  return delta < 90 ? 'einlaufend' : 'auslaufend';
}

/** Mappt EIN Schiff. `null`, wenn es keine brauchbare Position hat. */
export function mapVessel(
  dto: AisVesselDto,
  harbor: GeoLocation,
  now: Date,
): ShipMovement | null {
  const position = toPosition(dto.latitude, dto.longitude);
  if (position === null) {
    return null; // ohne Position ist ein Schiff für die Leitstelle wertlos
  }

  const harborPosition = { lat: harbor.latitude, lon: harbor.longitude };
  const navStatus = mapNavStatus(dto.navigationalStatus);
  const courseDeg = toCourseDeg(dto.cog);

  const lastSeenAt = new Date(dto.timeUtc);

  return {
    id: String(dto.mmsi),
    // Ohne Namen zeigen wir die MMSI - eine leere Zeile hilft niemandem.
    name: dto.name?.trim() || `MMSI ${dto.mmsi}`,
    callSign: dto.callSign?.trim() || null,

    shipType: mapShipType(dto.shipType),
    navStatus,
    direction: deriveDirection(
      { destination: dto.destination, courseDeg, navStatus },
      position,
      harborPosition,
    ),

    speedKn: toSpeedKn(dto.sog),
    courseDeg,

    distanceKm: distanceKm(position, harborPosition),

    destinationRaw: dto.destination?.trim() || null,
    eta: parseEta(dto.eta, now),

    lastSeenAt: Number.isNaN(lastSeenAt.getTime()) ? now : lastSeenAt,
  };
}

/**
 * Der Haupt-Mapper.
 *
 * Verworfen wird, was keine Position hat oder außerhalb des Radius liegt - die
 * Anzahl wird aber MITGEZÄHLT und angezeigt. Dieselbe Ehrlichkeit wie bei den
 * ausgeblendeten Testwarnungen und der ausgedünnten Tidekurve.
 */
export function mapToShipTraffic(
  snapshot: AisSnapshotDto,
  options: { harbor: GeoLocation; radiusKm: number; maxVessels: number },
  now: Date = new Date(),
): ShipTrafficOverview {
  const mapped = snapshot.vessels
    .map((vessel) => mapVessel(vessel, options.harbor, now))
    .filter((vessel): vessel is ShipMovement => vessel !== null);

  const inRadius = mapped.filter((vessel) => vessel.distanceKm <= options.radiusKm);

  const vessels = [...inRadius]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, options.maxVessels);

  const generatedAt = new Date(snapshot.generatedAt);

  return {
    vessels,
    inboundCount: inRadius.filter((vessel) => vessel.direction === 'einlaufend').length,
    outboundCount: inRadius.filter((vessel) => vessel.direction === 'auslaufend').length,
    radiusKm: options.radiusKm,
    discardedCount: snapshot.vessels.length - inRadius.length,
    generatedAt: Number.isNaN(generatedAt.getTime()) ? now : generatedAt,
  };
}
