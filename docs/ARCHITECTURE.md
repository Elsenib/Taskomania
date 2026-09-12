# Arxitektura

Tətbiqin adı: **Taskomania** (əvvəlki iş adı "Team Tracker" idi — kod bazasında qalan `team-tracker` npm workspace paket adları/Docker konteyner adı kimi daxili texniki identifikatorlar dəyişməyib, yalnız istifadəçiyə görünən adlar yeniləndi).

Tam plan: `C:\Users\Elşen İ\.claude\plans\adaptive-discovering-swing.md` (bu sessiyada yaradılıb, layihə tarixçəsi üçün saxlanılır).

## Qısa xülasə

- **Monorepo**: npm workspaces — `packages/shared`, `packages/server`, `packages/desktop`.
- **Backend**: Express + Prisma + PostgreSQL, JWT auth, Socket.IO real-time (REST = yazma yolu, socket = bildiriş yolu).
- **Client**: Electron + React (Vite), React Query (server state) + Zustand (UI state), `@dnd-kit/core` (Kanban drag-and-drop).
- **Hosting**: Railway (server + Postgres plugin). Desktop: electron-builder, imzalanmamış Windows installer.

## Data modeli

`Team → User (role: ADMIN/MEMBER) → Task (columnId, assigneeId, priority, dueDate) → Comment`, `Column` team-ə aid sıralı statuslar, `Invite` komandaya qoşulma kodu.
Tam sxem: `packages/server/prisma/schema.prisma`.

## Milestone-lar

1. Backend skeleti + auth endpoint-ləri + Railway deploy
2. Task/Comment CRUD API
3. Electron shell + auth UI
4. Kanban board (real-time olmadan) — ilk işlək versiya
5. Şərhlər UI
6. Real-time layer (Socket.IO)
7. Cilalama + installer paketləmə

## Hazırkı vəziyyət

- ✅ Milestone 0 — skelet (monorepo, Prisma schema, minimal server/desktop shell)
- ✅ Milestone 1 — auth: register/login/join/me, JWT middleware, invite sistemi (uçdan-uca test edilib)
- ✅ Milestone 2 — Task/Comment CRUD API, komandalar arası təcrid təsdiqlənib (uçdan-uca test edilib)
- ✅ Milestone 3 — Electron shell + auth UI (login/team yaratma/qoşulma, real UI klikləri ilə test edilib)
- ✅ Milestone 4 — Kanban board: yaratma, redaktə/silmə, sürüklə-burax (real UI ilə test edilib — bax Gotchas)
- ✅ Milestone 5 — Şərhlər UI (task modalı daxilində, real UI ilə test edilib)
- ✅ Milestone 6 — Real-time layer: Socket.IO, iki müstəqil pəncərə ilə test edilib (tapşırıq yaratma və sürükləmə hər ikisi ani sinxronlaşır)
- 🔶 Milestone 7 — Cilalama (loading/error/boş state-lər tamamlandı; **installer paketləmə şüurlu şəkildə təxirə salınıb** — daha çox funksionallıq gələcək)
- ✅ Tapşırıqlara fayl/layihə əlavəsi + vizual önizləmə (bax aşağı, ayrıca bölmə) — backend uçdan-uca script ilə, client real UI-da (şəkil önizləməsi) test edilib
- ✅ Qraf vizualizasiyası (tapşırıq/üzv/fayl/asılılıq node-ları) — bax aşağı, ayrıca bölmə — backend script ilə, client real UI-da tam test edilib (asılılıq yaratma → qrafda qırmızı istiqamətli ox, node-a klik → tapşırıq modalı)
- ✅ Dəvət kodu UI-si (`components/InviteModal.tsx`) — Milestone 1-də backend endpoint-i hazır idi, amma klient tərəfində düymə/modal heç vaxt qurulmamışdı (yalnız API script ilə test edilmişdi). İndi header-də "Dəvət et" (yalnız ADMIN) → kod yaradır, kopyala düyməsi ilə. Real UI-da test edilib.
- ✅ "Take" sütunu — To Do ilə In Progress arasında, "Götür" düyməsi ilə özünə təyin edib sütunu dəyişən funksional addım (sadə sürükləmədən fərqli). "+ Tapşırıq əlavə et" yalnız birinci sütunda göstərilir. Scrollbar-lar minimalist (`.thin-scroll`/`.dark-scroll`).
- ✅ Figma-tərzi dizayn kanvası (`canvas/DesignCanvas.tsx`) — bax aşağı, ayrıca bölmə — real UI-da test edilib (pan/zoom, şəkil+HTML frame-lər, HTML thumbnail ölçü düzəlişi).
- ✅ Desktop bildirişləri + tray + axtarış — bax aşağı, ayrıca bölmə — tray/hide-on-close/restore real UI-da test edilib, axtarış filtri real UI-da test edilib.
- ✅ Windows installer (NSIS) + brend loqosu — bax aşağı, ayrıca bölmə — `electron-builder` ilə build edilib, çıxan `.exe` işə salınıb (quraşdırma sehirbazı real UI-da yoxlanılıb: header/sidebar bitmap-ları, ikon), app icon əsl loqoya keçirilib.
- ✅ Fullscreen + OS-a görə dark mode + power menu — bax aşağı, ayrıca bölmə — paketlənmiş production build-də CDP ilə dəqiq yoxlanılıb (DPI gotcha-sı aşkarlanıb düzəldilib, bax aşağı).
- ✅ Sütunları sürüşdürərək yenidən sıralama (admin-only) — bax aşağı, ayrıca bölmə — real UI-da sürüklə-burax ilə test edilib, reload-dan sonra sıralamanın saxlandığı təsdiqlənib.
- ✅ **Production deploy (Railway)** — backend + Postgres `trustworthy-benevolence` layihəsində, `https://taskomania-production.up.railway.app`. Paketlənmiş masaüstü tətbiq bu URL-ə bağlanacaq şəkildə build olunub (`.env.production`) və uçdan-uca canlı backend-ə qarşı test edilib (qeydiyyat → JWT → lövhə yüklənməsi, konsol təmiz). Bax aşağı, "Deploy" bölməsi.

Lokal dev DB: Docker konteyneri `team-tracker-db`, port **5433** (5432 bu maşında başqa layihə tərəfindən tutulub).

## Dizayn dili

