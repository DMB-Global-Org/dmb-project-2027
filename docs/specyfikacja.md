# dMb Projekt 2027 – specyfikacja wstępna

Stan na 01.11.2026 (po opisie funkcjonalności z 30.10.2026) · Marek Kustosz. Skopiowano do repozytorium 19.11.2026; uzupełniono 19–20.11.2026 o decyzje 62–81.

Wersja robocza na żywo: https://claude.ai/code/artifact/79b03467-e381-4fce-92c2-a7f26ab27b24
Tablica Event Storming: https://miro.com/app/board/uXjVHiUeyUM=/

## Cel i zakres

Aplikacja ma trzy nadrzędne cele:

1. **Edukacja Partnerów**: udostępnianie treści edukacyjnych dostosowanych do poziomu kwalifikacji Partnera.
2. **Zarządzanie Kontaktami**: prowadzenie historii wszystkich osób, które w jakikolwiek sposób zetknęły się z DMB (były zapraszane, widziały plan), niezależnie od tego, czy nie zareagowały, zostały Klientem, czy Partnerem.
3. **E-marketing** (dalszy etap): aktywny e-marketing o działalności DMB Global, oparty na danych o Kontaktach i zebranych zgodach marketingowych.

dMb Projekt 2027 to aplikacja dla struktury DMB Global (Dynamic Modern Business Global). Ma trzy obszary:

1. **Repozytorium dokumentów**: wideo, nagrania głosowe, teksty i prezentacje. Dostęp do nich zależy od roli użytkownika.
2. **Zarządzanie strukturą**: rejestracja i weryfikacja Partnerów, aktywacja kont przez Platynę, Administratora lub SuperAdministratora, role, statusy i awanse, osobne przechowywanie struktur platynowych.
3. **Kontakty**: historia osób zapraszanych do współpracy przez spotkania BOM i POM (np. rozwiązania wellbeing MRA i MyBODY.ID), wraz z wynikiem każdej interakcji i zgodami marketingowymi.

Na start najważniejsze są rejestracja, weryfikacja i aktywacja kont oraz rola Platyny, bo od niej zależy sposób przechowywania danych.

**Termin**: funkcjonalności z opisu z 30.10.2026 (konta, role, statusy, administrowanie kontem, mailing) mają być gotowe do 30.11.2026.

Aplikacja jest wielojęzyczna od początku. Na start: polski (podstawowy), niemiecki i angielski. Później mogą dojść języki krajów bałtyckich, czeski, słowacki i węgierski, więc dodanie języka nie może wymagać zmian w kodzie.

Pierwsza wersja to aplikacja webowa, działająca na komputerach i w przeglądarkach urządzeń mobilnych (układ responsywny). Backend jest osobną aplikacją z API, z którym później połączy się w ten sam sposób aplikacja mobilna.

Powiadomienia: od startu e-mail. SMS lub WhatsApp; ten sam kanał posłuży do weryfikacji telefonu, a wybór zależy od dostępności i ceny usług. Powiadomienia web push w przeglądarce, jeśli będą technicznie wykonalne (na iPhonie działają dopiero po dodaniu aplikacji do ekranu głównego).

## Słownik pojęć

Te nazwy obowiązują w dokumencie, na tablicy Event Storming i później w kodzie.

