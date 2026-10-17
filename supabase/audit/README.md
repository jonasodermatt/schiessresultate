# EasyShooter: Benutzertrennung und Inbetriebnahme

## Bestätigte Zuordnung aller bestehenden Daten

Der Benutzer hat nachträglich ausdrücklich bestätigt, dass alle bisherigen
Anlässe und Schützen seinem Konto zugeordnet werden dürfen. Die bestätigte Auth-ID
ist `ca9cc641-96b7-4cec-8d25-6f4ef3f53eff`.

Nach der Owner-Migration kann deshalb `assign-existing-data-to-account.sql` im
Supabase SQL Editor als Administrator ausgeführt werden. Das Skript enthält die
bestätigte Ziel-ID, prüft deren Existenz und ordnet alle bislang ownerlosen Anlässe
und Schützen in einer Transaktion zu. Abhängige Daten erhalten ihren Zugriff über
den jeweiligen Anlass. Schützen werden dadurch für dieses Konto bearbeitbar.
Bereits passend zugeordnete Datensätze bleiben unverändert. Fremde vorhandene Owner
führen zum vollständigen Abbruch; es werden keine Daten gelöscht oder fremde
Zuordnungen überschrieben. Das Skript schliesst bei Erfolg mit COMMIT ab.

Diese ausdrückliche Freigabe ersetzt für den aktuellen Datenbestand die zuvor
beschriebene Einzelprüfung. Die allgemeine Backfill-Vorlage unten bleibt für
zukünftige, nicht pauschal bestätigte Datenbestände verfügbar. Die produktive
Zuordnung wurde durch den Assistenten noch nicht ausgeführt.

## Befund und Umsetzung

Der PostgreSQL-17.6-Export enthielt `ALL true` Policies für angemeldete Benutzer
auf allen 16 Anlass-Tabellen. `owner_id` fehlte. Von 13 Auswertungs-Views hatte
nur eine `security_invoker`; die übrigen waren auch für `anon` freigegeben.
Der Schützenstamm war global les- und änderbar. Die Löschfunktion lief als Aufrufer,
prüfte aber keinen Owner.

Die Migration `../migrations/202610170001_event_owner_isolation.sql`:

- ergänzt Owner mit Auth-Fremdschlüssel und Index. Der Default `auth.uid()` wird
  erst nach dem Hinzufügen der leeren Spalte gesetzt: **keine Altdatenzuordnung**;
- ersetzt alle bisherigen Policies der 16 Anlass-Tabellen durch Owner-Prüfungen
  für SELECT/INSERT/UPDATE/DELETE und aktiviert FORCE RLS;
- ergänzt indirekte Kindtabellen um `shooting_event_id`, aus ihren vorhandenen
  Elternbeziehungen abgeleitet. Trigger füllen neue Zeilen serverseitig; bisherige
  Client-Payloads bleiben gültig. Das ist keine Benutzerzuordnung;
- sichert sämtliche zweiten/optionalen Anlassreferenzen mit zusammengesetzten
  Fremdschlüsseln. Verschieben zwischen Anlässen ist auch beim selben Owner verboten;
- schützt Kategorien, Anmeldungen, Stiche, Kombinationen, Gruppen, Passen, Schüsse,
  Auszahlungsregeln, Sofortauszahlungen und Abrechnungen;
- setzt alle 13 Views auf `security_invoker=true, security_barrier=true` und
  erlaubt ausschliesslich SELECT für angemeldete Benutzer;
- sichert die Lösch-RPC mit Owner-Prüfung und Zeilensperre; SECURITY INVOKER bleibt;
- entzieht anonyme/PUBLIC-Rechte, TRUNCATE und Spalten-Sonderrechte. Administratoren
  und service_role bleiben privilegiert; deren Schlüssel gehören nie in den Browser;
- prüft Schema, Constraints, Funktionen, Views und Abhängigkeiten vorab. Bei Drift
  oder Datenkonflikten bricht die gesamte Transaktion ab. Zeilenzahlen und leere
  Owner-Spalten werden vor COMMIT kontrolliert.

Dashboard und sämtliche Anlass-Detailseiten filtern zusätzlich nach dem aktuellen
Owner. Neue Anlässe senden die aktuelle Benutzer-ID. Die Sicherheit liegt in RLS,
nicht in diesen Clientfiltern.

## Schützenstamm

Neue Schützen bekommen einen Owner. Historische Schützen bleiben ownerlos und sind
nur über eigene Anmeldungen lesbar, aber nicht durch normale Benutzer änderbar.
Ein BEFORE-Trigger verhindert, dass eine Anmeldung mit erratener fremder Schützen-ID
sich selbst Zugriff verschafft. Die Teilnehmerbearbeitung zeigt historische Namen,
Jahrgang und Verein schreibgeschützt; das Sportgerät auf der eigenen Anmeldung
bleibt editierbar. Korrekturen historischer Identitätsdaten benötigen eine
administrative Prüfung, besonders bei Verwendung in Anlässen mehrerer Owner.

Vereine, Schiessstände, Programme und Sportgeräte bleiben gemeinsame Stammdaten.
Ihre vorhandenen Verwaltungsrechte werden durch diese Anlassmigration nicht geändert.
Sie dürfen keine privaten Anlass- oder Finanzdaten enthalten.

## Sichere Reihenfolge

