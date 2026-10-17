# Prüfbericht – 17.10.2026

Ergebnis: **586 erfolgreiche PostgreSQL-Sicherheitsprüfungen**.

Zusätzlich: **11 erfolgreiche Prüfungen** der ausdrücklich freigegebenen
Gesamtzuordnung an ein Konto: fehlende/unbekannte Ziel-ID, Abbruch bei fremdem
Owner, atomare Zuordnung ohne Löschung, Wiederholbarkeit, Bearbeitung historischer
Schützen durch den Owner und Unsichtbarkeit für den zweiten Benutzer.

Grundlage: bereitgestellter PostgreSQL-17.6-Schemaexport; Tests mit PGlite 0.3.14
in einer isolierten Datenbank ohne produktive Verbindung. Alle 16 Anlass-Tabellen,
der Schützenstamm und 13 Views sind enthalten.

- Zwei Benutzeridentitäten in beiden Zugriffsrichtungen mit echten PostgreSQL-Rollen.
- Positive Kontrollen: eigene Daten anlegen, lesen, ändern und löschen.
- Fremde/ownerlose Daten: SELECT, UPDATE, DELETE, INSERT und UPSERT abgesichert.
- Ownerwechsel, anonyme Zugriffe und Anmeldung mit erratener fremder Schützen-ID.
- Referenzen zwischen verschiedenen Anlässen, auch desselben Owners.
- Jede View liefert eigene Ergebnisse und verbirgt fremde/ownerlose Daten.
- Lösch-RPC für eigenen Anlass erfolgreich; fremde Anlässe bleiben erhalten.
- Migration erhält Zeilenzahlen und vergibt keine Owner an Altdaten.
- Schemaabweichung und vorhandene inkonsistente Referenz brechen atomar ab.
- Backfill lehnt leere, doppelte, unbekannte und bereits zugeordnete Einträge ab.
- Backfill-Probelauf rollt zurück; bestätigte Einzelzuordnung macht nur diesem
  Benutzer die historischen Anlassdaten zugänglich.
- Authentifizierte Benutzer haben keine TRUNCATE-Berechtigung.

Zusätzlich im Anwendungsprojekt erfolgreich:

```text
tsc --noEmit --incremental false
git diff --check
```

Nicht ausgeführt: produktive Migration, echte Supabase-Auth-Anmeldung/API-Prüfung,
Browser-End-to-End-Test, Mehrverbindungs-/Lasttest. Die Tests bilden `auth.uid()`
mit JWT-Subject-Kontext nach; sie testen keine JWT-Signaturprüfung durch Supabase.

Reproduktion: `npm ci --ignore-scripts` und `npm test` in diesem Verzeichnis.

## Release-Prüfung

Produktionsbuild erfolgreich; beide Testsuiten erneut erfolgreich (586 + 11 Prüfungen).
Der Benutzer hat die produktive Ausführung der Zuordnung sowie die anschliessende
Sichtprüfung als erfolgreich bestätigt. Diese Rückmeldung ist keine unabhängige
Live-Prüfung durch den Assistenten.
