# dMb Projekt 2027 – dziennik decyzji i kontekst

Stan na 20.11.2026 · Marek Kustosz

Historia ustaleń z rozmów o specyfikacji (20.10–01.11.2026). Aktualny opis funkcjonalności jest w `docs/specyfikacja.md`; ten plik wyjaśnia, skąd wzięły się decyzje i które zostały zastąpione.

## Materiały poza repozytorium

| Materiał | Gdzie | Uwagi |
| --- | --- | --- |
| Specyfikacja (wersja na żywo) | https://claude.ai/code/artifact/79b03467-e381-4fce-92c2-a7f26ab27b24 | Źródło, z którego skopiowano `docs/specyfikacja.md` |
| Ściąga na sesję | https://claude.ai/code/artifact/55313ece-e8a7-48a1-abd0-38ad742cd72b | Jednostronicowe podsumowanie |
| Tablica Event Storming | https://miro.com/app/board/uXjVHiUeyUM=/ | Karteczki Marka po lewej, schemat Claude po prawej |
| Opis funkcjonalności Marka (PL, DE) | `docs/funkcjonalnosci-2026-10-30.md`, `docs/funkcjonalnosci-2026-10-30-DE.md` | Sporządzony 30.10.2026; termin realizacji 30.11.2026 (data w nagłówku) |

## Kontekst projektu

- Aplikacja dla struktury DMB Global (Dynamic Modern Business Global), działającej w modelu marketingu sieciowego w ramach Amway.
- Trzy nadrzędne cele: treści edukacyjne według poziomu Partnera, zarządzanie Kontaktami, w dalszym etapie e-marketing.
- Obszary: repozytorium dokumentów, konta i struktura Partnerów, Kontakty, mailing.
- Pierwotny opis powstał z nagrania głosowego Marka. Model domeny opracowano metodą Event Storming w Miro.

## Dziennik decyzji

Decyzje oznaczone „(zastąpione)” zmieniła sekcja „Zmiany z 30.10.2026”.

### Role i uprawnienia
1. (zastąpione, patrz 38) Hierarchia ról: Ogólny, Brąz Foundation, Brąz Builder, Silver, Gold, Platyna.
2. Hierarchia uprawnień kończy się na Platynie. Piny powyżej Platyny są tylko opisem.
3. Platyna wpisuje swój pin ręcznie na swoim koncie.
4. Platyna jest administratorem swojej struktury i nadaje wszystkie awanse, także do Platyny. Osoby z wyższymi pinami nie promują w cudzych strukturach.
5. Awanse nadawane wyłącznie ręcznie, bez logiki podpowiadania.
6. (zastąpione, patrz 41) Administrator aplikacji wprowadza pierwsze Platyny.

### Struktura platynowa
7. Awans lub nominacja na Platynę przenosi całą jej organizację do osobnego schematu PostgreSQL.
8. (zastąpione, patrz 43) Nominacja przez Administratora działa tak samo jak promocja przez Platynę.
9. Dotychczasowa Platyna widzi tylko wpis: kto i kiedy został wypromowany. Bez danych i podsumowań.
10. Każdy Partner widzi całą strukturę pod sobą, z pełnymi danymi kont, bez odpiętych organizacji.
11. Drzewo struktury tworzą powiązania Partner → rekomendujący.

### Rejestracja
12. (zastąpione, patrz 44–45) Pełny formularz z numerami przy rejestracji.
13. (zastąpione, patrz 46 i 66) Wniosek o aktywację trafia do Platyny.
14. Rekomendujący musi być w tej samej strukturze platynowej co bezpośrednia Platyna.
15. (zastąpione, patrz 44) Konta bez weryfikacji zakładane przez Administratora.

### Repozytorium dokumentów
16. Każdy materiał ma minimalną rolę. Awans zachowuje dostęp do niższych poziomów.
17. (zastąpione, patrz 60) Materiały dodaje wyłącznie Administrator.
18. Materiały mają wersje językowe. Domyślnie wersja w języku użytkownika, gdy jej brak: polska.

