# dMb Projekt 2027 – stan realizacji zakresu na 30.11.2026

Stan na 20.11.2026. Plan realizacji: konta (3 metody), administrowanie kontem, promocja do Platinum z odpięciem schematu, mailing organizacyjny; mailing marketingowy poza zakresem (decyzja 78).

## Zrobione i wdrożone na produkcji

| Obszar | Zawartość | Decyzje |
| --- | --- | --- |
| Fundament | testy integracyjne na prawdziwym Postgresie, CI, schematy organizacji `org_*` i tor ich migracji, rejestr organizacji | 77 |
| Uprawnienia | silnik `can()` (macierz jako dane) z testem każdej komórki, fakty o relacjach (`RelationLoader`) | 64, 70, 71, 79, 81 |
| Logowanie | własne: hasła (scrypt), sesje po stronie serwera, ciasteczko `__Host-sid`, ograniczenie prób logowania, pierwszy SuperAdministrator | 63, 80 |
| Zaproszenia i rejestracja | link 72 h, pokazywany raz, rodzaje Partner/Platyna, rejestracja atomowa, numer Partnera (6–12 cyfr), auto-logowanie | 68, 69, 72–76, 82 |
| Poczta | skrzynka nadawcza z ponawianiem, adapter MailerSend, szablony PL/DE/EN | 67, 83 |
| Administrowanie kontem | profil i zgody, aktywacja/dezaktywacja, rola, status, edycja danych, lista struktury, unieważnianie zaproszeń | 73, 85 |
| Struktura | zmiana rekomendującego, usunięcie ze struktury, blokada zmian drzewa | 71, 72, 79, 86 |
| Promocja do Platinum | przeniesienie organizacji do osobnego schematu w jednej transakcji, znacznik u górnej linii, Platyna Platyny | 64, 77, 87 |
| Mailing organizacyjny | adresaci według roli i zasięgu, wersje językowe, historia z dostarczaniem | 67, 78, 88 |
| Frontend | logowanie, rejestracja z linku, profil, struktura, szczegóły konta z akcjami, zaproszenia, mailing, PL/DE/EN, jasny i ciemny motyw (granat i złoto) | 84 |
| Wdrożenie | gałąź `production`, domena `project2027.dmbglobal.pl`, wersje w nagłówku | 89 |

## Wycięte lub odroczone

- Metoda 3 zakładania kont (manualne założenie przez uprawnioną osobę), kod QR (jest sam link), interaktywne drzewo (jest lista z wcięciem).
- Reset hasła e-mailem (decyzja 80), weryfikacja telefonu, weryfikacja e-maila.
- Mailing marketingowy, Kontakty, Zgody (treści i wersje), repozytorium materiałów (decyzja 78).

## Zostało do 30.11

- Test dymny na produkcji według `docs/wdrozenie.md`, weryfikacja adresu IP w logu, przegląd tłumaczeń DE i EN.
- Decyzje i sprawy z sekcji „Sprawy otwarte” w `docs/ustalenia-i-kontekst.md`, w tym zatwierdzenie założeń roboczych z decyzji 82–89.
- Poza kodem: plan MailerSend powyżej sandboxa, kopia bazy w Supabase, ochrona gałęzi `production`.

## Jakość

- Backend: ok. 240 testów jednostkowych i 240 integracyjnych (Vitest, prawdziwy Postgres), e2e, lint (oxlint), `db:check`.
- Frontend: sprawdzany ręcznie w przeglądarce przy każdym etapie (brak testów automatycznych).
