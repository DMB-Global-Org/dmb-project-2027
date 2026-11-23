# dMb Projekt 2027 – wdrożenie i środowiska

Stan na 20.11.2026. Decyzje: 77 (schematy organizacji), 83 (poczta), 84 i 89 (frontend, gałęzie, adresy).

## Środowiska i adresy

| Element | Usługa | Adres / uwagi |
| --- | --- | --- |
| Frontend | Vercel, projekt `dmb-project-2027` (Root Directory `frontend`) | https://project2027.dmbglobal.pl (stary: https://dmb-project-2027.vercel.app) |
| Backend | Render, usługa `dmb-backend` (Frankfurt, plan darmowy: usypia po ok. 15 min) | https://dmb-backend-6fxq.onrender.com |
| Baza | Supabase Postgres | pooler 6543 (aplikacja), połączenie sesyjne 5432 (migracje); tylko schematy `app` i `org_*` |
| Poczta | MailerSend, konto „dMb Global Dev” | domena `dmbglobal.pl`, nadawca `project2027@dmbglobal.pl`; plan sandbox (100 wiadomości, 10/min) |
| CI i migracje | GitHub Actions | `ci.yml`, `db-migrate.yml`; środowisko GitHub `production` trzyma sekret `DATABASE_DIRECT_URL` |

## Gałęzie

- `production`: produkcyjna. Push tu uruchamia CI, migracje produkcyjnej bazy (`db-migrate.yml`) oraz wdrożenia Rendera (po zielonym CI, `autoDeployTrigger: checksPass`) i Vercela.
- `main`: integracyjna, niczego nie wdraża (CI działa też tutaj i na każdym PR).
- Kod trafia z `main` do `production` świadomym krokiem (merge/PR). Migracja i kod nie wchodzą atomowo, więc migracje muszą być addytywne (decyzja 89).

## Zmienne środowiskowe

**Render (backend, czas działania):**

| Zmienna | Wartość / znaczenie |
| --- | --- |
| `DATABASE_URL` | pooler Supabase (6543) |
| `APP_BASE_URL` | `https://project2027.dmbglobal.pl`, bez ukośnika; z niej powstają linki w e-mailach |
| `TRUST_PROXY_HOPS` | `2` (Vercel + Render); ustawiana ręcznie w Environment, Blueprint jej nie oferuje |
| `CORS_ORIGINS`, `CORS_ORIGIN_PATTERN` | adres frontendu i wzorzec podglądów Vercela; w produkcji przeglądarka rozmawia przez rewrite, więc CORS nie jest krytyczny |
| `MAIL_DRIVER` | `mailersend` (domyślnie `console`: wiadomość tylko w logu) |
| `MAILERSEND_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | token „Sending access” tworzy właściciel i wpisuje wyłącznie w Renderze; nadawca `project2027@dmbglobal.pl` |
| `SESSION_TTL_DAYS`, `MAIL_DISPATCH_INTERVAL_MS` | opcjonalne (domyślnie 14 dni i 10 s) |

**Vercel (frontend):** `API_URL` = adres backendu na Renderze (tylko serwerowa, bez `NEXT_PUBLIC_`). Zapisuje się w rewrite `/api/graphql` w czasie budowania, więc po zmianie trzeba przebudować (redeploy bez cache). Musi być wymieniona w `turbo.json` (`env` zadania `build`), inaczej Turborepo ją odfiltruje i rewrite pójdzie na `localhost`.

**GitHub:** sekret `DATABASE_DIRECT_URL` w środowisku `production`; to środowisko ma dopuszczać gałąź `production`.

## Procedura wdrożenia

1. Zmiany wchodzą na `main` przez PR (CI zielone). Wersje w `package.json` podbija właściciel commitem „Bump version”.
2. Kiedy `main` ma być produkcją: merge/PR `main` → `production`. Wdrożenia Rendera i Vercela oraz migracje ruszają same.
3. Sprawdzić: workflow „DB migrate” zielony, Render „Live”, Vercel „Ready”, a nagłówek strony pokazuje oczekiwane `wersja [frontend] | [backend]`.
4. Test bez hasła: `curl -s -H 'content-type: application/json' -d '{"query":"{viewer{id} version}"}' https://project2027.dmbglobal.pl/api/graphql` powinno zwrócić `viewer: null` i wersję backendu.