| Pojęcie | Znaczenie |
| --- | --- |
| Partner | Osoba ze statusem Przedsiębiorcy lub Stałego Klienta Plus Amway, posiadająca numer: ABO# (EN), Numer PA (PL), Geschäftspartnernummer (DE/AT). Dawniej „współpracownik”. |
| Klient | Osoba ze statusem Klienta Amway, posiadająca Numer Klienta (PL) / Customer Number (EN). Ma konto w aplikacji ze wskazaniem Partnera zapraszającego. W każdej chwili może zostać Partnerem. |
| Kontakt | Osoba poinformowana o możliwościach biznesowych (BOM) lub produktowych (POM) dMb/Amway, niebędąca ani Klientem, ani Partnerem. |
| Numer Partnera | ABO# / Numer PA / Geschäftspartnernummer, przypisany do kraju nadania. Dawniej „ID w strukturze”. |
| Rekomendujący | Partner, który bezpośrednio wprowadził osobę do struktury (zwykle ten, który zaprosił ją na BOM). |
| Rola | Poziom dostępu do zasobów informacyjnych i edukacyjnych: Ogólne, Foundation, Builder, Silver, Platinum, Administrator, SuperAdministrator. |
| Platyna | Osoba z rolą Platinum. Administrator swojej organizacji: aktywuje konta, zmienia role i statusy, promuje do Platinum. Promocja do Platinum wydziela jej organizację do osobnego schematu bazy. |
| Bezpośrednia Platyna | Pierwsza osoba z rolą Platinum w górnej linii sponsorowania danego użytkownika. |
| Status | Dodatkowa informacja o właścicielu konta: Nieaktywny, Aktywny, GoMagic, DiamondSchool. Aktualizuje go bezpośrednia Platyna. |
| Struktura platynowa | Wszystkie osoby pod daną Platyną (do kolejnej Platyny w dole). |
| BOM | Business Opportunity Meeting: spotkanie o możliwościach biznesowych, online lub na żywo. Dawniej „BP” (prezentacja biznesplanu). |
| POM | Product Opportunity Meeting: spotkanie o produktach i rozwiązaniach dMb/Amway, np. z obszaru wellbeing (MRA, MyBODY.ID). Lista rozwiązań jest otwarta. |
| MRA | Rozwiązanie wellbeing prezentowane na POM: szybki test zdrowotny po zgodzie i oświadczeniu o braku przeciwwskazań, kończy się raportem z sugestiami. Nazwy „biorezonans” nie używamy. |
| Test MyBODY.ID | Rozwiązanie wellbeing prezentowane na POM: płatne badanie genetyczne wykonywane anonimowo przez zewnętrzne laboratorium, poprzedzone rozmową w grupie i spotkaniem indywidualnym. |
| Zgody marketingowe | Zgoda na powiadomienia e-mail lub SMS o wydarzeniach, produktach i usługach. |

## Role i hierarchia

Rola opisuje poziom dostępu do zasobów informacyjnych i edukacyjnych. Role są predefiniowane, a każda wyższa rola obejmuje uprawnienia niższych (stan po opisie z 30.10.2026).

1. **Ogólne**: nadawana automatycznie w chwili tworzenia konta.
2. **Foundation**
3. **Builder**
4. **Silver**
5. **Platinum**: w chwili promocji cała organizacja użytkownika zostaje oddzielona do osobnego obszaru i odseparowana od wglądu użytkowników w górnej linii sponsorowania. Daje praktycznie pełny dostęp do repozytorium.
6. **Administrator**: rola nadawana użytkownikowi w dowolnym miejscu struktury; nadaje ją tylko SuperAdministrator. Daje uprawnienia do wszystkich kont poniżej niego, w całej dolnej linii rekomendacji. Dolna linia kończy się na granicy odpiętej organizacji platynowej, tak jak u zwykłego Partnera.
7. **SuperAdministrator**: konto tworzone z chwilą uruchomienia aplikacji, zakłada pierwsze konta użytkowników.

Rola Gold została celowo usunięta, a nazwy Brąz Foundation i Brąz Builder zastąpiły Foundation i Builder.

Role Ogólne, Foundation, Builder i Silver są flagami dostępu do zasobów i nie mają skutków dla struktury. Strukturalnie liczy się tylko Platinum (odpięcie organizacji); Platynę rozpoznaje wpis w rejestrze Platyn, a nie sama wartość roli.