1. Backup erstellen und Wiederherstellbarkeit prüfen. Bei Änderungen seit dem
   Export zuerst `event-security-inventory.sql` erneut ausführen und prüfen.
2. `event-integrity-preflight.sql` als Administrator ausführen. Erwartung: **null
   Ergebniszeilen**. Konflikte anhand der ausgegebenen IDs fachlich klären; weder
   löschen noch automatisch umhängen. Die Migration prüft die Integrität erneut.
3. Migration zuerst in einer Supabase-Testumgebung mit aktuellem Schema und
   repräsentativen Daten ausführen. Die lokalen Tests sind gelaufen, ersetzen aber
   keinen Test der konkreten Supabase-Auth-/API-Konfiguration.
4. Produktive Migration im Wartungsfenster ausführen: Sie sperrt betroffene Tabellen
   transaktional, mit Lock-Timeout 5 s und Statement-Timeout 120 s. Bei grossen
   Datenmengen Laufzeit vorher messen. Nach einem Fehler ROLLBACK ausführen, Ursache
   prüfen und erneut starten. Die Migration ist absichtlich einmalig und lehnt ein
   vorhandenes Owner-Modell ab.
5. Danach sind **bisherige Anlässe zunächst für normale Benutzer unsichtbar**, aber
   vollständig erhalten. Nur bestätigte Eigentümerschaften backfillen (siehe unten).
   Neue Anlässe erhalten automatisch den aktuell authentifizierten Owner.
6. Die Anwendung mit den vorbereiteten Owner-Abfragen ausrollen. Sie benötigt die
   Migration und darf nicht vorher veröffentlicht werden. Nach der Umstellung neu
   anmelden und Seiten neu laden, damit zuvor geladene Daten nicht im Browser bleiben.
7. Mit zwei echten Testkonten über die Supabase API eigene Anlassbearbeitung,
   fremde bekannte IDs, Ranglisten, Finanzen und Lösch-RPC prüfen. Benutzer-JWTs
   verwenden, niemals service_role.

Die produktive Datenbank wurde nicht geändert. Kein Down-Skript stellt die vorherigen
offenen Policies wieder her. Bei Problemen im Wartungsmodus gezielt korrigieren.

## Kontrollierter Backfill

`backfill-event-owners.sql` ist eine Admin-Vorlage mit **ROLLBACK als Standard** und
absichtlich leerer Zuordnungsliste:

1. Pro Anlass-ID die tatsächliche Verantwortlichkeit anhand von Belegen bestätigen.
   Verein, Name oder aktueller Login sind allein kein ausreichender Eigentumsnachweis.
2. Bestätigte Paare aus Anlass-ID und `auth.users.id` samt Belegvermerk in
   `event_owner_map` eintragen. Jede Anlass-ID darf nur einmal vorkommen.
3. Vorlage als Probelauf ausführen; Vorschau, betroffene Anlässe und verbleibende
   ownerlose Anzahl prüfen. Standardmässig werden alle Änderungen zurückgerollt.
4. Nach Prüfung nur das **letzte** `ROLLBACK;` durch `COMMIT;` ersetzen und dieselbe
   Liste erneut ausführen. Leere, unbekannte, doppelte und bereits zugeordnete Anlässe
   brechen ab. Ungültige Benutzer scheitern ebenfalls an Prüfung/Fremdschlüssel.
5. Ungeklärte Anlässe unverändert lassen. Es gibt keine Selbstübernahme ownerloser
   Anlässe. Freigegebene Liste und ausgeführten Lauf im geschützten Betriebsprotokoll
   aufbewahren. Schützen-Owner werden durch diesen Backfill nicht verändert.

`owner_id` bleibt für Altdaten nullable; Policies verbieten neue ownerlose Datensätze
für normale Benutzer. Ein späteres NOT NULL setzt vollständige Klärung voraus,
niemals das Löschen ungeklärter Daten. Benutzerlöschungen dürfen keine Anlässe
kaskadierend entfernen; der Owner-Fremdschlüssel verwendet ON DELETE RESTRICT.

## Reproduzierbare Tests

Im Verzeichnis `supabase/tests`:

```powershell
npm ci --ignore-scripts
npm test
```

PGlite 0.3.14 führt die Tests in isoliertem PostgreSQL aus. `schema-before.sql`
rekonstruiert das exportierte relevante Schema mit originalen Constraints, Triggern,
Funktionen, Views und Policies, ohne echte Anwendungsdaten oder Schlüssel.
`auth.users`/`auth.uid()` werden minimal nachgebildet; `authenticated`/`anon` sind
echte PostgreSQL-Rollen mit JWT-Subject-Kontext.

Die Suite prüft positive CRUD-Kontrollen, beide Zugriffsrichtungen, anonymen Zugriff,
direkte Schreibversuche und UPSERT, Ownerwechsel, Altdaten, alle 13 Views mit
positiven Ergebnissen, Anlassreferenzen, Lösch-RPC, Migration bei Schemaabweichungen
und Datenkonflikten sowie Backfill-Fehler und Probelauf.

Grenzen: keine echte Supabase-Auth-Anmeldung, kein Browser-End-to-End-Test und kein
Mehrverbindungs-/Lasttest. Der reale Supabase-Test aus Schritt 7 steht noch aus.

Referenz: https://supabase.com/docs/guides/database/postgres/row-level-security
