## Funkcjonalności 2026-11-30 | dMb Project 2027

1. Definicje
	1. **Partner** - osoba posiadająca status Przedsiębiorcy/Stałego Klienta Plus Amway, posiadająca numer: ABO# (EN), Numer PA (PL), Geschäftspartnernummer (DE/AT)
	2. **Klient** - osoba posiadająca status Klienta Amway, posiadająca Numer Klienta (PL), Customer Number (EN)
	3. **Kontakt** - osoba poinformowana o możliwościach biznesowych (*Business Opportunity Meeting* - BOM) lub produktowych (*Product Opportunity Meeting* - POM) dMb/Amway, nie będąca ani *Klientem*, ani *Partnerem*
	4. **Rola** - opisuje poziom dostępu do zasobów informacyjnych i edukacyjnych. Role predefiniowane:
		1. **Ogólne** - rola przypisywana automatycznie w chwili tworzenia konta
		2. **Foundation**
		3. **Builder**
		4. **Silver**
		5. **Platinum** - w chwili wypromowania użytkownika konta do roli *Platinum* cała jego organizacja zostaje oddzielona do osobnego obszaru i odseparowana od możliwości wglądu do informacji przez innych użytkowników w górnej linii sponsorowania
		6. **Administrator** - może działać wyłącznie w ramach jednej organizacji (konta w dolnej linii rekomendacji)
		7. **SuperAdministrator**
	5.  **Status** - dodatkowe informacje o właścicielu konta aktualizowane przez użytkownika o roli Platinum (pierwszą taką osobę w górnej linii sponsorowania - "bezpośrednia Platyna")
		1. **Nieaktywny**
		2. **Aktywny**
		3. **GoMagic**
		4. **DiamondSchool**

2. Funkcjonalności
	1. **Zakładanie kont - metody**:
		1. **Manualne założenie konta**
			1. Login - email właściciela konta
			2. Wysłanie powiadomienia o utworzeniu konta z żądaniem:
				1. Ustalenia hasła
				2. Podania numeru telefonu używanego w WhatsApp
			3. Nadanie właściwej roli (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*) - po otrzymaniu wiadomości o aktywowaniu konta (podanie wszystkich wymaganych informacji i wyrażenie zgód)
		2. **Założenie konta przez zaproszenie email** z linkiem do zaproszenia
			1. Wygenerowanie wiadomości z linkiem do zaproszenia  - wymaga znajomości adresu e-mail
			2. Wysłanie wiadomości e-mail zawierającej zaproszenie z linkiem do formularza rejestracyjnego - informacje wymagane w formularzu:
				1. Hasło do konta
				2. Adres e-mail
				3. Nr telefonu używany w WhatsApp
			3. Nadanie właściwej roli (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*) - po otrzymaniu wiadomości o aktywowaniu konta (podanie wszystkich wymaganych informacji i wyrażenie zgód)
		3. **Założenie konta przez przekazanie linka / kodu QR** do formularza zaproszenia
			1. Wygenerowanie wiadomości z linkiem do zaproszenia  - wymaga znajomości numeru telefonu używanego w WhatsApp
			2. Przekazanie wiadomości zawierającej zaproszenie z linkiem / kodem QR do formularza rejestracyjnego - informacje wymagane w formularzu:
				1. Hasło do konta
				2. Adres e-mail
				3. Nr telefonu używany w WhatsApp
			3. Nadanie właściwej roli (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*) - po otrzymaniu wiadomości o aktywowaniu konta (podanie wszystkich wymaganych informacji i wyrażenie zgód)
	2. **Administrowanie kontem**
		1. Zmiana i uzupełnianie danych konta
		2. Aktywowanie / dezaktywowanie konta (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*)
		3. Zmiana roli (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*)
		4. Zmiana statusu(tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*)
		5. Promowanie do roli *Platium* (tylko rola *Platinum* w obrębie swojej organizacji, *Administrator* i *SuperAdministrator*)
	3. **Mailing organizacyjny** - wykorzystanie zebranych danych kontaktowych do komunikacji w organizacji z uwzględnieniem ról (adresaci: *Partnerzy*)
	4. **Mailing marketingowy** - wykorzystanie zebranych danych kontaktowych oraz zgód do komunikacji marketingowej (adresaci: *Klienci* i *Kontakty*)
	
3. Dostęp do funkcjonalności według ról:
	1. Rola *SuperAdministrator*
		1. Konto tworzone z chwilą uruchomienia aplikacji
		2. Może zakładać konta użytkowników
		3. Nadaje/modyfikuje użytkownikom dowolne role poza *SuperAdministrator*
		4. Zakłada pierwsze konto/konta użytkownika
		5. Nie może zmienić własnej roli
	2. Rola *Administrator*
		1. Nie może nadać nikomu roli *SuperAdministrator*
		2. Nie może zmienić własnej roli
		3. Może zakładać konta użytkowników
		4. Nadaje/modyfikuje użytkownikom dowolne role poza *SuperAdministrator* i *Administrator*
	3. Role: *Ogólne*, *Foundation*, *Builder*, *Silver*
		1. Nie może zmieniać ról
		2. Może zakładać konta użytkowników we własnej organizacji
	4. Rola *Platinum*
		1. Może promować do roli *Platinum* członków własnej organizacji
		2. Może zmieniać *role* członków własnej organizacji
		3. Może zmieniać *status* członków własnej organizacji
		4. Nie może zmienić własnej *roli*
		5. Nie może zmieniać własnego *statusu*