**Status** to dodatkowa informacja o właścicielu konta, niezależna od roli: Nieaktywny, Aktywny, GoMagic, DiamondSchool. Aktualizuje go bezpośrednia Platyna, czyli pierwsza osoba z rolą Platinum w górnej linii sponsorowania.

Tytuły (piny) powyżej Platyny, np. Szafir, Perła, Szmaragd, Rubin, nie są rolami i nie dają dodatkowych uprawnień. Pin zostaje osobnym polem obok Statusu. Platyna wpisuje go ręcznie na swoim koncie.

**Uprawnienia według ról**

| Rola | Zakłada konta | Aktywuje i dezaktywuje | Zmienia role | Zmienia statusy | Promuje do Platinum | Zmienia rekomendującego |
| --- | --- | --- | --- | --- | --- | --- |
| Ogólne, Foundation, Builder, Silver | tak, we własnej organizacji | nie | nie | nie | nie | tak, w swojej dolnej linii |
| Platinum | tak, we własnej organizacji | tak, we własnej organizacji | tak, we własnej organizacji | tak, we własnej organizacji | tak, we własnej organizacji | tak, w swojej organizacji |
| Administrator | tak, w swojej dolnej linii | tak | tak, poza Administrator i SuperAdministrator | tak | tak | tak, w swojej dolnej linii |
| SuperAdministrator | tak | tak | tak, poza SuperAdministrator | tak | tak | tak |

Nikt nie może zmienić własnej roli, a Platyna nie zmienia też własnego statusu. Rolę i status Platyny zmienia Platyna w jej górnej linii rekomendacji (najbliższa albo wyższa, np. Platyna Platyny), każdy Administrator w górnej linii albo SuperAdministrator. Widzą przy tym konto samej Platyny, ale nie jej odpiętą organizację. Każda struktura platynowa jest całkowicie odrębna. Dotychczasowa Platyna widzi tylko znacznik w miejscu, w którym odpięła się nowa organizacja platynowa.

## Obszar 1: Repozytorium dokumentów

Użytkownik widzi tylko te materiały, do których uprawnia go jego rola.

- **Typy materiałów**: wideo, nagranie głosowe, dokument tekstowy, prezentacja. Materiał może mieć kilka wersji językowych. Użytkownik domyślnie widzi wersję w swoim języku (a gdy jej brak, po polsku) i może przełączyć się na inną.
- **Reguła dostępu**: każdy materiał ma przypisaną minimalną rolę, a widzą go osoby z tą rolą lub wyższą. Awans na wyższą rolę zachowuje dostęp do wszystkich materiałów z niższych ról i dodaje materiały z nowego poziomu.
- **Podstawowe funkcje**: przeglądanie według kategorii, wyszukiwanie, odtwarzanie wideo i audio w aplikacji, podgląd prezentacji.
- **Dodawanie materiałów**: materiały dodaje i nadaje im minimalną rolę SuperAdministrator i Administratorzy.

## Obszar 2: Konta i struktura

Konto ma trzy stany: **oczekuje na aktywację** → **aktywne** ↔ **dezaktywowane**. Etap 1: konto oczekujące może się zalogować wyłącznie po to, by uzupełnić profil; nie ma żadnych możliwości operacyjnych (rekomendowanie, generowanie linków, zakładanie kont itp.) ani dostępu do repozytorium. Gdy właściciel poda wszystkie wymagane informacje i wyrazi zgody, konto dostaje automatycznie znacznik „profil uzupełniony”, a uprawniona osoba (Platyna we własnej organizacji, Administrator lub SuperAdministrator) dostaje wiadomość. To ona aktywuje konto i nadaje mu właściwą rolę; aktywacja (etap 2) włącza wszystkie możliwości operacyjne i dostęp do materiałów roli Ogólne. Stan konta jest odrębny od Statusu, który jest tylko informacją aktualizowaną przez bezpośrednią Platynę. Każdy Partner, niezależnie od roli, widzi całą strukturę pod sobą, z wyjątkiem odpiętych organizacji platynowych, wraz ze wszystkimi danymi kont.