### Kontakty i Klienci
19. Ścieżki: BOM oraz POM z rozwiązaniami (np. MRA, MyBODY.ID). Wyniki: Partner, Klient, brak zainteresowania (zawsze z możliwością zgód marketingowych).
20. Partner i współpracownik to to samo. Obowiązuje nazwa Partner.
21. Kontakty są wspólne dla całej DMB (schemat główny).
22. Każdy może wyszukać Kontakt po telefonie lub e-mailu i zobaczyć ślad w DMB. Szczegóły widzą role od Silver wzwyż. Próg jest konfigurowalny.
23. Przy Kontakcie zapisany jest ostatni Partner BOM i ostatni Partner POM dla każdego rozwiązania. Pełną historię odtwarza się z logu.
24. Klient ma konto z Partnerem zapraszającym, prosty formularz ze zgodami, weryfikacja e-maila i telefonu. Administrator może pominąć weryfikację.
25. Klient nie ma dostępu do repozytorium ani do struktury.
26. Klient przechodzący na Partnera może wskazać innego rekomendującego, także z innej struktury. Partner zapraszający zostaje w historii.
27. Partner zapraszający i jego Platyna dostają powiadomienie, gdy Klient przechodzi do innej struktury.

### Dane zdrowotne, RODO, log
28. Aplikacja nie przechowuje danych o zdrowiu. Oświadczenie o braku przeciwwskazań jest na papierze i zostaje u Partnera. W aplikacji jest tylko znacznik (data, wersja formularza, Partner).
29. Wyniki testu MyBODY.ID trafiają bezpośrednio do osoby i nie są przechowywane.
30. Log systemowy zapisuje każdą operację: kto, kiedy, co, obiekt, wartość przed i po, adres IP, przeglądarka i system (User-Agent).
31. (zastąpione, patrz 48) Dostęp do logu.
32. Wpisów logu nie usuwamy. Monitorujemy rozmiar i reagujemy, gdy mocno urośnie.
33. Przy żądaniu usunięcia danych osoba jest nieodwracalnie anonimizowana wszędzie (także w logu i adresach IP), a wpisy logu zostają.

### Technika
34. Aplikacja wielojęzyczna od początku: polski (podstawowy), niemiecki, angielski. Kolejne języki bez zmian w kodzie.
35. Pierwsza wersja to responsywna aplikacja webowa. Backend jako osobne API, gotowe na późniejszą aplikację mobilną.
36. Powiadomienia: e-mail od startu, SMS lub WhatsApp, web push w miarę możliwości.
37. Trzeci nadrzędny cel (dalszy etap): e-marketing oparty na Kontaktach i zgodach. Wysyłki tylko do osób ze zgodą na dany kanał.

