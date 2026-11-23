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
82. (doprecyzowanie linków rejestracyjnych, 20.11.2026; założenia robocze do potwierdzenia przez Marka)
    - Przy generowaniu linku trzeba podać adresata: adres e-mail albo numer telefonu (WhatsApp); służy do wstępnego wypełnienia formularza i nie wymusza, by konto miało ten adres.
    - Treść linku widać tylko raz, w chwili tworzenia (w bazie jest wyłącznie skrót). Zgubiony link zastępuje się nowym.
    - Termin 72 godzin liczy się od wygenerowania linku (decyzja 75). Link działa tylko, dopóki zapraszający ma aktywne konto (decyzja 73); rekomendujący wskazany w linku musi być aktywny w chwili jego tworzenia, a zapraszający musi go mieć w swojej dolnej linii albo być nim sam (decyzja 69).
    - Zapisanie formularza zakłada konto w stanie „oczekuje na aktywację” z rolą Ogólne (dla linku Platyny: rola Platinum, korzeń nowej organizacji) i od razu loguje właściciela, żeby mógł uzupełnić profil (etap 1, decyzja 73).
    - Numer Partnera w formularzu (ustalone z Markiem): same cyfry, 6–12 znaków (obecnie numery mają 10), niezależnie od kraju; białe znaki wpisane dla czytelności są usuwane. Ten sam numer jest zajęty tylko w obrębie tego samego kraju. Kraj: dwuliterowy kod, domyślnie PL.
    - Błędy formularza (zajęty e-mail, zajęty numer, błędne dane) nie zużywają linku.
