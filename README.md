# Taskomania

Komanda üçün Kanban-tərzli tapşırıq izləmə sistemi. Masaüstü client (Electron + React) + cloud backend (Express + Postgres + Socket.IO).

Arxitektura qərarları üçün bax: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Qurulum (ilk dəfə)

1. **Asılılıqları quraşdır** (root qovluqdan, bütün workspace-lər üçün birdən):
   ```
   npm install
   ```

2. **Postgres**: lokal inkişaf üçün Docker ilə tez qaldıra bilərsən:
   ```
   docker run --name team-tracker-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=team_tracker -p 5433:5432 -d postgres:16
   ```
   (5433 — çünki 5432 bu maşında başqa bir layihənin Postgres konteyneri tərəfindən tutulub.)
   (Docker yoxdursa, Railway-də Postgres plugin əlavə edib oradan `DATABASE_URL`-i götürə bilərsən.)

3. **Env fayllar**: `.env.example`-ə bax, `packages/server/.env` faylı yarat və `DATABASE_URL` + `JWT_SECRET` daxil et.

4. **Shared paketi build et** (server və desktop ona bağlıdır):
   ```
   npm run build:shared
   ```

5. **Prisma**: schema-nı DB-yə tətbiq et:
   ```
   npm run prisma:generate
   npm run prisma:migrate
   ```

## İşə salmaq (development)

İki ayrı terminalda:

```
npm run dev:server     # backend, http://localhost:4000, /health endpoint yoxlanıla bilər
```

```
npm run dev:desktop    # Electron pəncərəsi açılır, Vite dev server ilə
```

Desktop app açılanda backend-ə qoşulub-qoşulmadığını ekranda göstərəcək ("Backend qoşulub..." mesajı).

Claude Code bunu sənin adından işə salıb ekran görüntüsü ilə yoxlamaq istəyəndə `.claude/skills/run-desktop/` skilindən istifadə edir (Windows-a xas `ELECTRON_RUN_AS_NODE` problemi və PowerShell screenshot addımları orada sənədləşdirilib).

## Hazırkı vəziyyət

Bu, layihənin skeletidir (Milestone 0): monorepo strukturu, Prisma data modeli, minimal Express server (`/health`) və minimal Electron+React shell hazırdır və bir-biri ilə əlaqəni test etmək mümkündür. Auth, task CRUD, Kanban board və real-time hələ tətbiq edilməyib — növbəti addımlar `docs/ARCHITECTURE.md`-dəki Milestone 1-7 ardıcıllığı ilə davam edəcək.
