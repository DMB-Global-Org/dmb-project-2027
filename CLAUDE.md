@AGENTS.md

# dMb Projekt 2027

Aplikacja webowa dla struktury DMB Global (marketing sieciowy w ramach Amway). Cele: treści edukacyjne dopasowane do roli Partnera, zarządzanie Kontaktami ze wszystkimi osobami, które zetknęły się z DMB, później e-marketing.

Właściciel produktu: Marek Kustosz. Rozmawiamy po polsku.

## Gdzie są wymagania

- `docs/specyfikacja.md`: obowiązująca specyfikacja (role, uprawnienia, konta, Kontakty, mailing, model danych, RODO). Czytaj ją przed każdą większą zmianą.
- `docs/ustalenia-i-kontekst.md`: dziennik decyzji 1–81 (które są zastąpione i dlaczego).
- `docs/funkcjonalnosci-2026-10-30.md`: zakres na termin **30.11.2026** (wersja DE obok).
- Nie zgaduj reguł biznesowych. Gdy specyfikacja milczy albo jest niejasna, zapytaj i zaproponuj dopisanie decyzji do `docs/`.

## Stos i struktura repozytorium

Monorepo pnpm + Turborepo (`pnpm-workspace.yaml`: `frontend`, `backend`), Node >= 24.

- `backend/`: NestJS 12, GraphQL (Apollo, code-first, schemat zapisywany do `backend/schema.gql`), Drizzle ORM + `postgres` (postgres.js), walidacja env przez zod (`src/config/env.ts`), testy Vitest, lint oxlint. Moduł `notes` to przykład z szablonu; można go usunąć, gdy powstaną właściwe moduły.
- `frontend/`: Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui (Base UI), zustand. Przed pisaniem kodu Next.js przeczytaj `frontend/AGENTS.md`.
- Baza: Supabase Postgres. Tabele aplikacji w schemacie `app` (`backend/src/db/schema/app.schema.ts`); nigdy nie zmieniaj schematów Supabase (`auth`, `storage` itd.).
- Uwierzytelnianie: własne, w backendzie (nie Supabase Auth; decyzja 63). E-mail: MailerSend (decyzja 67).
- Wdrożenie: backend na Render (`render.yaml`), frontend na Vercel; migracje uruchamia workflow `.github/workflows/db-migrate.yml` po pushu do `main`.

## Komendy (z katalogu głównego)

- `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`
- `pnpm db:generate` (nowa migracja z `backend/src/db/schema`), `pnpm db:migrate`, `pnpm db:check`, `pnpm db:studio`
- Pierwszy SuperAdministrator (raz po wdrożeniu, na Renderze w Shellu): `SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm --filter backend create-superadmin` (idempotentne; `--reset-password` ustawia nowe hasło).
- Tor organizacji (schematy `org_*`, decyzja 77): `pnpm --filter backend db:generate:org` (SQL z `backend/src/db/org/schema.ts` do `backend/drizzle-org/`), `pnpm --filter backend db:migrate:all` (najpierw `app`, potem każdy zarejestrowany schemat organizacji). Nigdy nie uruchamiaj `drizzle-kit migrate` z `drizzle.org.config.ts`.
- Backend osobno: `pnpm --filter backend test`, `pnpm --filter backend test:e2e`
- Testy integracyjne (prawdziwy Postgres): `docker compose up -d --wait`, potem `pnpm test:int`. Baza `dmb_test` na porcie 5434 (`DATABASE_URL_TEST`); nazwa bazy musi kończyć się na `_test`, bo testy kasują schematy. Pliki `*.int-spec.ts`.
- Zmienne: `backend/.env` (`DATABASE_URL` = pooler 6543, `DATABASE_DIRECT_URL` = 5432 dla migracji), `frontend/.env.local` (`NEXT_PUBLIC_API_URL`). Nie commituj plików `.env`.

## Słownik: pojęcia domenowe i nazwy w kodzie

Dokumentacja i interfejs używają nazw polskich, kod nazw angielskich:

| Domena (PL) | Kod (EN) | Uwagi |
| --- | --- | --- |
| Partner | `Partner` | numer Amway: ABO# / Numer PA / Geschäftspartnernummer + kraj nadania |
| Klient | `Customer` | numer Klienta Amway, Partner zapraszający |
| Kontakt | `Contact` | osoba po BOM lub POM, jeszcze nie Klient ani Partner |
| Rekomendujący | `sponsor` | przy zaproszeniu = osoba zapraszająca |
| Platyna, bezpośrednia Platyna | `Platinum`, `directPlatinum` | |
| Rola | `Role` | `GENERAL`, `FOUNDATION`, `BUILDER`, `SILVER`, `PLATINUM`, `ADMINISTRATOR`, `SUPER_ADMINISTRATOR` |
| Status | `PartnerStatus` | `INACTIVE`, `ACTIVE`, `GO_MAGIC`, `DIAMOND_SCHOOL` |
| Stan konta | `AccountState` | `PENDING_ACTIVATION`, `ACTIVE`, `DEACTIVATED`; osobny od statusu |
| Pin (tytuł) | `pinTitle` | tylko informacyjnie, wolny tekst wpisywany przez Platynę |
| BOM / POM | `BOM` / `POM` | Business / Product Opportunity Meeting |
| Produkt / rozwiązanie | `Solution` | otwarty katalog, np. MRA, MyBODY.ID |
| Zgoda | `Consent` | typ, treść, data, kanał, wycofanie |