### Zmiany z 30.10.2026 i późniejsze doprecyzowania
38. Role: Ogólne (automatycznie przy tworzeniu konta), Foundation, Builder, Silver, Platinum, Administrator, SuperAdministrator.
39. Partner i Klient definiowani według statusu i numeru Amway; Kontakt po BOM lub POM. BOM zastępuje BP.
40. Status (Nieaktywny, Aktywny, GoMagic, DiamondSchool) nadaje bezpośrednia Platyna. Nikt nie zmienia własnej roli, Platyna nie zmienia własnego statusu.
41. SuperAdministrator powstaje przy uruchomieniu aplikacji, zakłada pierwsze konta i nadaje dowolne role poza SuperAdministrator.
42. (doprecyzowane w 52) Zakres działania Administratora.
43. Aktywację, dezaktywację, zmianę roli i statusu oraz promocję do Platinum wykonuje Platyna we własnej organizacji, Administrator lub SuperAdministrator. Promocja zawsze odpina organizację.
44. Trzy metody zakładania kont: manualnie (login = e-mail), zaproszenie e-mailem z linkiem, link lub kod QR (wymaga numeru WhatsApp).
45. Formularz rejestracyjny: hasło, e-mail, numer telefonu używany w WhatsApp. Pozostałe dane uzupełniane przed aktywacją.
46. Konto aktywuje się po podaniu wszystkich danych i zgód. Uprawniona osoba dostaje wiadomość i nadaje rolę.
47. (doprecyzowane w 60) Kto dodaje materiały.
48. Log przegląda SuperAdministrator bez ograniczeń, Administrator w swojej dolnej linii, Platyna w swojej strukturze.
49. Mailing organizacyjny (Partnerzy, według ról) i mailing marketingowy (Klienci i Kontakty, ze zgodami).
50. Konta zakładają też role Ogólne–Silver we własnej organizacji.
51. BOM = Business Opportunity Meeting (dawne BP), POM = Product Opportunity Meeting. MRA i MyBODY.ID to rozwiązania wellbeing prezentowane na POM; katalog jest otwarty.
52. Administrator to rola nadawana w dowolnym miejscu struktury, z uprawnieniami do wszystkich kont w jego dolnej linii rekomendacji.
53. Dolna linia Administratora kończy się na granicy odpiętej organizacji platynowej, tak jak u zwykłego Partnera.
54. Platyna może zakładać konta we własnej organizacji.
55. Rolę i status Platyny zmienia Platyna w jej górnej linii (najbliższa albo wyższa), Administrator w górnej linii lub SuperAdministrator. Widzą konto samej Platyny, nie jej odpiętą organizację.
56. Rola Gold została usunięta celowo.
57. Piny zostają jako osobne pole obok Statusu; Platyna wpisuje swój pin ręcznie.
58. (doprecyzowane w 69) Przy zaproszeniu e-mailem lub linkiem zapraszający automatycznie zostaje rekomendującym.
59. Kanał weryfikacji telefonu (SMS lub WhatsApp) wybierzemy przy budowie, według dostępności i ceny usług.
60. Materiały dodają SuperAdministrator i Administratorzy.
61. Opis funkcjonalności sporządzony 30.10.2026; termin realizacji tych funkcjonalności: 30.11.2026.

### Doprecyzowania z 19.11.2026
62. (zastąpione, patrz 68) Pierwsze konta zakłada SuperAdministrator, zanim istnieje jakakolwiek Platyna. Nie mają bezpośredniej Platyny (numer pusty) i leżą w schemacie dla struktury bez Platyny (`org_root`). Przy promocji do Platinum aplikacja najpierw uzupełnia numer bezpośredniej Platyny u całego down-line'u wypromowanej osoby, a potem przenosi organizację do nowego schematu. „Numer Platyny” oznacza numer Partnera (ABO# / Numer PA), nie identyfikator rekordu.
63. Uwierzytelnianie własne, w backendzie (nie Supabase Auth). Na start rejestracja z hasłem i potwierdzeniem hasła, bez weryfikacji adresu e-mail. Weryfikacja telefonu (WhatsApp lub SMS) odłożona.
64. Nie przewidujemy degradacji Platyny: rolę Platinum nie można obniżyć (konto można tylko dezaktywować).
65. Status (Nieaktywny, Aktywny, GoMagic, DiamondSchool) i aktywność konta to osobne pola. Status jest informacją od bezpośredniej Platyny; aktywność konta blokuje logowanie.
66. (doprecyzowane w 73) Znacznik „profil uzupełniony” ustawia się automatycznie, gdy właściciel poda wszystkie dane i zgody. Konto aktywuje uprawniona osoba (Platyna we własnej organizacji, Administrator, SuperAdministrator) i nadaje rolę. „Wniosek o aktywację” nie powstaje; zastępuje go powiadomienie.
67. Mailing: dostawca MailerSend. Wysyła Platyna do swojej organizacji, Administrator i SuperAdministrator do swojego zasięgu.

