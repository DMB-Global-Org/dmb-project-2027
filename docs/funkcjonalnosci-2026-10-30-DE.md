## Funktionalitäten 2026-11-30 | dMb Project 2027

1. Definitionen
	1. **Partner** – eine Person mit dem Status Amway-Unternehmer / Amway Stammkunde Plus, die eine der folgenden Nummern besitzt: ABO# (EN), Numer PA (PL), Geschäftspartnernummer (DE/AT)
	2. **Kunde** – eine Person mit dem Status Amway-Kunde, die eine Kundennummer (PL) / Customer Number (EN) besitzt
	3. **Kontakt** – eine Person, die über die Geschäftsmöglichkeiten (*Business Opportunity Meeting* – BOM) oder Produktmöglichkeiten (*Product Opportunity Meeting* – POM) von dMb/Amway informiert wurde und weder *Kunde* noch *Partner* ist
	4. **Rolle** – beschreibt die Zugriffsebene auf Informations- und Bildungsressourcen. Vordefinierte Rollen:
		1. **Allgemein** (*Ogólne*) – eine Rolle, die automatisch zum Zeitpunkt der Kontoerstellung zugewised wird
		2. **Foundation**
		3. **Builder**
		4. **Silver**
		5. **Platinum** – sobald ein Kontobenutzer in die Rolle *Platinum* befördert wird, wird seine gesamte Organisation in einen separaten Bereich abgetrennt und vom Einblick in Informationen durch andere Benutzer in der oberen Sponsorenlinie isoliert
		6. **Administrator** – kann ausschließlich innerhalb einer Organisation agieren (Konten in der unteren Empfehlungslinie)
		7. **SuperAdministrator**
	5. **Status** – zusätzliche Informationen über den Kontoinhaber, die von einem Benutzer mit der Rolle Platinum aktualisiert werden (die erste solche Person in der oberen Sponsorenlinie – „direktes Platin“)
		1. **Inaktiv**
		2. **Aktiv**
		3. **GoMagic**
		4. **DiamondSchool**

2. Funktionalitäten
	1. **Kontoerstellung – Methoden**:
		1. **Manuelle Kontoerstellung**
			1. Login – E-Mail-Adresse des Kontoinhabers
			2. Senden einer Benachrichtigung über die Kontoerstellung mit der Aufforderung:
				1. Ein Passwort festzulegen
				2. Die für WhatsApp verwendete Telefonnummer anzugeben
			3. Zuweisung der entsprechenden Rolle (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*) – nach Erhalt der Nachricht über die Kontoaktivierung (Bereitstellung aller erforderlichen Informationen und Erteilung der Einwilligungen)
		2. **Kontoerstellung per E-Mail-Einladung** mit einem Einladungslink
			1. Generierung einer Nachricht mit Einladungslink – erfordert die Kenntnis der E-Mail-Adresse
			2. Senden einer E-Mail-Nachricht mit der Einladung und einem Link zum Registrierungsformular – im Formular erforderliche Informationen:
				1. Passwort für das Konto
				2. E-Mail-Adresse
				3. Für WhatsApp verwendete Telefonnummer
			3. Zuweisung der entsprechenden Rolle (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*) – nach Erhalt der Nachricht über die Kontoaktivierung (Bereitstellung aller erforderlichen Informationen und Erteilung der Einwilligungen)
		3. **Kontoerstellung durch Weitergabe eines Links / QR-Codes** zum Einladungsformular
			1. Generierung einer Nachricht mit Einladungslink – erfordert die Kenntnis der für WhatsApp verwendeten Telefonnummer
			2. Übermittlung der Nachricht mit der Einladung und dem Link / QR-Code zum Registrierungsformular – im Formular erforderliche Informationen:
				1. Passwort für das Konto
				2. E-Mail-Adresse
				3. Für WhatsApp verwendete Telefonnummer
			3. Zuweisung der entsprechenden Rolle (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*) – nach Erhalt der Nachricht über die Kontoaktivierung (Bereitstellung aller erforderlichen Informationen und Erteilung der Einwilligungen)
	2. **Kontoverwaltung**
		1. Änderung und Ergänzung von Kontodaten
		2. Aktivierung / Deaktivierung eines Kontos (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*)
		3. Rollenwechsel (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*)
		4. Statuswechsel (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*)
		5. Beförderung zur Rolle *Platinum* (nur Rolle *Platinum* innerhalb der eigenen Organisation, *Administrator* und *SuperAdministrator*)
	3. **Organisations-Mailing** – Nutzung der gesammelten Kontaktdaten zur Kommunikation innerhalb der Organisation unter Berücksichtigung der Rollen (Empfänger: *Partner*)
	4. **Marketing-Mailing** – Nutzung der gesammelten Kontaktdaten und Einwilligungen für die Marketingkommunikation (Empfänger: *Kunden* und *Kontakte*)

3. Zugriff auf Funktionalitäten nach Rollen:
	1. Rolle *SuperAdministrator*
		1. Das Konto wird mit dem Start der Anwendung erstellt
		2. Kann Benutzerkonten erstellen
		3. Weist den Benutzern beliebige Rollen außer *SuperAdministrator* zu / ändert diese
		4. Erstellt das erste Benutzerkonto / die ersten Benutzerkonten
		5. Kann die eigene Rolle nicht ändern
	2. Rolle *Administrator*
		1. Kann niemandem die Rolle *SuperAdministrator* zuweisen
		2. Kann die eigene Rolle nicht ändern
		3. Kann Benutzerkonten erstellen
		4. Weist den Benutzern beliebige Rollen außer *SuperAdministrator* und *Administrator* zu / ändert diese
	3. Rollen: *Allgemein*, *Foundation*, *Builder*, *Silver*
		1. Kann keine Rollen ändern
		2. Kann Benutzerkonten innerhalb der eigenen Organisation erstellen
	4. Rolle *Platinum*
		1. Kann Mitglieder der eigenen Organisation zur Rolle *Platinum* befördern
		2. Kann *Rollen* von Mitgliedern der eigenen Organisation ändern
		3. Kann den *Status* von Mitgliedern der eigenen Organisation ändern
		4. Kann die eigene *Rolle* nicht ändern
		5. Kann den eigenen *Status* nicht ändern