## Reguły domenowe, których nie wolno złamać

1. **Role są liniowe**: wyższa rola obejmuje uprawnienia niższych. Nowe konto dostaje `GENERAL`. Roli Gold nie ma.
2. **Nikt nie zmienia własnej roli**; Platyna nie zmienia też własnego statusu. Rolę i status Platyny zmienia Platyna wyżej w linii, Administrator wyżej w linii albo SuperAdministrator.
3. **Macierz uprawnień** jest w `docs/specyfikacja.md` (sekcja „Uprawnienia według ról”). Każda komórka tej tabeli ma mieć test.
4. **Odpięcie organizacji platynowej**: promocja do Platinum (kto by jej nie nadał) przenosi całą organizację tej osoby do osobnego schematu PostgreSQL. Górna linia widzi potem tylko konto samej Platyny i wpis „kto i kiedy”, nigdy jej organizację.
5. **Dolna linia** (Partnera i Administratora) kończy się na granicy odpiętej organizacji platynowej. Administrator działa tylko w swojej dolnej linii.
6. **Rekomendujący** musi być w tej samej strukturze platynowej co bezpośrednia Platyna.
7. **Kontakty, zgody, katalog rozwiązań, materiały i log** są wspólne (schemat główny), a nie w schematach platynowych.
8. **Brak danych o zdrowiu**: przy MRA zapisujemy tylko znacznik „oświadczenie złożone” (data, wersja formularza, Partner). Żadnych odpowiedzi, skanów ani wyników badań.
9. **Log systemowy** zapisuje każdą operację (kto, kiedy, co, obiekt, wartość przed i po, IP, User-Agent) i nie jest kasowany. Usunięcie danych osoby = nieodwracalna anonimizacja wszędzie, także w logu.
10. **Wielojęzyczność od początku**: PL (domyślny), DE, EN; żadnych tekstów UI na sztywno w kodzie, nowy język bez zmian w kodzie.

## Schematy organizacji platynowych (decyzja 77)

Każda organizacja platynowa ma własny schemat PostgreSQL tworzony w trakcie działania aplikacji. Szczegóły w `docs/ustalenia-i-kontekst.md` (decyzja 77); w skrócie:

- Tabele organizacji definiuje fabryka (jedna definicja, zapytania kwalifikowane nazwą schematu). Nazwę schematu generuje serwer i waliduje w rejestrze Platyn, nigdy nie pochodzi od użytkownika.
- Migracje w dwóch torach: `app` przez `drizzle-kit` (`schemaFilter: ['app']`) oraz tor organizacji (osobny config, własny runner, stan w `app.org_schema_migrations`). Runner nie czyta `journal.json`.
- Promocja do Platinum to jedna transakcja (schemat, przeniesienie wierszy, katalog kont, rejestr, log).
- Zostajemy na `drizzle-orm` 0.45 i `drizzle-kit` 0.31; nie aktualizuj do wersji 1.0 bez uzgodnienia.
- Nie zastępuj schematów kolumną `tenant_id`; jeśli uważasz, że to lepsze, przedstaw argumenty i poczekaj na decyzję.

## Sposób pracy

- Przy większych zadaniach najpierw plan (tryb planowania), potem kod.
- Zmiany schematu bazy tylko przez Drizzle i `pnpm db:generate`; nie edytuj ręcznie wygenerowanych plików w `backend/drizzle/` ani `backend/drizzle-org/` (ręczny SQL, np. triggery, tylko przez `drizzle-kit generate --custom`).
- Każda reguła uprawnień i walidacji ma test w Vitest.
- Każdy resolver GraphQL jest domyślnie chroniony (globalny `AuthGuard`); publiczny wymaga jawnego `@Public()`. O tym, kto co może, decyduje wyłącznie `can()` z `backend/src/authz/` (macierz jako dane); resolvery nie sprawdzają ról ręcznie. API zwraca kody błędów (`appError`), nie teksty.
- Gdy zapada nowa decyzja biznesowa, dopisz ją do `docs/ustalenia-i-kontekst.md` (kolejny numer) i popraw `docs/specyfikacja.md`.