### Doprecyzowania z 20.11.2026
68. (zastępuje 62) Konta powstają wyłącznie z linków rejestracyjnych, nie z ogólnodostępnego formularza. Formularz: adres e-mail, hasło (z potwierdzeniem), kraj (domyślnie PL), numer Partnera właściciela. Link niesie rekomendującego i organizację, więc nie pytamy o numer rekomendującego ani Platyny. Bezpośrednia Platyna wynika ze schematu organizacji i nie jest polem konta (nie ma „uzupełniania relacji” przy promocji). Pierwsze konta to Platyny: SuperAdministrator generuje link rodzaju „Platyna”, a po wypełnieniu formularza aplikacja tworzy nowy schemat i zakłada w nim konto jako korzeń z rolą Platinum (promocja organizacji o pustej dolnej linii). Schemat `org_root` nie istnieje. Numer rekomendującego Platyny (osoby spoza organizacji, często spoza aplikacji) jest deklaracją uzupełnianą o powiązanie, gdy ta osoba pojawi się w aplikacji.
69. Przy generowaniu linku zapraszający wskazuje rekomendującego: siebie albo osobę ze swojej dolnej linii.
70. Role Ogólne, Foundation, Builder i Silver są flagami dostępu do zasobów i nie mają skutków dla struktury. Strukturalnie liczy się tylko Platinum; Platynę rozpoznaje wpis w rejestrze Platyn, a nie sama wartość roli.
71. Zmiana rekomendującego: każdy Partner wobec swojej dolnej linii, niezależnie od roli, pod warunkiem że jest przodkiem (lub sobą) zarówno przenoszonej osoby, jak i nowego rekomendującego. Dolna linia przenoszonej osoby idzie razem z nią. Tylko w obrębie jednej organizacji; nowy rekomendujący nie może być przenoszoną osobą ani należeć do jej dolnej linii; korzeni organizacji (Platyn) nie przenosimy. Konto ma stałe pole „kto zaprosił” i zmienne „rekomendujący”; poprzednia wartość zostaje w logu. Powiadomienie dostają przeniesiona osoba i nowy rekomendujący (Platyna nie).
72. Usunięcie osoby ze struktury: osoby przez nią zarekomendowane przechodzą do jej rekomendującego. Konto jest oznaczone jako usunięte ze struktury (data, kto, rekomendujący w chwili usunięcia), dezaktywowane i znika z drzewa oraz list; wiersz zostaje, numer Partnera pozostaje zarezerwowany. To nie jest usunięcie danych (anonimizacja to osobna operacja, decyzja 33). Nie można usunąć siebie ani korzenia organizacji. Kto może usuwać i przywracanie: decyzja 79.
73. (doprecyzowuje 65 i 66) Konto ma trzy stany: oczekuje na aktywację → aktywne ↔ dezaktywowane. Etap 1 (oczekuje na aktywację): konto może się zalogować wyłącznie po to, by uzupełnić profil; nie ma żadnych możliwości operacyjnych (rekomendowanie, generowanie linków, zakładanie kont itp.) ani dostępu do repozytorium. Etap 2 (aktywacja przez uprawnioną osobę, zwykle Platynę): włącza wszystkie możliwości operacyjne i dostęp do materiałów roli Ogólne. Dezaktywowane konto nie może się zalogować (sesje po stronie serwera, odcięcie natychmiastowe), zostaje w drzewie z rolą, statusem i danymi, jego dolna linia się nie zmienia. Wypada z mailingu organizacyjnego, a jego nieużyte linki rejestracyjne tracą ważność. Reaktywacja przez tę samą grupę uprawnionych, bez ponownej rejestracji; rola i status zostają. Dezaktywowana Platyna: organizacja działa dalej, zarządzają nią Administrator i SuperAdministrator; Platyna wyżej w linii może zmieniać jej rolę i status, ale nie dezaktywować jej organizacji.
74. Na starcie nie ma importu istniejących struktur: wszyscy rejestrują się przez linki, więc konta powstają od góry (najpierw Platyna, potem jej organizacja).
75. Link rejestracyjny można otwierać wielokrotnie, aby rozpocząć rejestrację, ale traci ważność z chwilą zapisania konta, a bez zapisu po 72 godzinach od wygenerowania.
76. Konto Platyny założone z linku SuperAdministratora nie jest aktywne od razu: przechodzi te same dwa etapy co każde konto (decyzja 73).
77. Mechanika osobnych schematów organizacji w Drizzle (zaakceptowana 20.11.2026):
    - Fabryka tabel: jedna definicja tabel organizacji, zapytania w pełni kwalifikowane nazwą schematu. Nazwę (`org_` + krótki identyfikator) generuje serwer i każde użycie waliduje w rejestrze Platyn; nigdy nie pochodzi od użytkownika.
    - Migracje w dwóch torach: główny (`app`, `drizzle-kit` jak dotąd) i organizacji (drugi config dla schematu wzorcowego, własny runner podmieniający nazwę schematu, wykonujący migracje w transakcji i zapisujący stan w `app.org_schema_migrations`). Runner działa przy tworzeniu schematu oraz po wdrożeniu w pętli po wszystkich schematach (dodatkowy krok `db-migrate.yml`, najpierw `app`, potem organizacje). Czyta posortowane pliki SQL z folderu, nie `journal.json`.
    - Promocja do Platinum jako jedna transakcja z blokadą doradczą organizacji źródłowej (utworzenie schematu, przeniesienie wierszy bez zmiany identyfikatorów, zmiana schematu w katalogu kont, rejestr Platyn, log, powiadomienia).
    - Zapytania przez wiele schematów (SuperAdministrator): osobne zapytania z listy w rejestrze Platyn, wyniki scalane.
    - Testy integracyjne na prawdziwym Postgresie (lokalnie Docker, w CI jako usługa).
    - Zostajemy na `drizzle-orm` 0.45 i `drizzle-kit` 0.31; bez przejścia na wersję 1.0 (RC) przed 30.11.
    - Schematy `org_*` nie są wystawiane w Data API Supabase.
    - Odrzucone: kolumna `tenant_id`, `search_path` per połączenie, kopiowanie tabel z wzorca poleceniem `LIKE`.
