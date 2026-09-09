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

## Gotchas

- **CSP `<img>`/`<iframe>` üçün ayrıca icazə tələb edir.** `index.html`-dəki CSP-nin `connect-src`-ə `http://localhost:4000` əlavə etməsi kifayət deyil — `<img src>` `img-src`-ə, `<iframe src>` isə `frame-src`-ə tabedir, bunlar ayrıca göstərilməsə `default-src`-ə (yalnız `'self'`) düşür və backend-dən şəkil/HTML yükləmək səssizcə bloklanır (konsolda "Refused to load" xətası). Fayl-əlavəsi önizləməsini quranda bu iki direktivi də `http://localhost:4000` ilə əlavə etməklə düzəldildi.

- **dnd-kit: sürüklənən kart sütunun `overflow`-unda kəsilir.** `useDraggable`-ın `transform`-unu birbaşa kartın özünə tətbiq etsən, kart öz valideyninin (sütunun scroll olan daxili div-i) daxilində qalır — sütun sərhədini keçəndə vizual olaraq kəsilir və digər sütunların üzərinə çıxa bilmir. Həll: `@dnd-kit/core`-un `DragOverlay`-i — sürüklənən zaman əsl kart `visibility: hidden` olur (yerini saxlayır), `DragOverlay` isə ayrıca, heç bir `overflow`/stacking context-ə bağlı olmayan bir qatda üzən klonu göstərir (`Board.tsx`-də `activeId` state-i + `TaskCard.tsx`-də ixrac olunan `TaskCardOverlay`).
- **dnd-kit: kart klikləmə vs sürükləmə.** `useDraggable` default `PointerSensor`-u heç bir `activationConstraint` olmadan istifadə etsə, drag `pointerdown`-da (məsafə 0) dərhal başlayır və bu, kartın `onClick`-ini (edit modalını açan) udur. Həll: `Board.tsx`-də `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` — yəni sürükləmə yalnız 8px-dən çox hərəkətdən sonra aktivləşir, adi klik isə normal keçir.