Palitra və tipoqrafiya `packages/desktop/src/renderer/index.css`-də CSS custom property kimi təyin olunub (`--ink`, `--paper`, `--accent` və s.) — **macOS-referanslı** dizayn: `-apple-system`/SF Pro font stack-i (Windows-da Segoe UI-ə fallback edir), sistem mavisi aksent (#007aff), seqmentli tab-lar (macOS Settings tərzi), yumşaq kölgəli rounded-corner kartlar (10-14px radius), qutulu (boxed) input-lar açıq boz fonla. Prioritet göstəricisi pill badge yox, macOS Reminders tərzi rəngli nöqtə (yaşıl/narıncı/qırmızı — sistem rəngləri, qızıl/amber ton yoxdur).

Tarix formatlaşdırma: `renderer/lib/formatDate.ts` əl ilə Azərbaycan ay qısaltmalarını istifadə edir — Chromium-un `az-AZ` `Intl` locale-data-sı qısa ay adlarını düzgün vermir (məs. "sentyabr" əvəzinə "M09" çıxır), ona görə `toLocaleDateString` əvəzinə bu köməkçi funksiyalar istifadə olunur.

## Milestone 7 qeydləri

- **Loading/error state-lər**: Board (sütun/tapşırıq yüklənməsi uğursuz olanda "Yenidən cəhd et" düyməsi), TaskDetailModal (saxla/sil xətaları), CommentThread (yükləmə/göndərmə xətaları) — hamısı `.form-error` stilində göstərilir.
- **Boş vəziyyət**: sütunda tapşırıq yoxdursa "Tapşırıq yoxdur" mətni (əvvəllər sadəcə boş görünürdü).
- **Sessiya bitmə**: `api/client.ts`-də `setUnauthorizedHandler` — real 401 (token etibarsız/bitib) gələndə avtomatik logout + "Sessiyanın vaxtı bitib" bannerı login ekranında.
- **Bağlantı xətası ≠ sessiya bitməsi (mühüm düzəliş)**: əvvəlcə `/auth/me` yoxlaması hər hansı xəta zamanı (backend əlçatmaz olsa belə) tokeni silib istifadəçini login ekranına atırdı. İndi yalnız əsl 401 tokeni silir; şəbəkə/server xətasında token saxlanılır və ayrıca "Backend-ə qoşulmaq alınmadı, Yenidən cəhd et" ekranı göstərilir (`AuthContext.tsx`-də `connectionError` + `retryConnection`).

## Tapşırıqlara fayl/layihə əlavəsi

Tam plan: `.claude/plans/adaptive-discovering-swing.md` (fayl-əlavəsi tapşırığı üçün versiya). Qısaca:

- **Data**: `Attachment` modeli (`kind`: FILE/ARCHIVE, `accessToken`) — `packages/server/prisma/schema.prisma`.
- **Saxlama**: `packages/server/uploads/<attachmentId>/` (diskdə, gitignore-da). **Production**: Railway-ə deploy edərkən bu qovluq üçün **Railway Volume** qoşulmalıdır, əks halda hər redeploy-da yüklənmiş fayllar itir. Kod dəyişikliyi tələb etmir, sadəcə Railway dashboard-da servisə volume mount etmək kifayətdir.
- **Önizləmə auth-u**: content-serving GET route-ları (`/api/v1/attachments/:id/:token/content/*`, `/tree`) JWT header yox, `accessToken`-i URL path-ində istifadə edir — səbəb: iframe/img/nested-asset sorğuları header daşıya bilmir, path-based token isə HTML-in öz daxilindəki nisbi istinadları (`<link href="style.css">`) avtomatik düzgün URL-ə yönləndirir. Ətraflı izah: `packages/server/src/routes/attachments.routes.ts`-in başındakı şərh.
- **HTML sandbox**: `<iframe sandbox="allow-scripts" ...>` — `allow-same-origin` YOXDUR (bax `FilePreview.tsx`), naməlum mənbədən HTML-i təhlükəsiz render etmək üçün.
- **Önizləmə növləri**: HTML (iframe), şəkil (`<img>`), Markdown (`react-markdown`, xam HTML render etmir), kod (`react-syntax-highlighter`), digər → "Sistemdə aç".

## Qraf vizualizasiyası

Tam plan: `.claude/plans/adaptive-discovering-swing.md` (qraf tapşırığı üçün versiya). Qısaca:

- **Data**: `TaskDependency` modeli (`blockingTaskId` → `blockedTaskId`, "bloklayır/asılıdır" cütü) — özünə-bağlanma və əks-cüt (A↔B iki istiqamətdə) servis səviyyəsində rədd edilir. Dərin tsikl aşkarlama yoxdur (kiçik komanda aləti, vizual olaraq görünəcək).
- **API**: `GET /api/v1/teams/:teamId/graph` — tək aqreqasiya endpoint-i (`{tasks, members, attachments, dependencies, columns}`), qraf bunu bir dəfəyə çəkir.
- **Render**: `react-force-graph-2d` (canvas, d3-force fizika). Node rəngləri canvas-da çəkildiyi üçün CSS custom property oxuya bilmir — `GraphView.tsx`-in başında `index.css`-lə sync saxlanmalı literal hex sabitlər var (`INK`, `MUTED`, `ACCENT` və s.).
- **Node/xətt növləri**: tapşırıq (sütun rənginə görə, golden-angle HSL paylanması — istənilən sayda sütun üçün avtomatik fərqli rənglər), üzv (mavi, daha böyük — hub node), fayl (boz, kiçik). Xətlər: təyinat (nazik neytral), asılılıq (qırmızı, istiqamətli ox), fayl (kəsik xətt).
- **Redaktə vs vizuallaşdırma**: qrafın özü READ-ONLY vizuallaşdırma səthidir — node-a klik `TaskDetailModal`-ı açır (board-da istifadə olunan eyni komponent), asılılıq yaratma/silmə isə modal daxilindəki "Asılılıqlar" bölməsi ilə olur (qrafda birbaşa sürükləyib xətt çəkmək yoxdur, v1 üçün şüurlu sadələşdirmə).
- **Yerləşmə**: `App.tsx`-də `viewMode` state-i ilə tam-ekran keçid ("Qraf" düyməsi header-də) — Board və GraphView eyni pəncərədə, ayrı-ayrı tam görünüşlərdir (hərfi ikinci OS pəncərəsi yox).
- **Tema — "bilik qrafı explorer" üslubu**: istifadəçinin verdiyi bir istinad şəklinə (kod-asılılıq qrafı vizual alət) əsasən quruldu — tünd analitik fon (`#0a0e14`), kiçik düz rəngli nöqtə node-lar (glow/parıltı yoxdur, sadə və təmiz), incə şəffaf xətlər, sağda `GraphLegend.tsx` paneli ("QRUPLAR" başlığı, "Hamısını seç" + hər qrup üçün checkbox/say — sütun/status, "Komanda üzvləri", "Fayllar"; checkbox söndürüləndə həmin qrupun node-ları qrafdan filtrlənir).
- **Klik-ilə-fokuslama**: node-a klik onu seçir — bağlı node/xətlər tam parlaqlıqda, qalanı ~12% opacity-yə solğunlaşır (`focus` state-i, `neighborIds`/`connectedLinks` hesablanması). Seçilmiş node üçün canvas altında üzən kiçik kart görünür (ad + tapşırıq üçün "Aç" düyməsi). Boş sahəyə klik seçimi təmizləyir.
- **Rənglər** (`BG`, `TEXT`, `MUTED`, `MEMBER_COLOR`, `ATTACHMENT_COLOR`, `DEP_RED`) `GraphView.tsx`-in başında literal hex sabitlərdir — canvas CSS custom property oxuya bilmədiyi üçün `index.css`-in işıqlı palitrasından asılı deyil, bu ekran öz tünd temasını daşıyır.
- **Gotcha — flex + canvas eni**: canvas konteynerinə (`containerRef`) `minWidth: 0` verilməlidir, əks halda flexbox-un default `min-width: auto` davranışı ForceGraph2D-in explicit `width={size.width}`-ə malik canvas-ını konteynerin kiçilməsinə mane olur, nəticədə sağdakı `GraphLegend` sətirdən kənara itələnib görünməz olur (üfüqi scrollbar əlaməti ilə tanınır).

## Figma-tərzi dizayn kanvası

"Figma sistemi" tələbi dəqiqləşdirildikdən sonra (tam kollaborativ redaktə YOX, **read-only önizləmə/naviqasiya kanvası**) tətbiq olundu:

- **`canvas/DesignCanvas.tsx`**: tapşırığın "dizayn faylları" (şəkil + HTML, `lib/fileKind.ts`-dəki `isDesignFile`) sərbəst pan/zoom kanvasda "frame" kimi göstərilir — hər birinin üstündə fayl adı, kart üzərinə klik tam önizləməni açır (`AttachmentPreviewModal`, mövcud komponent). Pan: boş sahədə pointer-down+move (kart üzərində deyil). Zoom: native (passive:false) `wheel` listener, kursora doğru zoom riyaziyyatı. "Uyğunlaşdır" düyməsi view-i sıfırlayır.
- **Açılış**: `task/AttachmentPanel.tsx`-də dizayn faylı varsa görünən "Kanvasda bax" düyməsi.
- **HTML frame thumbnail-ları — ölçü gotcha-sı** (istifadəçi tərəfindən bildirilib: "svgler tam gorsenir html fayli kicikdi"): sadə `<iframe style="width:100%;height:220">` HTML faylın öz native viewport-unda render olunur və konteyner kiçik olduğu üçün səhifənin yalnız yuxarı-sol künc hissəsini "kəsib" göstərir (şəkillərdə isə bu problem yoxdur, `<img>` təbii olaraq bütöv miniatürləşir). Həll `HtmlFrameThumbnail` komponentində: iframe-i əsl desktop ölçüsündə (1280×800) render et, `overflow:hidden` klip konteynerə yerləşdir, sonra bütün iframe-ə `transform: scale(FRAME_WIDTH/1280)` + `transformOrigin: "top left"` tətbiq et — nəticədə səhifənin **tam** miniatürü mütənasib şəkildə görünür (standart səhifə-thumbnail texnikası), kəsilmə deyil kiçilmə olur.

## Desktop bildirişləri + tray + axtarış

- **Tray + arxa-planda diri qalma** (`main/main.ts`): pəncərənin "X" düyməsi artıq tətbiqi bağlamır — `close` event-i `preventDefault` edir və pəncərəni gizlədir (`win.hide()`), proses tray-də davam edir ki, Socket.IO bağlantısı açıq qalsın və bildirişlər arxa planda da gəlsin. Əsl çıxış yalnız tray menyusunun "Çıx" düyməsi (`isQuitting` bayrağı + `app.quit()`) və ya OS-un tətbiqi bağlaması ilə olur. Tray ikonuna klik/"Göstər" pəncərəni geri göstərir və fokuslayır. `app.setAppUserModelId(...)` Windows-un bildirişi "Electron" yox, "Taskomania" kimi qruplaşdırması üçündür.
- **İkon**: `packages/desktop/build/icon.png` — istifadəçinin verdiyi əsl "Taskomania" loqosundan (`taskomania.png`, layihə kökündə) kəsilib hazırlanıb: loqo həm nişanı (3 nəfər + tik işarəsi, tünd-göy dairəvi-küncli kvadrat fonda) həm də altında "Taskomania" söz-nişanını ehtiva edir — 16-32px ölçüdə mətn oxunmaz olacağı üçün yalnız nişan hissəsi kəsilib (mətndən əvvəlki dərinlik sərhədi), kvadrat kanvasa mərkəzləşdirilib. Kəsmə sərhədləri düz düzbucaqlı olduğu üçün loqonun öz künc-yumşaltması (rounded corners) kəsmənin öz künclərinə düşüb ağ artefakt yaradırdı — həll: kəsilmiş görüntünün yalnız yuxarı zolağında (künc-yumşaltmanın yaşadığı yer) demək olar ağ piksellər tünd-göy fon rənginə (`RGB(10,20,55)`, loqodan nümunə götürülüb) çevrilir, aşağı kənar isə loqonun öz düz (kəsilməmiş) daxili sahəsindən keçdiyi üçün təmizləməyə ehtiyac yoxdur. `build/icon.ico` bu PNG-dən çoxölçülü (16-256px, PNG-in-ICO) formatda proqramla yaradılıb (`scratchpad/gen-ico.ps1`, ICO konteynerini əldən yazır). Eyni fayl `renderer/assets/notification-icon.png` kimi köçürülüb ki, bildiriş toast-ları da eyni ikonu daşısın.
- **Windows installer** (`packages/desktop/package.json`-də `build` sahəsi, `electron-builder`): NSIS, "assisted" rejim (`oneClick:false`, qovşaq seçmə icazəli). `installerSidebar`/`uninstallerSidebar` (164×314 BMP) və `installerHeader.bmp` (150×57) `beyin.png`-dən kəsilib (`scratchpad/gen-installer-bmp.ps1`) — electron-builder bunları `build/` qovluğunda ad konvensiyası ilə **özü aşkarlayır**, əlavə NSIS skripti/`include` lazım deyil (əvvəlcə `customHeader` makrosu ilə əl ilə cəhd edilmişdi, "artıq təyin olunub" xətası verdi, çünki electron-builder onsuz da avtomatik təyin edirdi — dərs: əvvəlcə ad-konvensiyalı avtomatik aşkarlamanı yoxla, sonra əl ilə NSIS makro yaz). `electronVersion` build sahəsində əl ilə sabitlənib (`"32.3.3"`) — npm workspace-lərdə `electron` paketi kök `node_modules`-a hoist olunduğu üçün electron-builder onu `packages/desktop/node_modules`-da tapa bilmir və versiyanı `package.json`-dakı `^32.1.2` aralığından təyin edə bilmir (`Cannot compute electron version` xətası) — sabit versiya bu problemi keçir. Çıxış: `packages/desktop/release/Taskomania-Setup-<version>.exe` (imzalanmamış — SmartScreen xəbərdarlıq göstərəcək).
- **Bildiriş mexanizmi** (`renderer/lib/notify.ts`): sadə web `Notification` API-si — Electron bunu birbaşa OS-un bildiriş mərkəzinə (Windows Action Center) yönləndirir, əlavə main-process kodu tələb olunmur, pəncərə minimize/tray-ə gizlənmiş olsa belə işləyir (renderer prosesi diri olduğu müddətcə). Bildirişə klik `window.teamTracker.focusWindow()` (preload → `ipcRenderer.send("focus-window")` → main-də `mainWindow.show()+focus()`) çağırır ki, pəncərə önə çıxsın.
- **Nə vaxt bildiriş göstərilir** (`hooks/useRealtimeSync.ts`): (1) tapşırıq sənə təyin olunanda (yeni yaradılanda birbaşa, ya da mövcud tapşırığın `assigneeId`-si dəyişəndə), (2) sənə təyin olunmuş və ya sənin yaratdığın tapşırığa yeni şərh yazılanda (öz şərhin xaric).
- **Özünə-bildiriş problemi**: `task:updated` broadcast-ında kim etdiyi (actor) məlumatı yoxdur, ona görə "Götür" düyməsi ilə özünə təyin etmə öz bildirişini özünə göstərməməlidir. Həll: `hooks/useTasks.ts`-də modul-səviyyəli `recentlyMutatedByMe` Map-i — `useUpdateTask`-ın `mutationFn`-i çağırılan kimi (server cavabından/socket echo-dan əvvəl) taskId-ni qeyd edir, `useRealtimeSync` bu qeydi 4 saniyəlik pəncərədə yoxlayıb öz mutasiyasının əks-sədasını sussuzlaşdırır. Tapşırıq yaratma zamanı bu problem yoxdur — sadəcə `task.createdById !== currentUserId` yoxlanılır (əgər özün yaradıb özünə təyin etmisənsə, bildiriş göstərilmir).
- **Axtarış** (`board/Board.tsx`): sütunların üstündə sadə mətn input-u, lokal (client-side) filtr — başlıq, təyin olunan şəxsin adı, prioritet (Azərbaycanca etiket: Aşağı/Orta/Yüksək) üzrə uyğunluq. Server sorğusu yoxdur, mövcud React Query keşi üzərində işləyir, komanda ölçüsü üçün kifayət qədər ucuzdur.

## Deploy (Railway) + paketlənmiş tətbiq gotcha-ları

- **Railway npm-workspace monorepo-da başlanğıc əmri tapa bilmir.** Railpack/Nixpacks kök qovluqdan build edəndə `workspaces` sahəsini görür, amma hansı paketi işə salacağını bilmir ("No start command detected"). Həll: kök `railway.json`-da açıq `buildCommand`/`startCommand` (`npm run build:shared && npm run build:server`, `npm run start` — kök `package.json`-da bu adlar `--workspace=` ilə düzgün paketə yönləndirir). `packages/server/railway.json` (əvvəlki, tək-paket fərziyyəli versiya) silinib — servis kökdən build olunduğu üçün oxunmurdu.
- **`electron` paketi npm workspace-də kök `node_modules`-a hoist olunur** — electron-builder onu `packages/desktop/node_modules`-da axtarır, tapa bilməyəndə versiyanı `package.json`-dakı `^32.1.2` aralığından hesablaya bilmir ("Cannot compute electron version"). Həll: `build.electronVersion`-u faktiki quraşdırılmış versiyaya (`node -e "require('electron/package.json').version"`) əl ilə sabitləmək.
- **Prisma production migrasiyası**: `prisma migrate dev` interaktiv/dev-only-dur, production-da istifadə edilməməlidir. `packages/server/package.json`-a ayrıca `prisma:deploy` (`prisma migrate deploy`) əlavə olunub, start əmrindən əvvəl işə düşür. `postinstall: prisma generate` isə Prisma Client-in hər `npm install`-dan sonra avtomatik generasiya olunmasını təmin edir (npm workspaces bunu hər paket üçün ayrıca icra edir).
- **Railway Postgres plugin ilə eyni layihədəki servis arasında bağlantı**: `DATABASE_URL` dəyişəni servis üzərində əl ilə (Railway CLI: `railway variables --set "DATABASE_URL=${{Postgres.DATABASE_URL}}"`) `${{<PluginServisAdı>.DATABASE_URL}}` referansı ilə qoyulur — bu daxili şəbəkə ünvanına (`*.railway.internal`) işarə edir, tez və pulsuzdur.
- **Paketlənmiş (installer ilə quraşdırılan) tətbiq ağ ekran verirdi — dev rejimində heç vaxt görünməyən iki bug, çünki bütün əvvəlki UI testləri Vite dev server (`localhost:5173`) üzərindən idi, `file://` yükləmə yolu (`win.loadFile`, yalnız `npm run package`-dən sonra aktivləşir) heç vaxt sınanmamışdı:**
  1. Vite-in defolt `base: "/"` seçimi asset URL-lərini kök-nisbi (`/assets/...`) yazır — bu, HTTP server kökündə işləyir, amma `file://.../index.html` açılanda brauzer bunu fayl sisteminin KÖKÜNƏ nisbətən oxumağa çalışır (`ERR_FILE_NOT_FOUND`), nəticədə React heç vaxt mount olmur, ağ ekran. Həll: `vite.config.ts`-də `base: "./"` (nisbi yollar, index.html-in öz qovluğuna nisbətən düzgün işləyir istər dev server-də, istər `file://`-də).
  2. `main.ts`-də tray/pəncərə ikonu üçün istifadə olunan `build/icon.png` electron-builder-in `files` siyahısında yox idi — yalnız installer-in ÖZÜ üçün (NSIS ikonu/sidebar) istifadə olunurdu, tətbiqin işləyən resurslarına (`app.asar`) daxil edilmirdi. Nəticədə paketlənmiş `.exe`-də `nativeImage.createFromPath` mövcud olmayan yola işarə edir, `new Tray(...)` səssizcə istisna atır, tətbiq heç bir xəta jurnalı/pəncərə göstərmədən dərhal bağlanırdı (exit code 0 — Application Error log-unda da görünmür, çünki bu "təmiz" çıxışdır, çökmə deyil). Həll: `"files"` siyahısına `"build/icon.png"` əlavə edildi.
  - **Diaqnostika qeydi**: bu iki bug-ı tapmaq üçün paketlənmiş `.exe`-ni bu mühitdən (Claude Code-un öz prosesindən) birbaşa işə salmaq özü əlavə bir tələ idi — `ELECTRON_RUN_AS_NODE` mirası (bax aşağı) səbəbindən ilk bir neçə cəhd tətbiqi sadəcə Node CLI kimi işə salıb "bad option" xətası ilə dərhal bağladı, əsl problemi maskalayaraq. `env -u ELECTRON_RUN_AS_NODE` ilə düzgün işə salmaq (Bash-da) və ya `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell-da) mütləqdir.

## Fullscreen, dark mode, power menu

- **Fullscreen, no native chrome**: `main.ts`-də `fullscreen: !isDev` (yalnız production-da — dev-də DevTools ilə toqquşur, bax aşağı) + `autoHideMenuBar: true` + `Menu.setApplicationMenu(null)` (defolt "File Edit View Window Help" menyusu tamam silinib). Nəticədə bağlamaq üçün heç bir native düymə qalmır — ona görə tətbiqin öz **power menu**-su (`components/PowerMenu.tsx`, sağ-yuxarı künc, hər ekranda — video, auth, board — sabit görünür) yeganə yoldur: "Yuxu rejimi" (`teamTracker.sleepApp()` → `mainWindow.hide()`, tray-ə gizlənmə ilə eyni) və "Söndür" (`teamTracker.shutdownApp()` → `isQuitting=true; app.quit()`, tray-in "Çıx"-ı ilə eyni).
- **Dark mode — OS-a görə avtomatik, toggle yoxdur**: `index.css`-də `@media (prefers-color-scheme: dark)` bloku bütün `:root` CSS custom property-lərini yenidən təyin edir (Chromium bunu birbaşa Windows-un tema seçimindən oxuyur, IPC/`nativeTheme` lazım deyil). Dizayn strukturu (layout, komponentlər) toxunulmaz qalır — yalnız rənglər. Palitra `startup-animation.mp4`-dən piksel-nümunə ilə götürülüb (fon `#0a1628`, aksent cyan `#24e2fb`), prioritet rəngləri Apple-ın öz dark-mode sistem rəng düzəlişləridir (`#32d74b`/`#ff9f0a`/`#ff453a` — light-mode-dan daha parlaq, tünd fonda kontrast üçün).
- **Gotcha — `Menu.setApplicationMenu(null)` klaviatura qısayollarını da silir.** Defolt menyu yalnız vizual bar deyil, `Ctrl+Shift+I` (DevTools), `Ctrl+R` və s. üçün accelerator-ları da daşıyır — menyunu tam siləndə bunlar da yox olur. `win.webContents.openDevTools()` (kod ilə, menyudan asılı olmayan) yenə işləyir, AMMA...
- **Gotcha — `fullscreen: true` production-da DevTools pəncərəsini gizlədir.** Windows-da exclusive fullscreen pəncərə hər şeyin üstündə qalır, ayrıca DevTools pəncərəsi (undocked) görünmür. Həll: `fullscreen: !isDev` — dev-də normal pəncərəli rejim (DevTools əlçatan), yalnız production build-də tam ekran.
- **Gotcha — DPI-scaled ekranda ekran görüntüsü səhv diaqnoza apara bilər (mühüm).** Fullscreen pəncərəni PowerShell skripti ilə yoxlayanda power menu düyməsi "görünmürdü" — CDP (`--remote-debugging-port`) ilə birbaşa yoxlanılanda elementin mövqeyi/rəngi/görünürlüyü tam DÜZGÜN idi. Səbəb: `[System.Windows.Forms.Screen]::PrimaryScreen.Bounds` DPI-farkında olmayan prosesdə **fiziki deyil, virtuallaşdırılmış (miqyaslanmış) ölçünü** qaytarır (125% miqyasda 1920×1080 real ekran 1536×864 kimi görünür), və `CopyFromScreen` yalnız bu virtuallaşdırılmış sahəni tutur — sağ/alt kənara yaxın məzmun (bizim güc düyməsi kimi) kəsilib. `SetProcessDPIAware()` (klik qaydası ilə eyni — SKILL.md-yə bax) ekran görüntüsü çəkməzdən əvvəl çağırılanda problem yox oldu; `force-device-scale-factor=1` kimi "düzəliş" əslində lazımsız idi və real istifadəçidə UI-ni fiziki kiçildərdi (səhv diaqnoza əsaslanan, geri qaytarılmış cəhd).
- **CDP remote debugging fullscreen-də DevTools əvəzedicisi kimi**: `Taskomania.exe --remote-debugging-port=<port>` ilə işə sal, `http://localhost:<port>/json` siyahısından düzgün `webSocketDebuggerUrl`-i tap (**diqqət**: sistemdə başqa proses eyni portu tuta bilər — nəticədə gələn `title` sahəsini yoxla, "Taskomania" olmalıdır), sonra WebSocket üzərindən `Runtime.evaluate` göndər (Node 22+-da built-in `WebSocket` kifayətdir, əlavə paket lazım deyil).

## Kanban iş axını — sütun iyerarxiyası, hərəkət qaydaları, tarixçə (Faza 1)

Tam plan: `C:\Users\Elşen İ\.claude\plans\taskomania-kanban-workflow.md` (Faza 1-3 + təxirə salınan
multi-team qeydi). Qısaca:

- **Sütun iyerarxiyası**: `Column.type` (`ColumnType` enum: TODO/TAKE/IN_PROGRESS/TESTING/DONE/FAIL/CUSTOM)
  + `Column.parentId` (öz-özünə əlaqə) — Testing, In Progress-in; Fail, Done-un alt-sütunudur. Yeni
  komanda seed-i (`auth.service.ts`) bu tam iyerarxiyanı yaradır: To Do→Take→In Progress(+Testing)→
  Done(+Fail). Mövcud (miqrasiyadan əvvəlki) komandalar üçün `prisma/backfill-columns.ts` bir dəfəlik
  skripti (`npx tsx prisma/backfill-columns.ts`) adına görə `type` təyin edib çatışmayan Take/Testing/
  Fail sütunlarını əlavə edir (idempotent). Sütun yaratma/sıralama route-ları (`teams.routes.ts`)
  yalnız üst-səviyyə (`parentId: null`) sütunlarla işləyir — alt-sütunlar öz valideynlərinin daxilində
  ayrıca sıra nömrələnməsinə malikdir, sıralamaya qarışmır.
- **Hərəkət qaydaları** (`task.service.ts`, `assertMoveAllowed`): MEMBER yalnız öz üzərinə götürdüyü
  taskı bir addım irəli apara bilər (To Do/Fail→Take özünə-təyinatla, Take→In Progress, In Progress→
  Testing) — bundan artığı (Done/Fail-ə toxunma, geri addım, CUSTOM sütunlar) ADMIN-only. Tapşırıq
  yaratma da MEMBER üçün yalnız To Do sütунuna məhdudlaşdırılıb (admin sərbəstdir).
- **Tarixçə**: `TaskActivity` cədvəli hər uğurlu sütun-dəyişikliyini (`userId, fromColumnId, toColumnId,
  createdAt`) qeyd edir — `GET /tasks/:taskId/activity`, `TaskActivityTimeline.tsx` (tapşırıq popup-unda,
  "Götürüldü"/"Progressə keçdi" və s. sətirlər, `formatShortDateTime` ilə).
- **Frontend**: `Board.tsx`/`Column.tsx` sütunları valideyn/uşaq qruplaşdırır — uşaq sütun (Testing/Fail)
  valideynin kartı daxilində ayrıca, öz `useDroppable` hədəfinə malik nested lövhə kimi göstərilir (real
  UI-da sürüklə-burax ilə test edilib — kart birbaşa nested Testing lövhəsinə düşüb dərhal yenilənib).
  "Götür" düyməsi iki fərqli hərəkətə bağlanıb: To Do-dan özünə-təyinat+köçürmə, Fail-dən (admin artıq
  təyin etdiyi şəxs üçün) sadəcə köçürmə.
- **Şifrə göz ikonu**: `components/PasswordInput.tsx` (öz SVG-si, əlavə paket yoxdur) — Login/CreateTeam/
  JoinTeam ekranlarında tətbiq olunub, real UI-da test edilib (şifrəni göstər/gizlət işləyir).
- **In Progress → Testing keçidi təsdiq tələb edir.** Sadə sürüklə-burax istifadəçinin işi bitirmədən
  səhvən/tələsik Testing-ə atmasına yol açırdı (admin sonra geri qaytarmalı olurdu — hər iki tərəf üçün
  itirilmiş vaxt). Həll: `SendToTestingModal.tsx` məcburi qısa qeyd tələb edir ("Nə etdiniz?"), bu qeyd
  adi şərh kimi (`useCreateComment`) əlavə olunur, YALNIZ bundan sonra sütun köçürülür. Ayrıca "göndər"
  düyməsi YOXDUR — sürüklə-burax özü bu qapını tətbiq edir: `Board.tsx`-də `needsTestingConfirmation()`
  `handleDragEnd`-in içində tutulur (öz tapşırığın, In Progress-dən Testing-ə) və birbaşa `updateTask`
  çağırmaq əvəzinə modalı açır (`openSendToTesting`) — istifadəçi kartı Testing-ə buraxanda, əgər
  qeyd yazıb təsdiqləməsə, tapşırıq faktiki köçmür (məlumat dəyişmədiyi üçün kart öz yerinə "geri
  düşür"). Admin/digər keçidlər üçün sürüklə-burax adi qaydada birbaşa işləyir. Real UI-da tam test
  edilib (Tarixçə + Şərhlər bölmələrində düzgün göründüyü təsdiqlənib).
- **Gotcha — köhnə komandalarda sütun sırası backfill-dən sonra fərqli qala bilər.** Backfill mövcud
  `order` dəyərlərini SAXLAYIR, kanonik sıraya məcburi keçirmir — əgər admin əvvəllər sütunları əl ilə
  yenidən sıralayıbsa (məs. "Reorder Test Team"), Take/Testing/Fail düzgün yerə əlavə olunur, amma
  ümumi sıra həmin komandanın öz xüsusi tənzimləməsini əks etdirməyə davam edir. Bu, gözlənilən
  davranışdır (admin-in seçimini pozmamaq üçün), yalnız yeni komandalar hər zaman kanonik sırada olur.

## Profil, Ayarlar, statistika (Faza 2)

Tam plan: `C:\Users\Elşen İ\.claude\plans\taskomania-kanban-workflow.md`. Qısaca:

- **Sxem**: `User.avatarUrl` (kiçik, klient tərəfində 160×160 kvadrat kəsilmiş JPEG `data:` URI —
  ayrıca fayl-saxlama/serving yolu bu ölçüdə şəkil üçün artıq yükdür) və `TaskActivity.assigneeId`
  (hərəkət anında tapşırığın kimə təyin olunduğunun snapshot-u — `TaskActivity.userId`-dən fərqli:
  admin Testing→Done/Fail edəndə hərəkəti admin edir, amma nəticə işi görən şəxsin adına yazılmalıdır;
  `Task.assigneeId` bunun üçün etibarsızdır, çünki uğursuz tapşırıq yenidən təyin olunanda üzərinə yazılır).
- **Statistika** (`stats.service.ts`): uğur/uğursuzluq sayı `TaskActivity.assigneeId` + `toColumnId`-in
  tipindən (DONE/FAIL) hesablanır (unikal `taskId` dəstləri, təkrar sayılmasın deyə). Faiz düsturu:
  `uğurlu/(uğurlu+uğursuz)×100`, heç bir qərarlaşmış tapşırıq yoxdursa 100%. `GET /teams/:teamId/stats`
  (bütün üzvlər üçün, hər kəs görə bilər — komanda arası müqayisə/rəqabət üçün) və
  `GET /teams/:teamId/members/:userId/profile` (tək üzvün tam profili: stats + hazırkı/uğurlu/uğursuz
  tapşırıq siyahıları + onun yüklədiyi fayllar).
- **Audit**: `GET /teams/:teamId/activity` (admin-only) — bütün komandanın son 200 sütun-hərəkəti,
  tapşırıq başlığı ilə birlikdə, `SettingsScreen.tsx`-in admin panelində göstərilir.
- **Sütun adını dəyişmə**: `PATCH /teams/:teamId/columns/:columnId` (admin-only, `renameColumnSchema`
  — yalnız `name`, sub-sütunlar daxil istənilən sütunu əhatə edir). Yeni `column:renamed` socket
  event-i (`column:created`-lə eyni client-side handler-i işə salır — sadəcə `["columns", teamId]`
  invalidasiyası).
- **Profil sinxronu**: `PATCH /auth/me` (`updateProfileSchema`) — `member:updated` broadcast edir,
  `useRealtimeSync.ts` bunu `["members", teamId]` keşinə patch edir; çağıran özü isə
  `AuthContext.updateProfile()` vasitəsilə birbaşa öz `user` state-ini yeniləyir (round-trip gözləmədən).
- **Frontend**: `ProfileScreen.tsx` (hər kəsin profilinə baxıla bilər — `TeamRoster.tsx` header-də
  bütün üzvlərin avatarları, klik profil açır), `SettingsScreen.tsx` (tema/avatar/ad hamıya; sütun
  adı dəyişmə + audit yalnız admin-ə), `AvatarPicker.tsx` (canvas-la kvadrat kəsmə+kiçiltmə),
  `Avatar.tsx` (paylaşılan komponent — şəkil varsa göstərir, yoxdursa baş hərflər, `TaskCard`-da da
  istifadə olunur ki, təyinat dairələri profil şəkli ilə uyğun olsun).
- **Tema override** (`store/themeStore.ts`): `localStorage`-da saxlanılan seçim `<html data-theme>`
  atributunu idarə edir; `index.css`-də OS-media-query bloku `:not([data-theme="light"])` ilə
  qorunur (aydın "işıqlı" seçimi tünd OS-i əzir) və `[data-theme="dark"]` bloku ayrıca təkrarlanır
  (aydın "tünd" seçimi işıqlı OS-i əzir) — hər iki istiqamətdə aydın seçim udur, "Sistem" defolt
  olaraq OS-a əməl edir. Real UI-da hər üç vəziyyət (Sistem/İşıqlı/Tünd) test edilib.
- Real UI-da tam test edilib: tema keçidi (OS-i əzmə daxil), sütun adını dəyişmə (real-time + audit-də
  köhnə tarixçənin yeni adla göründüyü təsdiqlənib), ad dəyişmə (header/roster/audit-də anında əks
  olunması), profil ekranı (statistika, tapşırıq siyahıları, komanda reytinqi).

## Faza 2 cilalama turu — dil seçimi, admin gizliliyi, UI düzəlişləri

- **Tam i18n (AZ/EN)**: `i18n/translations.ts` (flat key→string lüğəti, hər iki dil eyni açarları paylaşır) +
  `i18n/useT.ts` (`useT()` hook-u, `store/localeStore.ts`-dəki seçimi oxuyur, tapılmayan açıq üçün
  az-a, sonra açarın özünə geri qayıdır). Demək olar bütün renderer komponentləri (auth, board, task
  modalı, şərh/asılılıq/fayl panelləri, profil, ayarlar, dəvət, power menu) bu sistemi istifadə edir.
  **Şüurlu şəkildə xaricdə qalıb**: Qraf görünüşü (`GraphView.tsx`/`GraphLegend.tsx`) və Dizayn
  Kanvası — bunlar daha nadir istifadə olunan, ayrıca tünd-tema alt-alətlərdir, ilkin tərcümə dalğasına
  daxil edilməyib. Ayarlarda "Dil" seçimi (globe ikonu) Azərbaycan/İngilis arasında keçid edir, seçim
  `localStorage`-da saxlanılır.
- **Admin profili yalnız admin özü görə bilər**: `stats.service.ts`-də `getMemberProfile(teamId, userId,
  callingRole)` — hədəf istifadəçi ADMIN-dirsə və çağıran ADMIN deyilsə 403 atır. `TeamRoster.tsx`
  bunu UI-də əvvəlcədən əks etdirir (admin avatarı digər üzvlər üçün kliklənməz görünür, opacity aşağı).
  API səviyyəsində curl ilə test edilib: üzv→admin profili = 403, üzv→öz profili = 200, admin→üzv
  profili = 200.
- **Admin statistikadan kənarlaşdırılıb**: `getTeamStats` sorğusu `role: "MEMBER"` filtri ilə admin-i
  komanda reytinqindən çıxarır (admin tapşırıq icra etmir, faiz mənasızdır). `getMemberProfile` admin
  üçün `stats: null` qaytarır; `ProfileScreen.tsx` bu halda statistika kafelini/tapşırıq siyahılarını
  tamamilə gizlədir (yalnız "Sənədlər" bölməsi qalır). Shared tip: `MemberProfile.stats: MemberStats | null`.
- **Sütun adı dəyişmə input-ları bərabər enlidir**: əvvəllər alt-sütun sətirləri `paddingLeft` ilə
  bütün sətri sıxdırırdı, nəticədə input fərqli enli görünürdü. Həll: hər sətir eyni CSS grid-i
  istifadə edir (`20px 1fr auto` — sabit girinti sütunu, çevik input, avto düymə), girinti indeks
  sütununda "↳" işarəsi kimi göstərilir, enə təsir etmir.
- **Audit daha səliqəli**: hər qeyd indi ayrıca kart (`var(--paper-panel)` fon, girinti) — birinci sətir
  tapşırıq başlığı + hərəkət nişanı (rəngli), ikinci sətir kim/nə vaxt. Əvvəlki tək-sətirli sıx format
  əvəz olundu.
- **Ayarlar düyməsi ikonla**: header-də "Ayarlar" mətni dişli çarx SVG ikonu ilə əvəz olundu (mətn
  yalnız `title`/`aria-label` kimi qalır).
- Real UI-da tam test edilib: dil keçidi (bütün ekranlar anında İngilis/Azərbaycan arasında keçir),
  admin profilində statistikanın tam yoxluğu, sütun input-larının bərabərliyi, audit kartlarının görünüşü.

## Onboarding qaydalar ekranı + qrafda üzv-əsaslı rənglər (Faza 3)

- **Onboarding**: `User.onboardingSeenAt DateTime?` — `null` olduqda `App.tsx` giriş edən kimi
  `OnboardingModal.tsx`-i (6 nömrələnmiş qayda: sütun axını, Götür, Testinə göndər təsdiqi, admin
  qərarı, profil/statistika, ayarlar) məcburi göstərir; "Anladım" düyməsi `PATCH /auth/me`
  (`onboardingSeen: true`, `updateProfileSchema`-da literal `true` sahəsi) çağırıb bir daha görünməsin
  deyə timestamp yazır. Öz profilindən ("İstifadə qaydaları" düyməsi, yalnız `isOwnProfile` olanda)
  eyni modal həmişə yenidən açıla bilər — bu yol `onboardingSeen` göndərmir, sadəcə bağlanır.
- **Qrafda üzv-əsaslı rənglər**: `GraphView.tsx` əvvəllər tapşırıq node-larını SÜTUNA görə rəngləyirdi
  (`columnColorById`) — indi HƏR ÜZVƏ görə rəngləyir (`memberColorById`, eyni golden-angle `groupColor()`
  funksiyası, indi üzv indeksinə görə). Tapşırığın rəngi onun `assigneeId`-inə bağlıdır (təyin
  olunmayıbsa neytral boz), üzv node-unun özü də öz rənginə malikdir, "təyinat" xətti də eyni rənglə
  çəkilir. Legend qrupları da sütun deyil, üzv-əsaslı oldu (+ "Təyin olunmayıb" və "Fayllar" qrupları) —
  bir üzvü gizlətmək onun bütün tapşırıqlarını da gizlədir. **Qeyd**: Qraf ekranının mətnləri (QRUPLAR,
  Hamısını seç və s.) hələ i18n sisteminə köçürülməyib, yalnız Azərbaycan dilindədir.
- Real UI-da tam test edilib: onboarding həm ilk girişdə avtomatik açılıb (təsdiqləndikdən sonra server
  tərəfdə saxlanılıb, `GET /auth/me` ilə yoxlanılıb), həm profildən yenidən açılıb; qrafda iki fərqli
  üzvün fərqli rənglərdə (qırmızı/yaşıl) göründüyü və tapşırığın öz təyin olunan şəxsinin rənginə uyğun
  olduğu təsdiqlənib.

## İstifadəçi testindən sonra tapılan düzəlişlər

- **Tapşırıq təyinatı admin-only oldu (mühüm təhlükəsizlik boşluğu).** İstifadəçi UI-də tapşırıq
  redaktə formasındakı "Təyin edilib" `<select>`-i vasitəsilə (drag/Götür istifadə etmədən, sadəcə
  seçib "Saxla" basaraq) istənilən tapşırığı özünə və ya başqasına təyin edə bildiyini aşkarladı —
  `updateTask`-da `assigneeId` dəyişikliyi yalnız `columnId` DƏYİŞƏNDƏ yoxlanılırdı
  (`assertMoveAllowed`), sadə təyinat dəyişikliyi heç yoxlanmırdı. Həll: yeni
  `assertAssigneeChangeAllowed()` (`task.service.ts`) — ADMIN sərbəstdir, MEMBER üçün YALNIZ Take
  hərəkətinin bir hissəsi kimi öz üzərinə götürmə (`targetColumn.type==="TAKE" && yeni
  assigneeId===özü`) icazəlidir, əks halda 403. Eyni qayda `createTask`-a da tətbiq olundu (member
  yeni tapşırıq yaradanda `assigneeId` göndərə bilməz). Frontend: `TaskDetailModal.tsx`-də admin
  olmayanlar üçün təyinat sahəsi redaktə olunmayan mətnə çevrildi (dropdown yalnız admin görür).
  API ilə test edilib: member-in özünə təyinat cəhdi 403, admin-in Take-vasitəsilə özünə götürməsi 200.
- **Tapşırıq silmə admin-only oldu.** `DELETE /tasks/:taskId` marşrutuna `requireAdmin` əlavə olundu
  (əvvəllər istənilən authenticated istifadəçi silə bilirdi). `TaskDetailModal.tsx`-də "Sil" düyməsi
  yalnız admin-ə göstərilir. API ilə test edilib (member cəhdi → 403).
- **Power-menu düyməsi Qraf və Ayarlar ekranlarında mətnin üstünə düşürdü.** Hər ikisi öz başlıq
  sətirlərini idarə edir, `app-header`-in mövcud "sağda güc-menyusu üçün yer saxla" konvensiyasını
  paylaşmırdı. Həll: `GraphView.tsx`-in başlıq sətrinə `paddingRight:60`, `SettingsScreen.tsx`-in
  panelinə `paddingTop:56` (üfüqi yer azdır, panel tam sağ kənarda olduğu üçün şaquli aralama daha
  etibarlı).
- **Qraf ekranı tam tərcümə edildi** (`GraphView.tsx`, `GraphLegend.tsx`) — əvvəllər i18n-dən kənarda
  saxlanılmışdı, indi digər ekranlarla eyni `useT()` sistemini istifadə edir.
- **Qrafda üzv node-una klik → profil modalı.** Seçilmiş üzv node-unun alt-kartına "Profili aç"
  düyməsi əlavə olundu (tapşırıq node-unun "Aç" düyməsi ilə eyni naxış) — `ProfileScreen.tsx`-i
  Qraf üzərində overlay kimi açır, `GraphView`-in öz state-i (`profileUserId`) ilə idarə olunur.
- **"Testinə" → "Testingə" yazı səhvi düzəldildi** (3 yerdə: `testFlow.title`, `testFlow.submitFailed`,
  `onboarding.rule3Title` — "g" hərfi düşmüşdü).
- Real UI-da (həm admin, həm real member hesabı ilə) tam test edilib.

## Kanvas — komanda-səviyyəli, hər üzvün öz dizayn kanvası

Əvvəllər Kanvas yalnız tək bir tapşırığın fayl əlavələrini göstərən müvəqqəti modal idi
(`AttachmentPanel.tsx`-dəki "Kanvasda bax" düyməsi). İstifadəçinin bunun əslində vacib bir alət
olduğunu bildirməsindən sonra top-level, komanda-səviyyəli görünüşə çevrildi:

- **Backend**: `GET /teams/:teamId/attachments` (yeni, `teams.routes.ts`) — komandanın BÜTÜN fayl
  əlavələrini qaytarır (mövcud `attachmentService.listTeamAttachments`-i təkrar istifadə edir),
  heç bir rol məhdudiyyəti yoxdur (admin dəqiqliyi olan profil kimi deyil — hər kəs hər kəsin
  kanvasına baxa bilər, istifadəçinin öz tələbinə görə).
- **Frontend**: `canvas/CanvasBrowserScreen.tsx` (yeni, `App.tsx`-də üçüncü top-level `viewMode`,
  Qraf ilə eyni səviyyədə) — header-də bütün üzvlərin tab-ları ("Kimin kanvası:"), seçilən üzvün
  `uploadedById`-inə görə filtrlənmiş fayllar mövcud `DesignCanvas.tsx` komponentinə ötürülür.
  `DesignCanvas.tsx`-ə yeni `extraHeaderContent` proп-u əlavə olundu ki, həm köhnə tək-tapşırıq
  modalı (`AttachmentPanel`-dən, proп-suz), həm də yeni kanvas-brauzer (üzv tab-ları ilə) eyni
  pan/zoom/frame kodunu təkrarsız paylaşsın.
- **Header**: yeni ikon-düymə (şəkil ikonu) "Qraf" ilə "Ayarlar" arasında, `t("canvas.navTitle")`
  tooltip-i ilə.
- `DesignCanvas.tsx` bu turda tam tərcümə edildi (əvvəllər i18n-dən kənar qalmışdı).
- **Qeyd**: bu ilk versiyadır — istifadəçi bu aləti gələcəkdə təkminləşdirəcəklərini bildirib
  (məs. sərbəst yerləşdirmə/redaktə, kateqoriyalar və s. hələ yoxdur, sadəcə fayllar avtomatik
  grid-ə düzülür).
- Real UI-da test edilib: fayl yükləyən üzvün kanvasında görünməsi, tab-lar arası keçid (fərqli
  üzvlərin fərqli fayllarını göstərməsi), boş vəziyyət mesajı.

## Multi-team dəstəyi

Ən böyük struktur dəyişikliyi: `User.teamId`/`role` (tək, dəyişməz sahələr) əvəzinə hər istifadəçi
istənilən sayda komandaya aid ola bilər, hər komandada fərqli rolla.

- **Sxem**: yeni `TeamMembership` cədvəli (`userId, teamId, role, joinedAt, lastActiveAt`,
  `@@unique([userId, teamId])`) — üzvlük/rol üçün əsl mənbə. Miqrasiya 3 addımda edildi (data
  itkisinin qarşısını almaq üçün): (1) `TeamMembership` əlavə edildi (`User.teamId/role` saxlanılaraq),
  (2) `backfill-team-memberships.ts` bütün mövcud İstifadəçilərin `teamId/role`-unu uyğun
  `TeamMembership` sətrinə köçürdü, (3) yalnız bundan sonra `User.teamId/role` silindi (əl ilə
  yazılmış SQL miqrasiyası, `prisma migrate dev` data-itkisi xəbərdarlığı ilə qeyri-interaktiv
  mühitdə uğursuz olduğu üçün `prisma migrate diff` + `migrate deploy` istifadə olundu).
- **JWT = "aktiv komanda"**: token forması (`{userId, teamId, role}`) DƏYİŞMƏDİ — sadəcə mənbəyi
  indi `TeamMembership`-dir, JWT özü "bu sessiya hazırda hansı komandada, hansı rolla işləyir"
  mənasını daşıyır. Bu sayədə `requireAdmin`, bütün mövcud `req.auth!.teamId`-ə əsaslanan marşrutlar
  demək olar toxunulmadı.
- **Yeni auth endpoint-ləri** (`auth.routes.ts`/`auth.service.ts`):
  - `GET /auth/my-teams` — cari istifadəçinin bütün üzvlükləri (keçid menyusu üçün).
  - `POST /auth/teams` — daxil olmuş istifadəçi üçün ƏLAVƏ komanda yaradır (admin olur), yeni token.
  - `POST /auth/teams/join` — daxil olmuş istifadəçi dəvət kodu ilə ƏLAVƏ komandaya üzv olur.
  - `POST /auth/switch-team` — mövcud üzvlüklərdən birinə keçid, yeni token (yenidən giriş lazım deyil).
  - `POST /auth/leave-team` — qoruyucularla: (a) son komandanızı tərk edə bilməzsiniz (əvvəlcə başqa
    birinə qoşulun/yaradın — "teamless" sessiya vəziyyətinin qarşısını alır), (b) yeganə admin
    olduğunuz komandanı tərk edə bilməzsiniz (hələ "üzvü admin et" funksiyası olmadığından, komanda
    "sahibsiz" qalardı). `login()` istifadəçinin `lastActiveAt`-ə görə ən son aktiv olduğu komandanı
    avtomatik seçir.
- **Digər servislər**: `assertAssigneeInTeam` (task.service.ts), `getTeamStats`/`getMemberProfile`
  (stats.service.ts), `/:teamId/members` və `/:teamId/graph` (teams.routes.ts) — hamısı
  `prisma.user.findMany({teamId})` əvəzinə `prisma.teamMembership` üzərindən sorğulanır.
- **Frontend**: `components/TeamSwitcher.tsx` (header-də, bina ikonu + cari komanda adı) — açılan
  panel: komandalar siyahısı (rolla), "+ Yeni komanda yarat", "+ Dəvət kodu ilə qoşul" (hər ikisi
  panel daxilində inline forma), "Bu komandanı tərk et" (yalnız 2+ komanda olanda görünür). Komanda
  dəyişəndə `AuthContext`-in mövcud `applyAuth()` axını (token+user yenilə, socket-i yenidən qoş)
  təkrar istifadə olunur — React Query açarları onsuz da `teamId`-ə görə olduğundan başqa heç bir
  keş təmizləmə lazım deyil.
- Real UI-da tam test edilib: eyni istifadəçi bir komandada Üzv, yaratdığı başqa komandada Admin
  (rol komanda-spesifik), iki istiqamətli keçid, yeganə admin qadağası, son-komanda qadağasının əksi
  olaraq adi üzvün uğurla tərk edib qalan komandaya avtomatik keçməsi, dəvət kodu ilə əvvəlki
  komandaya yenidən qoşulma.

## Sütunları sürüşdürərək sıralama

- **Backend**: `PATCH /teams/:teamId/columns/:columnId/reorder` (admin-only, `requireAdmin`) — `POST /columns`-un insert-after məntiqini (bax yuxarı, `createColumnSchema`) təkrar istifadə edir, amma MÖVCUD sütunu köçürür: sütunu siyahıdan çıxarır, `afterColumnId`-ə görə (yaxud `null` = ən əvvələ) yenidən yerləşdirir, bütün `order` dəyərlərini bir tranzaksiyada sıx 0..n-1 ardıcıllığına salır (`Column.order` — `Task.order`-dan fərqli olaraq `Int`-dir, kəsr araya-əlavə mümkün deyil). `column:reordered` (tam sütun siyahısı ilə) broadcast edilir; `useRealtimeSync.ts`-də `column:created`-lə eyni sxemlə (`["columns", teamId]` invalidasiyası) qəbul edilir.
- **Frontend**: `@dnd-kit/sortable` + `@dnd-kit/utilities` əlavə edildi (əvvəllər yalnız `@dnd-kit/core` var idi, tapşırıq sürükləməsi üçün). `Board.tsx`-in MÖVCUD `DndContext`-i həm tapşırıq, həm sütun sürükləməsini idarə edir — eyni kontekstdə iki fərqli sürükləmə növünü ayırmaq üçün `useDraggable`/`useSortable`-a `data: {type: "task" | "column"}` verilib, `handleDragEnd` bunu yoxlayıb müvafiq məntiqə keçir.
- **Gotcha — eyni `DndContext`-də iki fərqli drop-hədəfi eyni id ilə toqquşur.** `Column.tsx`-də tapşırıq-buraxma hədəfi (`useDroppable({id: column.id})`, mövcud) və sütun-sıralama sortable-ı (`useSortable({id: ...})`, yeni) EYNİ id-ni paylaşsaydı, ikinci qeydiyyat birincinin qeyd olunmuş rect-ini səssizcə əvəz edərdi (dnd-kit-in daxili registry-si id üzrə vahid map-dir, iki fərqli hook çağırışı — hətta fərqli DOM node-lara bağlı olsalar belə — eyni id ilə toqquşur). Həll: sütun-sıralama `col-${column.id}` prefiksli id istifadə edir (həm `SortableContext`-in `items`-ində, həm `useSortable`-da), tapşırıq-buraxma hədəfi isə xam `column.id`-ni saxlayır (dəyişməyib) — `handleDragEnd`-də sütun sürükləməsi aşkarlananda prefiks silinir.
- **Draq handle yalnız başlıq**: bütün sütun deyil, yalnız sütun başlığı (`{...attributes} {...listeners}`) sürükləmə handle-ıdır — əks halda tapşırıq siyahısı daxilində klikləmə/scroll ilə toqquşardı. `disabled: !canReorder` (yəni admin olmayanlar üçün) sortable-ı tamamilə söndürür, cursor da `default` qalır.

## Layihə etiketi və filter

Bir komanda eyni vaxtda bir neçə fərqli layihə/müştəri üzərində işləyəndə tapşırıqların eyni
sütunlarda (To Do/Take/...) qarışmasının qarşısını almaq üçün: ağır bir "hər layihəyə öz sütun
dəsti" yanaşması əvəzinə, yüngül bir etiket + filter əlavə edildi.

- **Sxem**: yeni `Project` modeli (`id, teamId, name, createdAt`) — heç bir rəng sahəsi YOXDUR.
  `Task.projectId` (nullable, `onDelete: SetNull`) — layihə silinəndə tapşırıqlar sadəcə etiketsiz
  qalır, özləri toxunulmaz qalır. Miqrasiya tam əlavə xarakterlidir (yeni cədvəl + nullable sütun),
  data itkisi riski yoxdur.
- **Rəng: saxlanmır, hesablanır.** Hər layihənin rəngi onun komandanın layihə siyahısındakı
  mövqeyindən (indeksindən) törəyir — Qraf görünüşündəki üzv-rəngləri ilə eyni "qızıl bucaq" (golden
  angle) HSL sxemi (`hsl((i * 137.508) % 360, 62%, 58%)`), indi `lib/color.ts`-də `groupColor()`
  adı ilə ortaq çıxarılıb (əvvəllər `GraphView.tsx`-ə həbs olunmuşdu). Bu sayədə istənilən sayda
  layihə üçün "maraqlı", bir-birindən yaxşı ayrılan rənglər alınır, heç bir əlavə state/kitabxana
  saxlamadan — server heç vaxt rəng barədə düşünmür, client hər yerdə (TaskCard, Settings siyahısı,
  Board filteri) eyni sırala + eyni funksiya ilə eyni rəngi yenidən hesablayır.
- **Backend**: `project.service.ts` (list/create/rename/delete + `assertProjectInTeam`),
  `teams.routes.ts`-də `GET/POST /:teamId/projects`, `PATCH/DELETE /:teamId/projects/:projectId`
  (mutasiyalar admin-only, `requireAdmin` — Sütunlarla eyni bölgü). Tapşırığı bir layihəyə etiketləmək
  isə İCAZƏ məsələsi deyil, sırf təşkilatlanma — `createTaskSchema`/`updateTaskSchema`-ya əlavə
  olunan `projectId` istənilən rol tərəfindən dəyişdirilə bilər (admin-only deyil).
- **Frontend**: `hooks/useProjects.ts` (useColumns ilə eyni React Query naxışı),
  `SettingsScreen.tsx`-də admin-only "Layihələr" bölməsi (rəngli nöqtə + ad + Sil, aşağıda ad
  input-u + "Əlavə et"), `TaskDetailModal.tsx`-də hər rol üçün açıq "Layihə" seçici,
  `TaskCard.tsx`-də kartın başlığından əvvəl kiçik rəngli nöqtə+ad etiketi (yalnız `projectId`
  varsa), `Board.tsx`-də axtarış qutusunun yanında layihə filteri (Bütün layihələr / Layihəsiz /
  hər bir layihə — mövcud axtarış filtrasiyasının üstünə əlavə olunur, ikisi eyni vaxtda işləyir).
  `ProjectTag` tipi (`board/projectTag.ts`) Board-da bir dəfə hesablanıb Column → TaskCard-a ötürülür
  — TaskCard özü `useProjects`-i heç vaxt çağırmır.
- Socket: `project:created`/`project:renamed`/`project:deleted` (Sütunlarla eyni broadcast+patch
  naxışı, `useRealtimeSync.ts`); layihə silinəndə əlaqəli `tasks` sorğusu da invalidasiya olunur ki,
  kartlardakı köhnə etiket dərhal yox olsun.

## Gotchas

- **CSP `<img>`/`<iframe>` üçün ayrıca icazə tələb edir.** `index.html`-dəki CSP-nin `connect-src`-ə `http://localhost:4000` əlavə etməsi kifayət deyil — `<img src>` `img-src`-ə, `<iframe src>` isə `frame-src`-ə tabedir, bunlar ayrıca göstərilməsə `default-src`-ə (yalnız `'self'`) düşür və backend-dən şəkil/HTML yükləmək səssizcə bloklanır (konsolda "Refused to load" xətası). Fayl-əlavəsi önizləməsini quranda bu iki direktivi də `http://localhost:4000` ilə əlavə etməklə düzəldildi.

- **dnd-kit: sürüklənən kart sütunun `overflow`-unda kəsilir.** `useDraggable`-ın `transform`-unu birbaşa kartın özünə tətbiq etsən, kart öz valideyninin (sütunun scroll olan daxili div-i) daxilində qalır — sütun sərhədini keçəndə vizual olaraq kəsilir və digər sütunların üzərinə çıxa bilmir. Həll: `@dnd-kit/core`-un `DragOverlay`-i — sürüklənən zaman əsl kart `visibility: hidden` olur (yerini saxlayır), `DragOverlay` isə ayrıca, heç bir `overflow`/stacking context-ə bağlı olmayan bir qatda üzən klonu göstərir (`Board.tsx`-də `activeId` state-i + `TaskCard.tsx`-də ixrac olunan `TaskCardOverlay`).
- **dnd-kit: kart klikləmə vs sürükləmə.** `useDraggable` default `PointerSensor`-u heç bir `activationConstraint` olmadan istifadə etsə, drag `pointerdown`-da (məsafə 0) dərhal başlayır və bu, kartın `onClick`-ini (edit modalını açan) udur. Həll: `Board.tsx`-də `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` — yəni sürükləmə yalnız 8px-dən çox hərəkətdən sonra aktivləşir, adi klik isə normal keçir.

## Brendinq: "Dastan Studio" + tətbiq ikonu yenilənməsi

- **Nəşriyyat adı**: kod-imzalama sertifikatının subyekti (`CN=Dastan Studio`) və `package.json`-da
  `"author": "Dastan Studio"` (əvvəllər "Taskomania" idi — məhsul adı ilə nəşriyyat adı ayrıldı).
  Sertifikat + `.pfx`/parol `packages/desktop/certs/`-də (gitignore-da, HEÇ VAXT commit olunmur).
  Başqa kompüterdə etibar qazanmaq üçün `certs/share-with-friend/` (yalnız `.cer`+`.bat`+`.ps1`,
  parolsuz) — `.bat` özünü UAC ilə yüksəldib sertifikatı `LocalMachine` mağazasına quraşdırır.
- **Tətbiq/bildiriş ikonu**: `build/icon.ico`/`icon.png` və `renderer/assets/notification-icon.png`
  istifadəçinin verdiyi yeni `TaskomaniaEsas.png`-dən yenidən yaradıldı (əvvəlki avtomatik-kəsilmiş
  versiya əvəzinə).

## Layihə etiketi ikonları

`board/projectTag.ts`-də hər layihəyə (rəngdən əlavə) fərqli bir `lucide-react` ikonu təyin olunur —
16 ikonluq sabit siyahıdan (`PROJECT_ICONS`) seçim layihənin sırasına (indeksinə) görə deyil, öz
`id`-sinin djb2 hash-inə görədir (`hashString()`) — əvvəlki indeks-əsaslı versiya yeni layihələr
yaradıldıqca ikonların "növbə ilə", proqnozlaşdırıla bilən ardıcıllıqla təkrarlandığını göstərmişdi.
`TaskCard.tsx`-də rəngli nöqtə əvəzinə bu ikon göstərilir.

## Daxili IDE

İstifadəçinin Taskomania daxilində real kod yazıb test edə bilməsi üçün (C#/Python/Java/
React/React Native/TypeScript/Node.js/Next.js/SQL) ayrıca bir "Faza 1" IDE quruldu — fayl ağacı,
Monaco redaktoru, əsl terminal, fayl-asılılıq qrafiki, sonra əsl dil-server (LSP) inteqrasiyası.

### Təhlükəsizlik memarlığı — ayrıca pəncərə, ayrıca preload

IDE Board-un pəncərəsi ilə **eyni deyil** — tamamilə ayrıca bir `BrowserWindow` (`src/main/ide/ideWindow.ts`),
öz `session` partition-u (`persist:ide`, Board-un JWT-sini paylaşmır) və öz preload skripti
(`idePreload.ts`, `window.ideAPI`) ilə açılır. Bunun səbəbi: Board-un renderer-i (tapşırıq
təsviri/şərh kimi istifadəçi məzmunu göstərir) heç vaxt fs/pty/lsp körpüsünə malik olan
`contextBridge` obyektinə çıxışı olmur — struktur səviyyəsində, Board-da fərz edilən XSS terminala/
diskə çata bilməz, kodun diqqətlə yazılmasından asılı olmadan. Header-də yeni bir ikon-düymə
(`TaskomaniaIDE.png`) `window.teamTracker.openIde()` → `ipcMain.on("ide:open", ...)` ilə bu pəncərəni
açır/önə gətirir.

### Fayl sistemi

`src/main/ide/fsHandlers.ts` — istifadəçi `dialog.showOpenDialog` ilə bir "layihə kökü" seçir
(və ya "Yeni layihə yarat" formu ilə boş qovluq yaradır, `project:createNew`), bundan sonra bütün
`fs:*` kanalları YALNIZ nisbi yol qəbul edir; `resolveInRoot()` hər çağırışda `path.resolve(root,
relPath)`-in kökün daxilində qaldığını yoxlayır (`../../` kimi cəhdləri rədd edir) — bu, renderer-in
iddiasına deyil, əsas prosesin öz yoxlamasına əsaslanan sərhəddir. `FileTree.tsx` qovluqları lazımı
anda (`readDir` ilk genişlənmədə) yükləyir; kök səviyyəsində "+ Fayl"/"+ Qovluq" düymələri var
(`window.prompt()` DEYİL — Electron-un Chromium-u native bloklayıcı `prompt()`-u tətbiq etmir,
"is and will not be supported" xətası atır — əvəzinə inline `<input>` state-i istifadə olunur).

### Terminal — qısıtlı, yalnız yerli klaviatura

`src/main/ide/ptyHandlers.ts` — `node-pty` ilə əsl `powershell.exe`/`bash` prosesi (cwd = layihə
kökü). Tək invariant: `pty:write` YALNIZ `TerminalPane.tsx`-in öz `xterm.onData()` callback-indən
çağırılır — heç bir tapşırıq datası/şəbəkə hadisəsi/başqa IPC kanalı bu kanala yaza bilməz. IDE
pəncərəsi bağlananda (`ideWindow.ts`-in `"closed"` handler-i) `killAllPtySessions()` çağırılır —
React-ın unmount-cleanup-u pəncərənin JS kontekstinin dərhal məhv edilməsi səbəbindən vaxtında işə
düşməyə bilər, bunsuz hər bağlanan pəncərə bir "yetim" powershell/bash prosesi qoyub gedərdi (cwd
kilidli qalır, qovluğu silmək mümkün olmur).

### Fayl-asılılıq qrafiki

`src/main/ide/dependencyScanner.ts` (`project:scanDependencies`) — layihəni gəzib mətn fayllarında
sadə regex-lə import/require ifadələrini çıxarır (JS/TS/JSX/TSX/Python/C#/Java), nisbi importları
əsl fayl yoluna çevirir. Render: mövcud `react-force-graph-2d` konvensiyası (`graph/GraphView.tsx`-
dəki eyni kitabxana) təkrar istifadə olunur — yeni asılılıq lazım deyil. `DependencyGraphPane.tsx`
sol paneldə "Qraf" tab-ı kimi, node-a klik faylı redaktorda açır.

### LSP — real IntelliSense (avtomatik tamamlama, xəta vurğulama)

`monaco-languageclient` (v10+) `@codingame/monaco-vscode-api` tam VSCode-təqlid polifil ekosistemini
tələb etdiyi üçün (sadə `@monaco-editor/react` quruluşu ilə uyğun deyil) İSTİFADƏ OLUNMADI —
əvəzinə yüngül, əldə yazılmış bir körpü quruldu:

- **`src/main/ide/lspHandlers.ts`** — dil serverlərini (`typescript-language-server`, `pyright`,
  `sql-language-server`) yerli uşaq proses kimi işə salır. Hamısı Node-based CLI-lardır, ona görə
  ayrıca Node.js quraşdırılması TƏLƏB OLUNMUR — `process.execPath` (Electron-un öz exe-si) +
  `ELECTRON_RUN_AS_NODE: "1"` mühit dəyişəni ilə çağırılır (`node-pty`-nin öz uşaq prosesindən
  fərqli olaraq, bu, adi bir `child_process.spawn`-dır). LSP-nin `Content-Length: N\r\n\r\n<JSON>`
  freym protokolunu əl ilə parçalayan kiçik bir bufer (`drainMessages`) var (bir `stdout` "data"
  hadisəsi bir neçə mesaj ehtiva edə bilər, ya da bir mesaj bir neçə hadisəyə bölünə bilər).
- **`renderer/ide/lsp/LspClient.ts`** — minimal JSON-RPC 2.0 client (sorğu id-ləri + pending
  promise map-i + bildiriş handler-ləri) — `vscode-jsonrpc` əvəzinə əl ilə yazılıb, çünki
  ehtiyac sadəcə `sendRequest`/`sendNotification`/`onNotification`-dır.
- **`renderer/ide/lsp/lspManager.ts`** — Monaco-nun öz provider API-lərinə (`registerCompletionItem
  Provider`, `registerHoverProvider`, `registerDefinitionProvider`) birbaşa bağlanır, ayrıca
  `MonacoLanguageClient` sinifi lazım deyil. Hər açılan fayl üçün server sessiyası (layihə+dil üzrə,
  paylaşılan) başladılır/tapılır, `textDocument/didOpen`/`didChange`/`didClose` göndərilir,
  `textDocument/publishDiagnostics` bildirişləri `monaco.editor.setModelMarkers`-ə çevrilir.
- **Monaco-nun öz built-in TS/JS worker-i söndürüldü** (`monacoSetup.ts`,
  `typescriptDefaults.setModeConfiguration({completionItems:false, hovers:false, diagnostics:false, ...})`)
  — əks halda bizim əsl LSP-based provider-lərimizlə eyni vaxtda işləyib təkrarlanan (iki dəfə
  görünən) tamamlama siyahısı/diaqnostika yaradırdı.
- **Gotcha — URI normalizasiyası (real, canlı sınaqda tapılan bug).** `publishDiagnostics`
  bildirişi düzgün gəlirdi, amma heç bir qırmızı xətt görünmürdü: səbəb, bizim özümüzün qurduğumuz
  `file://` URI-si (`file:///C:/Users/...`, böyük hərfli sürücü, kodlanmamış `:`) server-in öz
  daxili `vscode-uri` kitabxanası ilə normalizə edib geri göndərdiyi URI-dən (`file:///c%3A/Users/...`,
  kiçik hərfli sürücü, `%3A`-kodlanmış `:`) fərqli idi — sətir müqayisəsi həmişə uğursuz olurdu,
  diaqnostika səssizcə heç bir modelə tətbiq olunmurdu. Həll: `toFileUri()` Windows sürücü
  yollarında eyni normalizasiyanı təkrarlayır (sürücü hərfini kiçildir, `:`-ni `%3A`-yə çevirir,
  qalan hissəni `encodeURI` edir). Canlı UI-da (real `typescript-language-server` prosesi, real
  tamamlama popup-u "age (property) Person.age: number" detalı ilə, real qırmızı vurğu "Type
  'number' is not assignable to type 'string'" mesajı ilə) təsdiqləndi.
### C#/Java — "ilk istifadədə endir" modeli

TypeScript/Python/SQL server-lərindən fərqli olaraq, OmniSharp (~50MB) və Eclipse JDT LS (~50MB)
`package.json`-da bundled asılılıq DEYİL — installer-i şişirtməmək üçün yalnız istifadəçi əsl
`.cs`/`.java` faylı açanda, bir dəfəlik endirilib keşlənir.

- **`src/main/ide/lspDownloader.ts`** — `app.getPath("userData")/lsp-servers/<csharp|java>/` altına
  endirir; tamamlandıqdan sonra bir `.installed` marker faylı yazır (yarımçıq qalan endirmə uğurlu
  quraşdırma kimi qəbul edilməsin deyə). Arxiv açma əlavə npm asılılığı YOXDUR — Windows-da
  PowerShell-in `Expand-Archive`-ı (.zip) və hər iki platformada `tar` (.tar.gz — Windows 10 1803+
  öz `tar.exe`-sini (bsdtar) System32-də daşıyır) proses kimi çağırılır.
  - **C#**: OmniSharp-ın öz-özünə-yetərli (`net6.0`, versiya sabitlənib: `v1.39.15`) buraxılışı —
    .NET SDK-nın ayrıca quraşdırılmasını tələb etmir. `OmniSharp.exe -lsp` (`-lsp` bayrağı onu
    default-un öz köhnə, LSP-dən əvvəlki xətt-əsaslı stdio protokolundan əsl LSP rejiminə keçirir).
  - **Java**: Eclipse-in öz "həmişə cari" snapshot URL-i (`jdt-language-server-latest.tar.gz`) —
    versiya nömrəsi yoxdur, redaktör plaginlərinin (Emacs lsp-mode və s.) istifadə etdiyi eyni
    stabil ünvan. İşə salma: `java -jar <equinox-launcher>.jar -configuration config_win/mac/linux
    -data <layihəyə-görə-hash-lənmiş workspace qovluğu>` — JDT LS hər layihə üçün AYRICA, sabit bir
    `-data` qovluğu tələb edir (paylaşılsa öz indeksini korlayır), ona görə layihə yolunun md5
    hash-i workspace qovluq adı kimi istifadə olunur. **Qeyd**: bu yol sistemdə артıq quraşdırılmış
    bir JRE/JDK tələb edir (JDT LS-in özünü işə salmaq üçün) — bunun ayrıca endirilməsi (bundled
    JRE) bu turda edilmədi, şüurlu əhatə-sərhədi (VS Code-un öz Java uzantısının da defolt
    davranışı ilə eynidir).
- **Renderer axını**: `EditorPane.tsx` faylı açanda `attachLanguageServer()` əvvəlcə
  `ideAPI.lspIsServerInstalled()` yoxlayır; yoxdursa redaktorun üstündə kiçik bir zolaq görünür
  ("C# dəstəyi ... endirilsin? ~50 MB, bir dəfəlik" + Endir/İmtina), təsdiqdən sonra faiz
  göstərən canlı progress-bar (`lsp:downloadProgress` IPC hadisəsi), tamamlandıqdan sonra avtomatik
  qoşulma cəhdi. Server prosesi uğursuz olsa (məs. Java tapılmadı) ayrıca "Dil serveri qoşula
  bilmədi: ..." xəta zolağı göstərilir — redaktorun özü işləməyə davam edir, sadəcə IntelliSense
  olmadan.
- **Gotcha — server-lər arasında `file://` URI normalizasiyası fərqlidir.** `typescript-language-
  server` (`vscode-uri` kitabxanası vasitəsilə) sürücü hərfinin ardından gələn iki nöqtəni
  faiz-kodlayır (`file:///c%3A/...`), OmniSharp isə sürücü hərfini kiçildir amma iki nöqtəni
  DƏYİŞMİR (`file:///c:/...`) — eyni faylın iki fərqli, tam etibarlı URI təsviri. Xam sətir
  müqayisəsi (`entry.uri !== params.uri`) buna görə server-dən asılı olaraq səssizcə uğursuz olub
  diaqnostikanın heç vaxt tətbiq olunmamasına səbəb olurdu (bildiriş özü düzgün gəlirdi — yalnız
  uyğunlaşdırma pozulurdu). Həll: `normalizeUriForCompare()` (`lspManager.ts`) — müqayisədən əvvəl
  hər iki tərəf `decodeURIComponent` + kiçik hərflə normallaşdırılır, konvensiyadan asılı olmadan
  eyni fayla işarə edən istənilən iki URI-ni bərabərləşdirir. Canlı sınaqla tapılıb (tamamlama
  işləyirdi, diaqnostika işləmirdi — iki fərqli kod yolu olduğu üçün bir problemin digərini
  maskaladığı görünmürdü).
- Canlı UI-da tam test edilib: OmniSharp-ın həqiqi endirmə+quraşdırma axını (52MB, faiz progress-
  bar), real `.csproj`-lu layihədə real `System.Console` üzv siyahısı ilə tamamlama (`Beep`,
  `BufferHeight`, `Clear` və s. — söz-əsaslı ehtiyat siyahısı deyil), real tip xətası squiggle-i
  (`"Cannot implicitly convert type 'string' to 'int'"` tərzi), Java üçün server-in `java` olmadan
  aydın xəta ilə uğursuz olduğu (gözlənilən sərhəd davranışı) təsdiqləndi.

## Tapşırıq ↔ IDE bağlantısı

Admin tapşırıq verir, üzv "Götür"lə üzərinə götürüb "In Progress"ə keçirir — bu andan etibarən
tapşırıq detalında yeni bir seçim görünür: "Bu tapşırıq üzərində necə işləyəcəksən? Daxili IDE /
Xarici alət". Məqsəd: üzv daxili IDE-ni seçib layihə üzərində işləsin, sonra "Layihəni tapşırığa
saxla" ilə həmin layihəni birbaşa tapşırığa bağlasın ki, admin sonradan asanlıqla baxa bilsin.

- **Görünmə şərti** (`TaskDetailModal.tsx`): yalnız `task.assigneeId === user.id` VƏ tapşırığın
  sütunu `type === "IN_PROGRESS"` olanda (`showWorkChoice`) — həm admin hər tapşırığa baxanda
  görünməsin, həm də iş başlamazdan əvvəl mənasız olmasın deyə.
- **Token ötürülməsi (təhlükəsizlik sərhədi qorunur)**: "Daxili IDE" düyməsi `window.teamTracker.
  openIdeForTask(taskId, token, apiUrl)` çağırır — JWT Board-un öz preload-undan (`getToken()`,
  artıq mövcud) ötürülür, `ipcMain.on("ide:open", ...)` vasitəsilə **əsas prosesə** çatır və
  `taskContext.ts`-də modul-səviyyəli state kimi saxlanılır. IDE pəncərəsinin öz renderer-i bu
  token-i HEÇ VAXT görmür — yalnız `taskId`-ni (`ideAPI.getTaskContext()`) bilir. Bu, IDE-nin
  Board-dan ayrı session partition-a malik olmasının (bax yuxarı, "Təhlükəsizlik memarlığı")
  DİREKT davamıdır: token yalnız əsas prosesdə yaşayır, heç bir renderer-in JS heap-ində deyil.
- **Saxlama axını** (`taskContext.ts` + `taskUpload.ts`): "Layihəni tapşırığa saxla" düyməsi
  `task:saveProject` invoke edir → əsas proses layihəni (node_modules/.git/bin/obj/dist və s.
  istisna olmaqla, filtrlənmiş bir staging qovluğuna köçürüb) ZIP-ləyir (Windows-da PowerShell-in
  `Compress-Archive`-ı, native alət, əlavə npm asılılığı yoxdur — `tar -a` yoxlanıldı, düzgün zip
  yaratmadığı üçün rədd edildi) və mövcud tapşırıq-əlavəsi endpoint-inə (`POST /tasks/:id/
  attachments`, `kind=ARCHIVE`) yükləyir — bu, Board-un öz `AttachmentPanel.tsx`-inin artıq
  istifadə etdiyi EYNİ endpoint-dir, yeni backend/sxem lazım olmadı.
- Canlı UI-da tam test edilib: tapşırıq yaradılıb → Götür → In Progress-ə sürüklənib → "Daxili
  IDE" seçilib (yeni IDE pəncərəsi `taskId` ilə açılıb) → layihə seçilib → "Layihəni tapşırığa
  saxla" basılıb → server-in `uploads/<attachmentId>/` qovluğunda ZIP-in düzgün açıldığı təsdiqlənib
  → Board-un tapşırıq modalında "Fayllar" bölməsində `project.zip` görünüb (admin-in artıq bildiyi
  önizləmə axını ilə).

## Kod-mənşəyi (paste vs yazma) izləməsi

İstifadəçinin "kodun neçə faizi AI, neçəsi əl ilə yazılıb" sualına texniki cəhətdən dürüst cavab:
heç bir alət bunu etibarlı deyə bilməz (nə insan, nə AI-stilin unikal "imzası" var). Bunun əvəzinə
**obyektiv, yoxlanıla bilən** bir şey ölçülür: mətn redaktora NECƏ daxil olub — kiçik, ardıcıl
klaviatura vuruşları ilə, yoxsa bir anda böyük bir blok (paste) kimi.

- **`renderer/ide/codeOriginTracker.ts`** — modul-səviyyəli iki sayğac (`typedChars`/`pastedChars`).
  Hər açıq faylın `model.onDidChangeContent`-i (`EditorPane.tsx`-də, LSP-nin öz sinxronizasiya
  listener-indən AYRICA bir listener) hər dəyişikliyi ötürür: 20 simvoldan böyük tək-dəfəlik
  daxiletmə "paste", daha kiçik "yazma" sayılır (undo/redo `e.isUndoing`/`e.isRedoing` ilə tamamilə
  istisna edilir — köhnə mətni bərpa etmək yeni müəlliflik deyil). Fayl AÇILANDA ilkin məzmunun
  özü sayılmır, çünki bu listener yalnız `onMount`-dan SONRA qoşulur (ilkin `value` modelə ondan
  əvvəl `@monaco-editor/react` tərəfindən yazılıb).
- **Göstərilmə yeri**: yeni UI YOXDUR — "Layihəni tapşırığa saxla" işə düşəndə fayl yükləməsi
  uğurlu olandan sonra `postCodeOriginComment()` (`taskUpload.ts`) statistikanı adi bir TAPŞIRIQ
  ŞƏRHİ kimi göndərir (mövcud `POST /tasks/:id/comments`) — admin-in artıq açdığı Şərhlər bölməsində
  görünür, ayrıca panel/sxem lazım olmadı. Mətn həmişə "əl ilə yazılıb ~X%, yapışdırılıb ~Y%"
  formatındadır, heç vaxt "AI" sözü keçmir.

## Emmet (`!` + Tab → HTML skeleti)

`emmet-monaco-es` (kiçik, monaco-editor-a uyğun paket) — `monacoSetup.ts`-də bir dəfə,
modul yüklənəndə qeydiyyatdan keçir: `emmetHTML` (html), `emmetCSS` (css/scss/less), `emmetJSX`
(javascript/typescript). VS Code-un öz Emmet davranışı ilə eynidir (`!`+Tab → tam HTML5 skeleti,
tab-stop-larla). Canlı UI-da test edilib: boş `.html` faylda `!`+Tab tam boilerplate yaradıb,
kursor `<body>` daxilində, ilk tab-stop (`device-width`) seçili qalıb.

## "Go Live" (HTML canlı önizləmə)

VS Code-un Live Server uzantısının kiçik bir analoqu — `src/main/ide/goLiveServer.ts`.

- Yalnız `127.0.0.1`-ə bağlanır (heç vaxt `0.0.0.0`) — layihə qovluğundan ixtiyari fayl
  göstərdiyi üçün şəbəkədən əlçatan olmamalıdır. Statik fayl serving path-containment yoxlaması
  ilə (`fsHandlers.ts`-in `resolveInRoot`-u ilə eyni naxış).
  Canlı-yenilənmə **`ws` npm asılılığı olmadan**, sadə Server-Sent Events (`EventSource`,
  brauzerin öz built-in API-si) ilə: hər `.html` cavabına `</body>`-dan əvvəl kiçik bir
  `<script>` yeridilir, bu, `/__taskomania_live_reload` SSE axınına qoşulur; `fs.watch(root,
  {recursive:true})` (200ms debounce-lu) faylda dəyişiklik aşkarlayanda bütün qoşulmuş
  brauzerlərə `data: reload` göndərilir.
- Port `server.listen(0, "127.0.0.1")` ilə avtomatik seçilir (toqquşma riski yoxdur),
  `shell.openExternal(url)` ilə istifadəçinin öz default brauzerində açılır (ayrıca preview
  paneli YOXDUR — real brauzer, real DevTools).
- "Go Live" düyməsi yalnız açıq fayl `.html`/`.htm` olanda görünür (server işləyərkən başqa fayla
  keçsə də düymə "dayandır" halında qalır ki, söndürmək mümkün olsun). IDE pəncərəsi bağlananda
  `killGoLiveServer()` (digər bütün pty/lsp təmizləmələri ilə eyni yerdə, `ideWindow.ts`-in
  `"closed"` handler-i) server+watcher-i söndürür.
- Canlı UI-da tam test edilib: Emmet ilə yaradılan boş HTML faylı üçün "Go Live" basılıb, səhifə
  həqiqi Edge pəncərəsində açılıb; sonra body-yə mətn əlavə edilib saxlanılıb, brauzer HEÇ BİR
  əl ilə yeniləmə olmadan avtomatik yenilənib yeni mətni göstərib; "dayandır" düyməsi server-i
  düzgün söndürüb.

## Fayl/qovluq ikonları (VS Code tərzi)

`renderer/ide/fileIcons.ts` — `lucide-react` ikonları (artıq layihə asılılığı, layihə etiketləri
üçün də istifadə olunur) uzantıya görə SABİT (hash-lənməmiş) rənglərlə: `.ts`/`.tsx` mavi, `.js`
sarı, `.py` mavi, `.cs` bənövşəyi, `.java` narıncı (Coffee ikonu) və s. — VS Code/Material ikon
temalarının tanınan rəng konvensiyalarını təqlid edir, Microsoft-un öz ikon fondunu kopyalamadan.
`package.json` kimi tam fayl adları uzantıdan ƏVVƏL yoxlanılır (`NAME_ICON`) ki, xüsusi hallar
(Package ikonu, qırmızı) uzantı-əsaslı defolt-u əzsin. Qovluqlar açıq/bağlı vəziyyətə görə
`FolderOpen`/`Folder` göstərir. `FileTree.tsx`-də canlı təsdiqlənib (fayl ağacında rəngli,
fərqləndirilən ikonlar).

## Komandanı həmişəlik silmə

Mövcud "komandanı tərk et" (yalnız özünü çıxarır) ilə YANAŞI, admin bütün komandanı həmişəlik silə
bilər — sxemdə yalnız `TeamMembership` və `Project` `Team`-dən avtomatik cascade edir, `Invite`/
`Task`/`Column` etmir, ona görə `auth.service.ts`-də yeni `deleteTeam()` bunları BİR tranzaksiyada,
asılılıq sırası ilə (əvvəlcə `Invite`, sonra `Task` — bu öz növbəsində `Comment`/`Attachment`/
`TaskActivity`/`TaskDependency`-ni öz cascade-i ilə aparır — sonra `Column`, sonda `Team`) silir.

- **Rol JWT-dən deyil, DB-dən yoxlanılır** — `leaveTeam`-dən fərqli olaraq, bu qədər dağıdıcı bir
  əməliyyat üçün çağıranın JWT-dəki (hazırkı aktiv komandaya aid) rolu deyil, HƏDƏF komandadakı
  canlı `TeamMembership` sətri yoxlanılır (admin bir neçə komandada fərqli rollara malik ola bilər).
- **"Yeganə komanda" qadağası** `leaveTeam`-lə eynidir (istifadəçinin başqa heç bir komandası
  qalmaması qarşısı alınır — tətbiq "komandasız sessiya" vəziyyətini dəstəkləmir), AMMA "yeganə
  admin" qadağası YOXDUR (silərkən özünü də silmiş olursan, bu, tərk etməkdən fərqli bir niyyətdir).
- **Digər üzvlərə canlı bildiriş** — tərk etmə səssizdir (yalnız növbəti sorğuda görünər), AMMA
  silmə HAMI üçün dərhal olmalıdır (onların lövhəsi artıq mövcud deyil). Yeni `team:deleted` socket
  hadisəsi (`team:${teamId}` otağına) — `useRealtimeSync.ts` bunu eşidib, silinən komanda hazırkı
  aktiv komanda olarsa, sadəcə tam çıxış edir (`logout()`) — başqa komandaya səssiz keçid etməyə
  çalışmaqdansa ən sadə, həmişə təhlükəsiz reaksiya.
- **UI** (`TeamSwitcher.tsx`): admin-only "Komandanı həmişəlik sil" düyməsi → GitHub-tərzi
  təsdiqləmə (komandanın adını əl ilə yazmadan "Həmişəlik sil" düyməsi aktivləşmir) — sadə
  `window.confirm` kifayət etməyəcək qədər dağıdıcı bir əməliyyat üçün.
- Canlı UI-da tam test edilib: bir dəfəlik test komandası yaradılıb, silinib, `TeamSwitcher`
  siyahısından tam yox olduğu təsdiqlənib, avtomatik ən son aktiv komandaya keçid baş verib.

## Profil şəklinə klik → böyük baxış

`ProfileScreen.tsx`-də mövcud `Avatar` komponenti bir `<button>` ilə sarılıb (yalnız `avatarUrl`
mövcud olanda kliklənə bilən, başlıqsız fayl-seçici ilə qarışmasın deyə `AvatarPicker.tsx`-dən
ayrıca) — klikdə yeni, kiçik `AvatarLightbox.tsx` açılır. `AttachmentPreviewModal`-ı təkrar istifadə
ETMİR (o, fayl/arxiv-spesifik, ağac görünüşü + məzmun-növü aşkarlama daşıyır) — sadəcə "bir şəkil,
daha böyük" olduğu üçün eyni overlay/panel/Escape/klik-kənara konvensiyasını təkrarlayan öz kiçik
komponenti var. Canlı UI-da test edilib: profil şəkli təyin edilib, ProfileScreen-də ona klik
edilib, böyüdülmüş versiya (tam ikon detalları görünən) açılıb, Escape ilə bağlanıb.

## Mentor rolu

`ADMIN`/`MEMBER`-ə əlavə üçüncü rol: admin bir üzvü ProfileScreen-dən (`setMemberRole` düyməsi ilə)
`MENTOR`-a təyin edə bilər — moderator kimi, komandanı izləyən amma admin səlahiyyətinə malik
olmayan biri. Prisma enumuna yeni dəyər əlavəsi qeyri-dağıdıcı olduğu üçün (`ALTER TYPE "Role" ADD
VALUE`) sadə `prisma migrate dev` kifayət etdi — əvvəlki `User.teamId/role` sxem dəyişikliyindən
fərqli olaraq əl ilə SQL yazmağa ehtiyac olmadı.

- **İcazə səthi qəsdən minimal saxlanıb** — mentor HƏR ŞEYDƏ `MEMBER` kimi davranır, İSTİSNA olaraq
  YALNIZ iki yerdə fərqlənir: (1) komanda fəaliyyət/audit jurnalını görə bilir, (2) bütün profilləri
  (adminin özü daxil) görə bilir. Komandanı silmə/tərk etmə, tapşırıq silmə, başqasını mentor/admin
  təyin etmə — hamısı `ADMIN`-only qalır.
- **Kod dəyişikliyinin əksəriyyəti "pulsuz" gəldi** — `task.service.ts`-dəki icazə yoxlamaları
  (`assertMoveAllowed`, `assertAssigneeChangeAllowed`, tapşırıq silmə marşrutu, `deleteTeam`-in öz
  yoxlaması) hamısı binar formada yazılıb (`callingRole === "ADMIN"` / `!== "ADMIN"`), `"MEMBER"`-i
  açıq sadalamır — deməli `MENTOR` avtomatik olaraq `MEMBER` ilə eyni qısıtlı budağa düşür, bu
  fayllarda HEÇ BİR dəyişiklik lazım olmadı. Eynilə `getTeamStats`-in üzv reytinq sorğusu açıq
  `role: "MEMBER"` siyahısı istifadə edir (`role: { not: "ADMIN" }` yox) — mentor avtomatik
  statistika reytinqindən kənarda qalır.
- **İki-səviyyəli admin-qapı naxışı** — mövcud `requireAdmin` (8 marşrutda, TOXUNULMAYIB) YANAŞI
  yeni `requireAdminOrMentor` middleware-i əlavə olundu, YALNIZ komanda fəaliyyət jurnalı
  marşrutunda istifadə olunur — bu, qəsdən AYRICA saxlanıldı ki, başqa heç bir admin-only marşrut
  təsadüfən mentora açılmasın.
- **JWT köhnəlmə problemi və həlli** — `TeamMembership.role` DB-də əsl mənbədir, amma istifadəçinin
  JWT-si (`AuthPayload.role`) yalnız token verildiyi andakı rolu daşıyır. Admin bir üzvü mentora
  təyin edəndə, həmin istifadəçinin ARTIQ AKTİV sessiyası bunu dərhal görmür (yeni giriş/komanda
  keçidinə qədər). Bu, real backend sorğuları ilə təsdiqləndi: köhnə (təyinatdan əvvəlki) token
  fəaliyyət jurnalına `403 "Admin or mentor role required"` alır. Həll: `useRealtimeSync.ts`-in
  `onMemberUpdated` handler-i `member.id === user.id && member.role !== user.role` aşkarlayanda
  mövcud `switchTeam(teamId)`-i (EYNİ komandaya) səssizcə çağırır — bu, DB-dəki canlı roldan yeni
  token basır, yeni token-refresh infrastrukturu qurmaq əvəzinə mövcud mexanizmi təkrar istifadə
  edir. Backend testi bunu təsdiqlədi: `switchTeam` çağırışından sonra tələb olunan token dərhal
  `MENTOR` rolu ilə qayıdır və fəaliyyət jurnalı/admin-profil girişi `200`-ə çevrilir.
- **Backend API səviyyəsində tam yoxlanılıb** (throwaway komanda + iki test istifadəçisi ilə,
  sonda təmizlənib): admin üzvü mentora təyin edir → köhnə token fəaliyyət jurnalına 403 alır →
  `switchTeam` ilə təzələnmiş token 200 alır → mentor adminin profilini görə bilir (200) → mentor
  özünü admin təyin edə bilmir (403) → mentor komandanı silə bilmir (403) → mentor tapşırığı
  birbaşa sütundan-sütuna köçürə bilmir (admin-only "iş axınını keç" yoxlaması, 403) → mentor şərh
  yaza bilir (201) → mentor tapşırığı silə bilmir (403). Hamısı gözlənilən nəticələri verdi.