## Pierwsze uruchomienie (jednorazowo)

1. Pierwszy SuperAdministrator: na Renderze w Shellu `SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm --filter backend create-superadmin` (idempotentne, `--reset-password` ustawia nowe hasło). Lokalnie wygodnie przez plik `backend/.env.superadmin` (poza gitem; po użyciu usunąć) i `create-superadmin:file`.
2. Schematy organizacji powstają przy rejestracji pierwszej Platyny (link rodzaju „Platyna” wystawia SuperAdministrator); ich migracje nakłada runner organizacji, a po wdrożeniach `db:migrate:all`.

## Test dymny na produkcji (ok. 10 minut)

1. Logowanie SuperAdministratora.
2. Zaproszenie Platyny z wysyłką e-maila (sandbox MailerSend dopuszcza adres konta), rejestracja z linku w oknie prywatnym, uzupełnienie profilu (SuperAdministrator dostaje e-mail „profil uzupełniony”), aktywacja przez SuperAdministratora.
3. Platyna zaprasza Partnera (link do skopiowania), Partner rejestruje się i uzupełnia profil, Platyna aktywuje i zmienia rolę.
4. Zmiana rekomendującego, mailing organizacyjny do jednej osoby, na koniec ewentualny awans do Platinum (odpięcie organizacji).
5. W DevTools ciasteczko `__Host-sid` z `HttpOnly`, `Secure`, `SameSite=Lax` (także w Safari); w audycie (`app.audit_log`) kolumna `ip` pokazuje prawdziwy adres.

## Backup i odtwarzanie (decyzja 90)

- **Kopia:** `pnpm --filter backend db:backup` zapisuje `backend/_backup/<serwer>-<port>-<ref>-<baza>_<RRRR-MM-DD>_<GG-MM-SS>.zip` (zrzut SQL schematów `app`, `drizzle`, `org_*`). Używa `DATABASE_DIRECT_URL` (5432); `--url-env=NAZWA` wskazuje inną zmienną. Folder jest w `.gitignore`.
- **Wymagania:** `pg_dump` i `psql` w wersji nie niższej niż serwer (`brew install libpq`; skrypt szuka też w `/opt/homebrew/opt/libpq/bin`), `zip` i `unzip` z systemu.
- **Odtwarzanie:** `pnpm --filter backend db:restore [plik.zip]` (bez pliku: najnowsza kopia). Skrypt pokazuje host docelowy i wymaga jego wpisania (albo `--confirm-host=HOST`), potem wczytuje całość w jednej transakcji i nadpisuje tabele z kopii. Przy wielu schematach `org_*` transakcja może przekroczyć `max_locks_per_transaction` serwera („out of shared memory”): wtedy zwiększyć ten parametr albo użyć `--no-transaction` (bez atomowości). Na produkcji tylko świadomie; próby robić na lokalnej bazie (`docker compose up -d --wait`, `--url-env=DATABASE_URL_TEST`).
- **Dane osobowe:** kopia zawiera Kontakty, zgody i log. Trzymać lokalnie, nie wysyłać i nie commitować; stare kopie usuwać.

## Znane pułapki

- **Logowanie nie działa, `/api/graphql` zwraca 404 z `DNS_HOSTNAME_RESOLVED_PRIVATE`:** frontend zbudowano bez `API_URL` (nie ustawiona, nieprzebudowana albo odfiltrowana przez Turborepo). Ustawić zmienną w Vercelu, upewnić się, że jest w `turbo.json`, zrobić redeploy.
- **Render usypia usługę** po ok. 15 minutach bez ruchu: pierwsze żądanie trwa dłużej, a wysyłka e-maili (skrzynka nadawcza) rusza dopiero po obudzeniu.
- **Zmiana domeny frontendu** unieważnia sesje (ciasteczko `__Host-sid` jest przypisane do hosta) i wymaga zmiany `APP_BASE_URL`.
- **MailerSend sandbox:** limit 100 wiadomości i 10 na minutę; błąd wysyłki widać w `app.notifications.last_error` (stan `FAILED`).
- **Skrzynka nadawcza** wysyła po 10 wiadomości co 10 s, więc duży mailing (1000 osób) dochodzi ok. 17 minut.