83. (poczta, 20.11.2026; założenia robocze do potwierdzenia przez Marka) Wiadomości e-mail idą przez skrzynkę nadawczą (outbox): wiersz powstaje w tej samej transakcji co operacja, która go powoduje, więc wiadomość istnieje tylko wtedy, gdy operacja się udała. Osobny proces w aplikacji wysyła je co ok. 10 s i ponawia błędy chwilowe (po 1, 5, 30 i 120 minutach, do 5 prób); błędy trwałe (zły adres, klucz, domena) kończą się od razu stanem „nieudane”. Wiadomość może przyjść dwa razy, jeśli proces padnie w trakcie wysyłki. Treść linku rejestracyjnego jest w skrzynce tylko do wysyłki: po wysłaniu albo ostatecznej porażce jest kasowana. Sterownik poczty wybiera `MAIL_DRIVER`: `console` (domyślny, wiadomość tylko w logu serwera, razem z linkiem) albo `mailersend` (wymaga klucza i zweryfikowanego adresu nadawcy, czyli domeny). Zaproszenie nie wysyła e-maila samo: trzeba zaznaczyć wysyłkę (`sendEmail`), a adres musi być podany; w przeciwnym razie zapraszający przekazuje link sam (e-mail, WhatsApp, kod QR). Na razie jest jeden rodzaj wiadomości (zaproszenie); treść w PL, DE i EN, nieznany język wraca do PL, termin ważności podajemy w czasie warszawskim. Na darmowym planie Render usypia usługę po ok. 15 minutach bez ruchu; wiadomości wychodzą wtedy dopiero po jej obudzeniu.
84. (frontend, 20.11.2026) Przeglądarka rozmawia z API przez ten sam adres co strona (`/api/graphql`, przekierowanie Next na backend), więc ciasteczko sesji jest własne (first-party) i nie blokują go przeglądarki; adres backendu (`API_URL`) jest znany tylko serwerowi Next i musi być ustawiony już w czasie budowania aplikacji. Język interfejsu (PL, DE, EN) wybiera ciasteczko `NEXT_LOCALE`, bez języka w adresie; brakujące tłumaczenia wracają do polskich. Paleta: granat (`#12285E`, tło ciemne `#0A1633`) i złoto (`#C9A24B`) z logo dMb Global, ciepła biel w trybie jasnym; stany kont mają osobne kolory (aktywne zielony, oczekujące pomarańczowy, dezaktywowane szary).
85. (administrowanie kontami, 20.11.2026; punkty 1–3 ustalone z Markiem, 4–7 to założenia robocze do potwierdzenia) 1) Gdy właściciel konta uzupełni profil (imię, nazwisko, telefon i akceptacja zgód), konto dostaje znacznik „profil uzupełniony” i jedna wiadomość e-mail trafia do Platyny organizacji (korzenia); gdy konto samo jest korzeniem albo korzeń nie jest aktywny, wiadomość dostają wszyscy SuperAdministratorzy. Kolejne zapisy profilu nie wysyłają jej ponownie. 2) Zgody na 30.11 to jedno pole: akceptacja regulaminu i zgód (znacznik czasu); treści i wersje zgód dopiero z modułem Zgód. 3) Dane cudzego konta (imię, nazwisko, telefon) poprawia Platyna we własnej organizacji, Administrator w swojej dolnej linii i SuperAdministrator; numer Partnera i kraj tylko SuperAdministrator (numer jest unikalny i zarezerwowany); własne dane zawsze właściciel, także gdy konto czeka na aktywację. 4) Aktywacja nie wymaga uzupełnionego profilu (specyfikacja tego nie wymaga). 5) Zaproszenie może unieważnić jego autor (aktywny) albo SuperAdministrator; unieważnione wygasa od razu i widać je jako wygasłe; Platyna i Administrator cudzych zaproszeń nie unieważniają. 6) Rolę można zmienić także koncie oczekującemu na aktywację. 7) Każdy aktywny Partner widzi siebie i swoją dolną linię (SuperAdministrator wszystkie organizacje); konto spoza tego zasięgu wygląda jak nieistniejące. E-mail z zaproszeniem podaje imię i nazwisko zapraszającego, jeśli je ma.
86. (zmiana rekomendującego i usunięcie ze struktury, 20.11.2026; punkty 1–2 ustalone z Markiem, 3–6 to założenia robocze do potwierdzenia; uzupełnia 71 i 72) 1) Nowym rekomendującym przy przenoszeniu może być tylko konto aktywne, tak jak przy zaproszeniach (decyzja 73). 2) Przy usunięciu ze struktury nikt nie dostaje e-maila; każda zmiana (usunięcie i zmiana rekomendującego każdej przeniesionej osoby) trafia do logu. 3) Przeniesienie pod rekomendującego, którego osoba już ma, nic nie zmienia: bez wpisu w logu i bez e-maila. 4) Usunięte konto traci rekomendującego w drzewie (poprzedni zostaje w polu „rekomendujący w chwili usunięcia”), więc nie wisi w żadnej dolnej linii; zwykły Partner takiego konta nie widzi, SuperAdministrator tak, ale nie może na nim nic zrobić. 5) Zaproszenie, w którym wskazano jako rekomendującego osobę usuniętą ze struktury, traci ważność, a nowego takiego nie da się utworzyć. 6) E-mail i numer Partnera usuniętego konta zostają zarezerwowane. Zmiany drzewa jednej organizacji (przeniesienia i usunięcia) są wykonywane pojedynczo (blokada na schemat), żeby dwie równoległe zmiany nie stworzyły cyklu.
87. (promocja do Platinum, 20.11.2026; punkty 1–2 ustalone z Markiem, 3–7 to założenia robocze do potwierdzenia; uzupełnia 64 i 77) 1) Po promocji e-mail dostaje tylko awansowana osoba; Platyna wyżej nie. 2) Nieużyte linki rejestracyjne utworzone przez kogoś spoza awansowanej gałęzi, a wskazujące osobę z tej gałęzi jako rekomendującego, wygasają od razu (wpis w logu z powodem „promotion”); linki osób z awansowanej gałęzi przechodzą do nowego schematu i działają dalej. Linki SuperAdministratora też przechodzą. 3) Promocja to jedna transakcja: nowy schemat, skopiowanie wierszy osoby i jej dolnej linii (te same identyfikatory, rola awansowanej osoby PLATINUM, bez rekomendującego w nowym schemacie), usunięcie ich ze schematu źródłowego, przepięcie katalogu kont, rejestr Platyn (schemat źródłowy, kto, kiedy, poprzedni rekomendujący), log; błąd na dowolnym etapie cofa całość. 4) W schemacie źródłowym zostaje wiersz awansowanej osoby jako znacznik (z jej rekomendującym, bez dolnej linii); jej prawdziwe dane (rola, status, stan) są w nowym schemacie, a widok z góry czyta je stamtąd i oznacza konto jako odpiętą organizację z datą i autorem awansu. 5) Górna linia Platyny to jej przodkowie w schemacie źródłowym i, idąc po rejestrze, przodkowie Platyny, z której organizacji ten schemat powstał (Platyna Platyny); ona zmienia rolę i status korzenia zgodnie z macierzą, dezaktywować może go tylko Administrator wyżej i SuperAdministrator. 6) Gdy awansowana osoba ma w dolnej linii wcześniej odpiętą Platynę, jej znacznik przechodzi do nowego schematu, a organizacja tej Platyny zostaje przy niej (zmienia się tylko jej miejsce w rejestrze). 7) Rejestracja z linku bierze tę samą blokadę organizacji co przeniesienia, usunięcia i promocje, żeby nowa osoba nie wpadła w przenoszoną gałąź. Promocja jest nieodwracalna.
88. (mailing organizacyjny, 20.11.2026; punkty 1–2 ustalone z Markiem, 3–7 to założenia robocze do potwierdzenia; uzupełnia 67 i 78) 1) Wysyłający wybiera najniższą rolę adresatów; wiadomość dostają osoby z tą rolą i wyższymi (role są liniowe), domyślnie wszyscy. 2) Wiadomość dostają tylko konta aktywne; oczekujące na aktywację, dezaktywowane i usunięte ze struktury nie. 3) Zasięg: Platyna wysyła do całej swojej organizacji, Administrator do swojej dolnej linii, SuperAdministrator do wszystkich organizacji; nadawca nie jest swoim adresatem, a Platyny z odpiętych organizacji (znaczniki) nie dostają mailingu górnej linii. 4) Treść: temat i tekst po polsku (wymagane), opcjonalnie wersje DE i EN; każdy dostaje wersję w swoim języku, a gdy jej nie ma, polską. Tekst zwykły, bez HTML od użytkownika; stopka podaje nadawcę. 5) Wysyłka idzie przez skrzynkę nadawczą: jeden wiersz na adresata w transakcji, która zapisuje wysyłkę w historii; błąd cofa całość. Limity: temat do 200 znaków, tekst do 20 000, do 2000 adresatów na wysyłkę. 6) Historia pokazuje własne wysyłki nadawcy ze stanem dostarczenia (wysłane, w kolejce, błędy); w logu zostaje liczba i role, bez treści i bez listy adresatów. 7) Bez wypisywania się: to komunikacja organizacyjna, nie marketing (marketing: osobny etap ze zgodami).
89. (wdrożenie, 20.11.2026; uzupełnia 63, 83 i 84) 1) Gałąź `production` jest produkcyjna: Render i Vercel śledzą tylko ją, a workflow migracji (`db-migrate.yml`) i CI uruchamiają się po pushu do `production` (CI także po pushu do `main` i dla każdego PR); `main` jest gałęzią integracyjną i niczego nie wdraża. Migracje idą razem z wdrożeniem kodu, ale nie atomowo, więc muszą być addytywne (najpierw dodawanie kolumn i tabel, usuwanie dopiero po wdrożeniu kodu, który ich nie używa). 2) Adres produkcyjny frontendu to https://project2027.dmbglobal.pl (domena własna na Vercelu; stary adres `dmb-project-2027.vercel.app` zostaje aktywny), backend: https://dmb-backend-6fxq.onrender.com. Linki w e-mailach powstają z `APP_BASE_URL` (Render), więc ta zmienna ma wskazywać domenę własną. 3) Adres backendu dla frontendu to `API_URL` (zmienna serwerowa Vercela): jest zapisywana w rewrite w czasie budowania i musi być wymieniona w `turbo.json` (`env`), inaczej Turborepo ją odfiltruje, a rewrite pójdzie na `localhost` (objaw: `DNS_HOSTNAME_RESOLVED_PRIVATE`, logowanie nie działa). 4) Nagłówek każdej strony pokazuje pod logo `wersja [frontend] | [backend]` według `package.json` każdej części; wersję backendu podaje on sam publicznym zapytaniem `version` (gdy backend jest niedostępny, zamiast niej „–”); numery podbija właściciel commitem „Bump version”. 5) Strona główna to powitanie z przyciskiem „Zaloguj” (do `/login`); osoba już zalogowana jest od razu kierowana do `/accounts` (konto aktywne) albo `/profile`. 6) Stan konta MailerSend „dMb Global Dev”: zatwierdzone, ale plan sandbox (100 wiadomości, 10 na minutę); domena nadawcza `dmbglobal.pl` zweryfikowana, nadawca `project2027@dmbglobal.pl`, śledzenie otwarć i kliknięć wyłączone dla każdej wiadomości.
90. (kopia zapasowa bazy, 23.11.2026; punkty 1–3 ustalone z Markiem, 4–6 to założenia robocze do potwierdzenia) 1) Kopia zapasowa jest ręczna (`pnpm --filter backend db:backup`), bez harmonogramu; odtwarzanie też ręczne (`pnpm --filter backend db:restore`). 2) To zwykły zrzut SQL (`pg_dump`) schematów `app`, `drizzle` i wszystkich `org_*` (nigdy schematów Supabase), spakowany do zip w `backend/_backup/` (wpisany do `.gitignore`); nazwa pliku to `serwer_baza_data_godzina.zip`, np. `…supabase.com-5432-<ref>-postgres_2026-11-23_15-46-49.zip`. 3) Odtwarzanie wymaga wpisania nazwy hosta bazy docelowej (albo `--confirm-host`), działa w jednej transakcji (błąd cofa całość) i nadpisuje tabele z kopii. 4) Kopia zawiera dane osobowe (Kontakty, zgody, log), więc jest trzymana tylko na lokalnym dysku właściciela i nie jest wysyłana ani commitowana. 5) Anonimizacja na żądanie (reguła 9) nie dotyczy starych kopii: po przywróceniu kopii sprzed anonimizacji trzeba anonimizację powtórzyć, a stare kopie usuwać według przyjętej retencji (otwarte pytanie). 6) Kopie Supabase (plan i okres przechowywania) zostają osobnym zabezpieczeniem; ta kopia ich nie zastępuje.