78. Zakres na 30.11 (plan z 20.11.2026): mailing marketingowy (Kontakty, Zgody, wysyłka) jest przesunięty na kolejny etap. Na 30.11 wchodzą konta, role, stany, zaproszenia, zmiana rekomendującego, usunięcie ze struktury, promocja do Platinum, mailing organizacyjny (w wersji minimalnej) oraz wspólny fundament wysyłek: kolejka powiadomień (outbox) i adapter poczty.
79. (uzupełnia 72) Osoby ze struktury usuwają: Platyna w swojej organizacji, Administrator w swojej dolnej linii i SuperAdministrator (tak jak aktywację). Przywracanie usuniętych nie wchodzi do wersji 1.
80. Na 30.11 nie ma resetu hasła e-mailem. Zapomniane hasło: uprawniona osoba wystawia nowy link ustawienia hasła (jak przy manualnym założeniu konta).
81. Rolę Administrator nadaje tylko SuperAdministrator.

## Sprawy otwarte

- [ ] Materiały od Administratora: widoczne w całej aplikacji czy tylko w jego dolnej linii?
- [ ] Zasięg adresatów mailingu marketingowego (Kontakty i Klienci są wspólni ponad strukturami): kogo może zapraszać Platyna, a kogo Administrator?
- [ ] Weryfikacja e-maila potwierdzeniem linkiem przed wysyłką marketingową (zgody bez weryfikacji adresu są prawnie kruche); do potwierdzenia z prawnikiem.
- [ ] Domena własna (Vercel, MailerSend: SPF/DKIM) i konfiguracja MailerSend; bez tego nie wyślemy żadnych e-maili.
- [ ] Czy numer rekomendującego Platyny ma własne pole kraju (domyślnie kraj właściciela konta)?- [ ] Kto aktywuje i dezaktywuje samą Platynę: jest korzeniem własnej organizacji, więc raczej nie może zrobić tego sobie; specyfikacja nie rozstrzyga (rekomendacja: SuperAdministrator lub Administrator w górnej linii).- [ ] Weryfikacja telefonu: wybrać SMS lub WhatsApp (porównać dostępność i ceny usług).
- [ ] Z prawnikiem: znacznik oświadczenia MRA, anonimizacja, przechowywanie logu bez usuwania.
- [ ] Polityka prywatności: opisać logowanie IP i User-Agent (prawnie uzasadniony interes).
- [ ] E-marketing (dalszy etap): zakres kampanii, narzędzie do wysyłek, obsługa wypisów i wycofania zgód.
