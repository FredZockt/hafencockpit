import { HttpErrorResponse } from '@angular/common/http';
import { DataFormatError, mapUnknownError } from './http-error.mapper';

describe('mapUnknownError', () => {
  it('erkennt einen Netzwerkfehler (Status 0)', () => {
    // Status 0 = offline, DNS, abgebrochen ODER CORS - der Browser verrät nicht
    // welches davon. Die Meldung bleibt deshalb bewusst offen.
    const error = mapUnknownError(
      new HttpErrorResponse({ status: 0, url: 'https://api.brightsky.dev/alerts' }),
    );

    expect(error.kind).toBe('network');
    expect(error.statusCode).toBe(0);
    expect(error.message).toContain('nicht erreichbar');
  });

  it('erkennt einen 404 und benennt ihn fachlich', () => {
    const error = mapUnknownError(new HttpErrorResponse({ status: 404 }));

    expect(error.kind).toBe('client');
    expect(error.message).toContain('Messstelle');
  });

  it('erkennt einen Serverfehler', () => {
    const error = mapUnknownError(new HttpErrorResponse({ status: 503 }));

    expect(error.kind).toBe('server');
    expect(error.message).toContain('Störung');
  });

  it('behält die URL als Quelle - die hilft im Support', () => {
    const url = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/xyz.json';

    expect(mapUnknownError(new HttpErrorResponse({ status: 500, url })).source).toBe(url);
  });

  it('unterscheidet ein kaputtes Datenformat von einem Netzwerkproblem', () => {
    const error = mapUnknownError(new DataFormatError('widgets ist kein Array', 'https://x.test'));

    expect(error.kind).toBe('format');
    expect(error.source).toBe('https://x.test');
  });

  it('übernimmt die Meldung eines normalen Errors', () => {
    const error = mapUnknownError(new Error('Pegel wurde nicht gefunden.'));

    expect(error.kind).toBe('unknown');
    expect(error.message).toBe('Pegel wurde nicht gefunden.');
  });

  it('kommt auch mit etwas zurecht, das gar kein Error ist', () => {
    // JavaScript erlaubt `throw 'string'` - deshalb nimmt der Mapper `unknown`.
    expect(mapUnknownError('irgendein String').message).toBe(
      'Unbekannter Fehler beim Laden der Daten.',
    );
    expect(mapUnknownError({ seltsam: true }).kind).toBe('unknown');
    expect(mapUnknownError(undefined).kind).toBe('unknown');
  });
});