## Sprawy otwarte

- [ ] Materiały od Administratora: widoczne w całej aplikacji czy tylko w jego dolnej linii?
- [ ] Zasięg adresatów mailingu marketingowego (Kontakty i Klienci są wspólni ponad strukturami): kogo może zapraszać Platyna, a kogo Administrator?
- [ ] Weryfikacja e-maila potwierdzeniem linkiem przed wysyłką marketingową (zgody bez weryfikacji adresu są prawnie kruche); do potwierdzenia z prawnikiem.
- [ ] Czy aktywacja ma być zablokowana, dopóki właściciel nie uzupełni profilu (decyzja 85, punkt 4)?
- [ ] Czy Platyna lub Administrator mogą unieważniać zaproszenia swojej dolnej linii (decyzja 85, punkt 5)?
- [ ] MailerSend: plan sandbox ma limit 100 wiadomości i 10 na minutę; przed realnym startem i większymi mailingami potrzebny płatny plan albo podniesienie limitów (domena i nadawca są gotowe, decyzja 89).
- [ ] Potwierdzenie założeń roboczych z decyzji 82–89 (każda ma w treści punkty oznaczone jako założenia robocze).
- [ ] Przed realnymi danymi: kopia bazy w Supabase, ochrona gałęzi `production` (wymagane CI przed mergem) i ograniczenie środowiska `production` w GitHub do tej gałęzi.
- [ ] Sprawdzić na produkcji adres IP w logu (`select ip from app.audit_log`); gdy widać adres infrastruktury, ustawić `TRUST_PROXY_HOPS=2` na Renderze.
- [ ] Treść zgody przy profilu (dziś tymczasowe „Akceptuję regulamin i zgody”) i ich wersjonowanie z modułem Zgód.
- [ ] Czy numer rekomendującego Platyny ma własne pole kraju (domyślnie kraj właściciela konta)?- [ ] Kto aktywuje i dezaktywuje samą Platynę: jest korzeniem własnej organizacji, więc raczej nie może zrobić tego sobie; specyfikacja nie rozstrzyga (rekomendacja: SuperAdministrator lub Administrator w górnej linii).- [ ] Weryfikacja telefonu: wybrać SMS lub WhatsApp (porównać dostępność i ceny usług).
- [ ] Z prawnikiem: znacznik oświadczenia MRA, anonimizacja, przechowywanie logu bez usuwania.
- [ ] Polityka prywatności: opisać logowanie IP i User-Agent (prawnie uzasadniony interes).
- [ ] Kopie zapasowe bazy (decyzja 90): jak długo je trzymać, kto ma do nich dostęp i jak je usuwać po żądaniu usunięcia danych; do potwierdzenia z prawnikiem.
- [ ] E-marketing (dalszy etap): zakres kampanii, narzędzie do wysyłek, obsługa wypisów i wycofania zgód.