**Metody zakładania kont**

| Metoda | Zakładający musi znać | Co dostaje właściciel konta | Co podaje właściciel |
| --- | --- | --- | --- |
| Manualne założenie konta (login = e-mail) | adres e-mail | powiadomienie o utworzeniu konta | hasło, numer telefonu używany w WhatsApp |
| Zaproszenie e-mailem | adres e-mail | e-mail z linkiem do formularza rejestracyjnego | hasło, adres e-mail, numer telefonu używany w WhatsApp |
| Link lub kod QR | numer telefonu używany w WhatsApp | wiadomość z linkiem lub kodem QR do formularza | hasło, adres e-mail, numer telefonu używany w WhatsApp |

Przed aktywacją konto Partnera uzupełnia się o dane ustalone wcześniej:

- imię i nazwisko,
- numer Partnera (ABO# / Numer PA / Geschäftspartnernummer) i kraj, w którym go nadano,
- numer bezpośrednio rekomendującego (przy zaproszeniu e-mailem lub linkiem wynika z linku: osoba zapraszająca albo osoba z jej dolnej linii wskazana przy generowaniu linku),
- zgody.

**Pierwsze konta i logowanie**

- Konta powstają z linków rejestracyjnych, nie z ogólnodostępnego formularza. Formularz zawiera: adres e-mail, hasło (z potwierdzeniem), kraj (domyślnie PL) i numer Partnera właściciela konta. Pozostałe dane uzupełnia się przed aktywacją. Link można otwierać wielokrotnie, aby rozpocząć rejestrację, ale traci ważność z chwilą zapisania konta, a bez zapisu po 72 godzinach od wygenerowania. Adresat linku (e-mail lub telefon) jest wymagany przy generowaniu; treść linku widać tylko raz (decyzja 82). Na starcie nie ma importu istniejących struktur, więc konta powstają od góry.
- Link niesie rekomendującego i organizację, więc formularz nie pyta o numer rekomendującego ani Platyny. Bezpośrednia Platyna wynika ze schematu organizacji i nie jest polem konta. Zapraszający może przy generowaniu linku wskazać siebie albo osobę ze swojej dolnej linii jako rekomendującego.
- Pierwsze konta to Platyny. SuperAdministrator generuje link rodzaju „Platyna”; po wypełnieniu formularza aplikacja tworzy nowy schemat i zakłada w nim konto jako korzeń organizacji z rolą Platinum (promocja organizacji o pustej dolnej linii). Numer rekomendującego Platyny (osoby spoza organizacji, często spoza aplikacji) jest deklaracją uzupełnianą o powiązanie, gdy ta osoba pojawi się w aplikacji. Konto takiej Platyny nie jest aktywne od razu: przechodzi te same dwa etapy co każde konto.
- Logowanie: e-mail i hasło (przy ustalaniu hasło trzeba potwierdzić), własne rozwiązanie w backendzie. Na start bez weryfikacji adresu e-mail. Powiadomienia i zaproszenia wysyła MailerSend. Resetu hasła e-mailem na 30.11 nie ma: uprawniona osoba wystawia nowy link ustawienia hasła.

**Administrowanie kontem**

- Zmiana i uzupełnianie danych konta: własne dane zawsze właściciel (także przed aktywacją). Imię, nazwisko i telefon cudzego konta poprawia Platyna we własnej organizacji, Administrator w dolnej linii albo SuperAdministrator; numer Partnera i kraj tylko SuperAdministrator (decyzja 85).
- Zgody na 30.11: jedna akceptacja regulaminu i zgód zapisana ze znacznikiem czasu; treści i wersje zgód dojdą z modułem Zgód. Profil jest uzupełniony, gdy są imię, nazwisko, telefon i zgody; wiadomość o tym dostaje Platyna organizacji (gdy to sama Platyna albo jest nieaktywna, SuperAdministratorzy).
- Każdy aktywny Partner widzi siebie i swoją dolną linię; SuperAdministrator widzi wszystkie organizacje.
- Zaproszenie unieważnia jego autor albo SuperAdministrator.
- Aktywowanie i dezaktywowanie konta, zmiana roli, zmiana statusu i promowanie do Platinum: tylko Platyna we własnej organizacji, Administrator i SuperAdministrator.
- Nowe konto dostaje rolę Ogólne; dostęp do materiałów tej roli i możliwości operacyjne włącza dopiero aktywacja.

**Reguła walidacji**: rekomendujący musi należeć do tej samej struktury platynowej co bezpośrednia Platyna. Aplikacja sprawdza to przy uzupełnianiu danych, a niezgodne numery odrzuca. Klient jest przypisany do struktury platynowej swojego Partnera zapraszającego. Gdy Klient zostaje Partnerem, może wskazać innego rekomendującego, także z innej struktury platynowej. Wtedy trafia tam, gdzie wskazuje nowy rekomendujący, a Partner zapraszający zostaje w jego historii. Partner zapraszający i jego Platyna dostają powiadomienie o przejściu Klienta do innej struktury.

Przy manualnym założeniu konta właściciel dostaje powiadomienie z prośbą o ustalenie hasła i podanie numeru WhatsApp. Do tego czasu konto ma oznaczenie „weryfikacja pominięta”, które znika po potwierdzeniu danych.

**Awanse i wydzielenie struktury**

- Platyna jest administratorem swojej organizacji: nadaje w niej role, zmienia statusy i promuje do Platinum, wyłącznie ręcznie i bez logiki podpowiadania w aplikacji. Nie zmienia własnej roli ani statusu. Osoby z wyższymi pinami nie działają w cudzych strukturach.
- Administrator może to samo wobec wszystkich kont w swojej dolnej linii rekomendacji, niezależnie od miejsca w strukturze, ale nie nadaje ról Administrator ani SuperAdministrator.
- SuperAdministrator powstaje z chwilą uruchomienia aplikacji, zakłada pierwsze konta i nadaje dowolne role poza SuperAdministrator.
- Promocja do Platinum, niezależnie od tego, kto ją nada, przenosi całą organizację tej osoby do osobnego schematu w PostgreSQL (bezpośrednia Platyna wynika ze schematu, nie jest osobnym polem konta). Nowa Platyna od tej chwili sama zarządza swoją organizacją. Dotychczasowa Platyna widzi tylko wpis: kto i kiedy został wypromowany. Nie ma żadnych danych ani podsumowań odpiętej organizacji.
- Degradacji Platyny nie przewidujemy: rola Platinum nie może zostać obniżona (konto można tylko dezaktywować).

**Zmiana rekomendującego, usunięcie ze struktury, dezaktywacja**

- Zmiana rekomendującego: może ją wykonać każdy Partner wobec swojej dolnej linii, niezależnie od roli, pod warunkiem że jest przodkiem (lub sobą) zarówno przenoszonej osoby, jak i nowego rekomendującego. Dolna linia przenoszonej osoby idzie razem z nią. Operacja działa tylko w obrębie jednej organizacji; nowy rekomendujący nie może być przenoszoną osobą ani należeć do jej dolnej linii. Korzeni organizacji (Platyn) w ten sposób nie przenosimy. Konto zachowuje stałe pole „kto zaprosił”, a poprzedni rekomendujący zostaje w logu. Powiadomienie dostają przeniesiona osoba i nowy rekomendujący.
- Usunięcie ze struktury: osoby przez nią zarekomendowane przechodzą do jej rekomendującego. Konto jest oznaczone jako usunięte ze struktury (data, kto, rekomendujący w chwili usunięcia), dezaktywowane, i znika z drzewa oraz list; wiersz zostaje, a numer Partnera pozostaje zarezerwowany. To nie jest usunięcie danych osoby (anonimizacja to osobna operacja). Nie można usunąć siebie ani korzenia organizacji. Usuwać mogą Platyna w swojej organizacji, Administrator w swojej dolnej linii i SuperAdministrator; przywracanie usuniętych nie wchodzi do wersji 1.
- Dezaktywacja konta: dezaktywować i ponownie aktywować mogą Platyna we własnej organizacji, Administrator i SuperAdministrator. Dezaktywowane konto nie może się zalogować (sesje po stronie serwera, więc odcięcie jest natychmiastowe), zostaje w drzewie z rolą, statusem i danymi, a jego dolna linia się nie zmienia. Wypada z mailingu organizacyjnego, a jego nieużyte linki rejestracyjne tracą ważność. Ponowna aktywacja nie wymaga rejestracji; rola i status zostają. Dezaktywowana Platyna: organizacja działa dalej, zarządzają nią Administrator i SuperAdministrator; Platyna wyżej w linii może zmieniać jej rolę i status, ale nie dezaktywować jej organizacji.

## Obszar 3: Kontakty

Aplikacja zapamiętuje każdą interakcję z Kontaktem: kiedy się odbyła, z czyjej inicjatywy i jak się skończyła. Dzięki temu kolejny Partner wie, że dana osoba już była na BOM.

Schemat ścieżek kontaktu: BOM i POM (np. MRA, MyBODY.ID) prowadzą przez zapis interakcji do trzech wyników: Partner, Klient, brak zainteresowania. Wszystkie ścieżki kończą się tym samym zapisem interakcji. Klient może później zmienić status na Partnera.

**Ścieżki**

1. **Spotkanie BOM** (Business Opportunity Meeting): kontakt, zaproszenie, umówienie terminu (online lub na żywo), prezentacja możliwości biznesowych, wynik.
2. **Spotkanie POM** (Product Opportunity Meeting): prezentacja produktów i rozwiązań. Każde rozwiązanie może mieć własny przebieg, np. dwa rozwiązania z obszaru wellbeing:
    1. **MRA**: zaproszenie, założenie konta Klienta ze zgodami, podpisanie na papierze oświadczenia o braku przeciwwskazań (dokument zostaje u Partnera, w aplikacji tylko znacznik), test, raport z sugestiami (np. zmiana nawyków, konsultacja z lekarzem), wynik.
    2. **MyBODY.ID**: rozmowa o zdrowiu w grupie około 5 osób, spotkanie indywidualne z krótkim testem MRA, decyzja o teście MyBODY.ID na własny koszt, przekazanie materiału do laboratorium, raport trafia bezpośrednio do osoby, wynik.

Lista produktów i rozwiązań jest otwarta. Nowe rozwiązanie dodaje się jako kolejną pozycję katalogu, bez zmian w kodzie.

**Wyniki każdej ścieżki**

- **Partner**: osoba dostaje numer Partnera Amway i konto w aplikacji (obszar 2), a jej rekomendującym jest Partner, który poprowadził interakcję.
- **Klient**: dostaje konto w aplikacji ze wskazaniem Partnera zapraszającego, kupuje bez rabatu i może później zostać Partnerem.
- **Brak zainteresowania**: osoba może zostawić zgody marketingowe, a kontakt trwa przez listy mailingowe i SMS.

**Konto Klienta**

- Klient tylko się rejestruje: wypełnia prosty formularz z danymi kontaktowymi, wskazuje Partnera zapraszającego i zaznacza zgody.
- E-mail i telefon są weryfikowane, żeby zgody na pewno wyraziła właściwa osoba.
- Administrator może założyć konto Klienta bez weryfikacji. Konto ma wtedy oznaczenie „weryfikacja pominięta”.
- Klient nie ma dostępu do repozytorium ani do struktury.

Kontakt może przejść ścieżkę wielokrotnie, także z innym Partnerem. Do szybkiego podglądu przy Kontakcie zapisany jest ostatni Partner, który zaprosił na BOM, i ostatni, który wykonał test MRA. Pełną historię odtwarza się z logu systemowego, bez osobnej funkcji. Log przegląda bez ograniczeń SuperAdministrator, Administrator w swojej dolnej linii, a Platyna w zakresie swojej struktury oraz powiązanych z nią Kontaktów, Klientów i Partnerów. Wpisów logu nie usuwamy. Monitorujemy jego rozmiar i reagujemy, gdy mocno urośnie, tak żeby nie tracić informacji i rozsądnie korzystać z zasobów.

**Widoczność Kontaktów**

- Kontakty są wspólne dla całej DMB, ponad strukturami platynowymi.
- Platyna ma nieograniczony dostęp do Kontaktów, także z innych organizacji platynowych.
- Partner z rolą poniżej Silver może wyszukać Kontakt po telefonie lub e-mailu, zanim go zarejestruje. Dostaje tylko informację o śladzie w DMB, np. „odbył test MRA”, „był na BOM”, „ma konto”.
- Szczegóły (kto, kiedy, u kogo) widzą role Silver i Platinum oraz Administrator i SuperAdministrator. Próg jest konfigurowalny. Niższe role po szczegóły zwracają się do swojej najbliższej Platyny.

## Mailing

Zebrane dane kontaktowe służą dwóm rodzajom wysyłek.

| Rodzaj | Adresaci | Podstawa |
| --- | --- | --- |
| Mailing organizacyjny | Partnerzy, z uwzględnieniem ról | komunikacja w ramach organizacji |
| Mailing marketingowy | Klienci i Kontakty | zebrane zgody marketingowe, osobno dla każdego kanału |

Mailing marketingowy realizuje trzeci nadrzędny cel aplikacji, czyli e-marketing. Na termin 30.11 wchodzi mailing organizacyjny i wspólny fundament wysyłek (kolejka powiadomień i adapter poczty); mailing marketingowy (Kontakty, Zgody, wysyłka) jest przesunięty na kolejny etap.

Wysyłki obsługuje MailerSend. Mailingi wysyłają: Platyna do swojej organizacji oraz Administrator i SuperAdministrator do swojego zasięgu. Dezaktywowane konta nie dostają mailingu organizacyjnego.

## Model danych (szkic)

Dane wspólne są w schemacie głównym, a każda struktura platynowa ma własny schemat PostgreSQL. Drzewo struktury tworzą powiązania Partner → rekomendujący. Bezpośrednia Platyna jest wspólna dla całej struktury.

| Encja | Schemat | Najważniejsze pola |
| --- | --- | --- |
| Rola | główny | nazwa, poziom w hierarchii |
| Platyna (rejestr) | główny | numer Partnera, nazwa schematu, kto wypromował, data promocji, rekomendujący Platyny (zadeklarowany numer do późniejszego powiązania) |
| Zaproszenie (link) | główny | zapraszający, rekomendujący, schemat organizacji, rodzaj (Platyna / Partner), adresat (e-mail lub telefon), termin ważności (72 godz.), wykorzystanie (wygasa z chwilą zapisu konta) |
| Partner | platynowy | imię, nazwisko, e-mail, telefon (WhatsApp), numer Partnera, kraj numeru, rekomendujący, kto zaprosił (stałe), rola, status (Nieaktywny, Aktywny, GoMagic, DiamondSchool), stan konta (oczekuje na aktywację / aktywne / dezaktywowane), profil uzupełniony (data), usunięte ze struktury (data, kto, rekomendujący w chwili usunięcia), tytuł (pin, tylko u Platyny), weryfikacja (wykonana / pominięta przez Administratora) |
| Historia ról | platynowy | Partner, rola, data, kto nadał |
| Materiał | główny | typ, minimalna rola; wersje językowe: język, tytuł, plik |
| Kontakt | główny | imię, dane kontaktowe, status (Kontakt, Klient, Partner), Partner zapraszający, ostatni Partner BOM, ostatni Partner POM dla każdego rozwiązania (np. MRA), numer Klienta Amway (u Klienta), weryfikacja (wykonana / pominięta przez Administratora), oświadczenie MRA złożone (znacznik, data, Partner) |
| Log systemowy | główny | każda operacja w aplikacji: kto, kiedy, co zrobił, na jakim obiekcie, wartość przed i po, adres IP, przeglądarka i system (nagłówek User-Agent) |
| Zgoda | główny | Kontakt, typ zgody, treść, data, kanał, wycofanie |
| Produkt / rozwiązanie | główny | nazwa, obszar (np. wellbeing), czy wymaga oświadczenia lub zgód, aktywność; katalog otwarty, np. MRA, MyBODY.ID |

Kontakty muszą być widoczne między strukturami, żeby Partner wiedział, że osoba była już na BOM u kogoś innego. Dlatego Kontakty są wspólne dla całej DMB i leżą w schemacie głównym.

## Zgody, RODO i dane zdrowotne

Aplikacja nie przechowuje danych o zdrowiu. Przed testem MRA osoba podpisuje na papierze oświadczenie o braku przeciwwskazań (stenty, rozrusznik serca, ciąża), a w aplikacji zostaje tylko znacznik.

- **Oświadczenie o braku przeciwwskazań**: podpisany dokument zachowuje Partner prowadzący test. Aplikacja zapisuje tylko znacznik „oświadczenie złożone i podpisane”, z datą, wersją formularza i Partnerem, bez odpowiedzi i bez skanu.
- **Do potwierdzenia z prawnikiem**: czy sam znacznik nie jest już traktowany jako dana o zdrowiu.
- Wyniki testu MyBODY.ID trafiają bezpośrednio do osoby, więc aplikacja ich nie przechowuje.
- Każda zgoda marketingowa musi mieć datę, kanał i treść, a osoba musi móc ją wycofać.

**Żądanie usunięcia danych**: dane osoby są nieodwracalnie anonimizowane we wszystkich miejscach (konto, Kontakty, wartości „przed i po” oraz adresy IP w logu), a zapisy logu zostają. Historia zdarzeń pozostaje, ale nie da się już ustalić, kogo dotyczyła.

Przed wdrożeniem te ustalenia warto potwierdzić z prawnikiem.

## Otwarte pytania

- [ ] Materiały dodane przez Administratora: widoczne w całej aplikacji (według minimalnej roli), czy tylko w jego dolnej linii?
- [ ] Zasięg adresatów mailingu marketingowego (Kontakty i Klienci są wspólni ponad strukturami): kogo może zapraszać Platyna, a kogo Administrator?
- [ ] Weryfikacja e-maila potwierdzeniem linkiem przed wysyłką marketingową (zgody bez weryfikacji adresu są prawnie kruche); do potwierdzenia z prawnikiem.
- [ ] Domena własna (Vercel, MailerSend: SPF/DKIM) i konfiguracja MailerSend; bez tego nie wyślemy żadnych e-maili.
- [ ] Czy numer rekomendującego Platyny ma własne pole kraju (domyślnie kraj właściciela konta)?- [ ] Kto aktywuje i dezaktywuje samą Platynę: jest korzeniem własnej organizacji, więc raczej nie może zrobić tego sobie; specyfikacja nie rozstrzyga (rekomendacja: SuperAdministrator lub Administrator w górnej linii).
- [ ] Kanał weryfikacji telefonu (SMS lub WhatsApp): wybór przy budowie, według dostępności i ceny usług.
- [ ] Z prawnikiem: znacznik oświadczenia MRA, anonimizacja przy żądaniu usunięcia danych, przechowywanie logu bez usuwania.

Wszystkie wcześniejsze pytania są rozstrzygnięte; historia decyzji jest w `docs/ustalenia-i-kontekst.md`.
