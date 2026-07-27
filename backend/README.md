# Student House — Backend (кезең 1-5: толық негізгі процесс)

Қорқыт Ата атындағы Қызылорда университетінің жатақхана басқару жүйесі.

- **Кезең 1**: негізгі дерекқор схемасы (users/dormitories/rooms/benefits)
  мен авторизация/аутентификация (JWT + RBAC).
- **Кезең 2**: «студент өтініш береді → менеджер қарайды» ағыны —
  `applications`, `application_status_history`, `application_documents`,
  `notifications`.
- **Кезең 3**: «менеджер approved өтініштерден рапорт құрастырады →
  комиссия дауыс береді → рапорт мақұлданады/қабылданбайды» ағыны —
  `report_templates`, `reports`, `report_applications`, `committee_votes`.
- **Кезең 4**: рапорт approved болғаннан кейінгі процесс — келісімшарт →
  төлем → нақты орналастыру → шығу (exit) — `contracts`, `payments`,
  `exit_requests`.
- **Кезең 5** (осы қосымша): (A) 4-ші кезеңдегі "мерзімі өткен
  келісімшарт → автоматты rejected" логикасы дұрысталды (енді тек
  менеджердің рұқсатымен); (B) бөлме/жатақхана ауыстыру процесі
  (`transfer_requests`); (C) response deadline жақындағанда менеджерге
  ескерту.

"Кері байланыс күту уақыты" логикасы (жалпы SLA/eskalation ережелері,
5-ші кезеңдегі нақты deadline-ескертуден бөлек) осы кезеңге кірмейді.
Нақты .docx/PDF генерациясы, төлем шлюзі (payment gateway), email/SMS
интеграциясы — жобаның осы кезеңдерінде де толық жасалмайды (төменде
түсіндірілген).

## Стек

- **Go 1.25**, HTTP роутер — **gin** (минимал тәуелділік)
- **PostgreSQL**, драйвер — **pgx/v5** (pgxpool), қолмен жазылған SQL
  (sqlc/ORM жоқ — репозиторийлер қарапайым, түсінікті болу үшін)
- Миграциялар — **golang-migrate** форматындағы `.up.sql`/`.down.sql`
  файлдары (`migrations/`), бірақ бұл жоба `golang-migrate`-ті кітапхана
  ретінде қоспайды — CLI құралын бөлек орнатасыз (төменде)
- **JWT** (`golang-jwt/jwt/v5`) — access token; refresh token — кездейсоқ
  opaque төлтума, дерекқорда тек оның SHA-256 хэші сақталады (revoke үшін)
- **bcrypt** — құпиясөз хэштеу

## Жоба құрылымы (clean architecture стилі)

```
cmd/api/                 — main.go: wiring (DI), сервер іске қосу
internal/domain/         — доменнің struct-тары (User, Room, Benefit, ...)
internal/repository/     — репозиторий интерфейстері + Postgres іске асыруы
  └── postgres/
internal/service/        — бизнес-логика (validation, RBAC ережелері, auth)
  └── notifier/            — in-app хабарлама stub-ы (Notify)
internal/http/           — HTTP қабаты
  ├── handler/            — gin handler-лері + DTO-лар
  ├── middleware/          — JWT auth, RBAC (RequireRole)
  └── router.go
internal/config/         — .env оқу
pkg/                     — қайта пайдалануға болатын, доменге тәуелсіз util-дер
  ├── hasher/              — bcrypt
  ├── jwtutil/             — access/refresh token
  ├── apperror/            — HTTP статусы бар типтелген қателер
  └── response/            — gin JSON жауап хелперлері
migrations/              — golang-migrate SQL миграциялары
```

`internal/` — сыртқы модульдер импорттай алмайтын жеке код (Go конвенциясы),
`pkg/` — теория жүзінде басқа қызметте де қайта пайдалануға жарайтын
доменге тәуелсіз util-дер. Repository-Service-Handler қабаттануы бизнес-
логиканы (validation, RBAC) HTTP-тан және SQL-дан бөліп тұрады.

## Дерекқор схемасы

| Кесте | Мақсаты |
|---|---|
| `users` | барлық пайдаланушылар, `role` enum (`admin/student/manager/committee_member`), `is_chairperson` флагы (тек `committee_member`-ге) |
| `student_profiles` | `gender`, `course` — бөлме шектеуін (restriction) тексеру үшін |
| `dormitories`, `dormitory_images` | жатақханалар және олардың суреттері |
| `rooms` | бөлмелер, `restrictions` — JSONB (`gender`, `courses`, `benefit_ids`) |
| `room_residents` | кім қай бөлмеде тұрады (`moved_out_at IS NULL` — қазір тұрады) |
| `benefits`, `benefit_fields`, `benefit_required_documents` | льгота түрлері мен олардың өрістері/құжаттары |
| `student_benefits` | студентке льгота тағайындалғаны (минимал жазба — толық өтініш логикасы емес) |
| `refresh_tokens` | refresh token хэштері, logout/revoke үшін |
| `applications` | жатақханаға өтініштер, `status` enum (`pending/manager_review/needs_correction/approved/rejected`); студентке — бір белсенді өтініш деген partial unique index |
| `application_status_history` | әр статус ауысуының аудит логы (`from_status`/`to_status`/`comment`/`changed_by`) |
| `application_documents` | студент жүктеген құжаттар (тек `file_url`, файл сақтау инфрақұрылымы жоқ) |
| `notifications` | in-app хабарламалар (`is_read`, `related_application_id`) |
| `report_templates` | менеджер жүктеген рапорт шаблоны (`name`, `file_url`) |
| `reports` | рапорттар, `status` enum (`pending_committee/approved/rejected`), `previous_report_id` — қайта жіберілген рапорттың тізбегі |
| `report_applications` | рапортқа кірген өтініштер (көп-көпке) |
| `committee_votes` | комиссия мүшесінің дауысы (`decision` nullable, `reason`, `voted_at`) |
| `contracts` | келісімшарттар, `application_id` UNIQUE, `status` enum (`sent/awaiting_manager_decision/accepted/declined/expired`), `response_deadline`, `reminder_sent_at` |
| `payments` | төлемдер, `contract_id` UNIQUE, `amount`/`currency`, `status` enum (`pending/submitted/confirmed/rejected`) |
| `exit_requests` | жатақханадан шығу өтініштері, `room_resident_id` арқылы белсенді тұруға сілтейді |
| `transfer_requests` | бөлме/жатақхана ауыстыру өтініштері (settled студент үшін), `status` enum (`pending/approved/rejected`) |

`dormitories`-ке 4-ші кезеңде `price_per_semester` (NUMERIC, nullable)
өрісі қосылды (жаңа миграция арқылы — 1-ші кезеңдегі Go struct/repository
өзгертілмеді, бұл өріс тек жаңа `ContractRepository.GetDormitoryPrice`
арқылы тікелей SQL-мен оқылады). `applications.status` enum-ына жаңа
`'settled'` мәні қосылды (төлем расталғаннан кейін).

Chairperson бөлек рөл емес — `committee_member` рөлінің үстіне қосымша
`is_chairperson` флагы (DB CHECK constraint осыны бекітеді).

## Бизнес-логика ескертулері

- **Dormitory capacity progress**: `GET /dormitories/{id}/capacity`
  `total_capacity` мен барлық бөлмелер `capacity`-сының қосындысын
  (`allocated_beds`) қайтарады, сонымен қатар `total_rooms_target` пен
  нақты құрылған бөлме санын (`rooms_created`) — ТЗ-дегі "256/32" екі
  өлшемі де (орын саны және бөлме саны) осы бір endpoint-те.
- **Dormitory/Room толық өрістері** (ТЗ conformance түзетуі): admin
  жатақхана формасына ТЗ талап еткен өрістер қосылды — `phone`,
  `dorm_type` (sectional/corridor/block), `floor_count`,
  `total_rooms_target`, `monthly_payment`/`yearly_payment`, `built_year`/
  `commissioned_year`, `ownership_form`, `has_ramps`/`has_elevators`/
  `has_handrails`/`has_parking` (миграция `000027`+`000028`). Бөлме
  формасына `floor`, `category`, `area_sq_m`, `equipment` қосылды.
- **Room restriction validation**: `PATCH /rooms/{roomId}/restrictions`
  бөлмедегі әрбір қазіргі тұрғынды (`gender`/`course`/`benefit_ids`)
  жаңа шектеумен салыстырады; біреуі де сәйкес келмесе — `409 Conflict`.
  Керісінше, `POST /rooms/{roomId}/residents` жаңа тұрғынды бөлменің
  қолданыстағы шектеуімен және бос орынымен тексереді.

### Application (өтініш) статус машинасы

```
pending → (manager_review) → approved | rejected | needs_correction
needs_correction → pending (студент PATCH /applications/{id} арқылы қайта жібергенде)
```

- **Бөлек "claim" endpoint жоқ**: `PATCH /applications/{id}/decision`
  application жолын (`SELECT ... FOR UPDATE`) құлыптап, `pending →
  manager_review → соңғы статус` ауысуын бір транзакцияда жасайды. Екі
  менеджер бір өтінішке қатар шешім қабылдамақ болса — екіншісі жолдың
  құлпы ашылғанша күтеді де, статус енді `pending` болмағандықтан
  `409 Conflict` алады.
- **Бір студент — бір белсенді өтініш**: `pending`/`manager_review`/
  `needs_correction` статусындағы өтінішкезінде екінші өтініш жасауға
  болмайды (DB-де partial unique index + сервис деңгейінде тексеріс).
  Сонымен қатар, студент қазірдің өзінде бір бөлмеде тұрса (`room_residents`
  жазбасы бар) — жаңа өтініш жасай алмайды.
- **approve** — `room_id` міндетті, 1-ші кезеңдегі `RoomService.AddResident`
  қайта шақырылады (capacity + restriction валидациясы), сол сәтте
  `assigned_room_id` толтырылып, `room_residents`-ке жазба қосылады.
- **reject** / **request_correction** — `comment` міндетті.
- Әр ауысу `application_status_history`-ге жазылады, студентке
  `notifier.Notify()` арқылы in-app хабарлама жіберіледі.

### Рапорт/комиссия дауысы (кезең 3)

```
pending_committee → approved (барлық дауыс 'approved' болса, барлығы дауыс бергеннен кейін)
pending_committee → rejected (кем дегенде бір дауыс 'rejected' болса, барлығы дауыс бергеннен кейін)
rejected → (revise) → жаңа reports жазбасы, previous_report_id = ескі report.id
```

- **Дауыс саны ережесі — unanimous**: `approved` болу үшін комиссияның
  **барлық** мүшесі 'approved' деп дауыс беруі керек. Қорытынды тек
  барлық мүше дауыс бергеннен кейін шығарылады (жартылай дауыспен ертерек
  шешім қабылданбайды); сол сәтте кем дегенде біреуі 'rejected' болса —
  `report.status='rejected'`. Бұл — спекте "TODO" деп белгіленген жердегі
  нақтыланған ереже (пайдаланушымен келісілген).
- **POST /reports** — `application_ids`-тың әрқайсысы `status='approved'`
  болуын және басқа `pending_committee` рапортта жоқтығын
  `SELECT ... FOR UPDATE` арқылы құлыптап тексереді (`applications`
  кестесінің жолдарын құлыптау — партиал unique index/CHECK бұл екі
  ережені DB деңгейінде толық өрнектей алмайды, себебі басқа кестенің
  мәніне тәуелді). Committee_votes-қа сол сәттегі барлық
  `committee_member` үшін `decision=NULL` жол жасалады, әрқайсысына
  notification жіберіледі.
- **PATCH /reports/{id}/vote** — тек `pending_committee` рапортта, тек
  өз дауысын. Дауыс құлыпталған рапорт жолымен (`WithVoteLock`) бір
  транзакцияда есептеледі — екі мүше қатар дауыс берсе, екіншісі
  біріншісі аяқталғанша күтеді.
- **POST /reports/{id}/revise** — тек `status='rejected'` рапортта.
  Ескі рапорттағы, жаңа тізімде жоқ өтініштер `applications.status='rejected'`
  болып қойылады (`application_status_history`-ге "Комиссия
  мақұлдамағаннан кейін менеджер алып тастады" деп жазылады). Жаңа
  рапорт **сол шаблонмен**, таза (`decision=NULL`) дауыспен құрылады.
- **GET /reports/{id}** — кез келген аутентификацияланған пайдаланушыға
  оқуға қолжетімді, тек `committee_member` дауыс бере алады.
- **GET /reports/{id}/export** — толық document generation (докх/PDF)
  бұл кезеңде жоқ; endpoint тек JSON түрінде шаблон `file_url`-ін және
  рапорттағы студенттер тізімін (аты-жөні, email, телефон, бөлме) қайтарады.
- Report notification-дары үшін `notifications.type` enum-ына жаңа
  `'report_review'` мәні қосылды (жеке миграция арқылы — ескі
  `application_status_changed`/`document_requested` бір өтінішке
  байланысты, ал рапорт бүкіл топқа қатысты).

### Келісімшарт → төлем → орналастыру → шығу (кезең 4)

```
report.status='approved' → contracts автоматты құрылады (status='sent')
sent → accepted (payment жасалады, status='pending') | declined (application → rejected)
sent → awaiting_manager_decision (мерзім өткенде, background job/қолмен — ӘЛІ application-ды өзгертпейді)
awaiting_manager_decision → expired (manager action=void → application → rejected)
awaiting_manager_decision → sent (manager action=extend, new_deadline)
payment: pending → submitted → confirmed (application → 'settled') | rejected (қайта submit ете алады)
exit_requests: pending → approved (moved_out_at=now()) | rejected
```

- **⚠️ Маңызды түзету (2-ші кезеңмен қайшылық)**: 2-ші кезеңде
  `PATCH /applications/{id}/decision` (action=approve) ІШІНДЕ
  `RoomService.AddResident` шақырылып, `room_residents`-ке жазба
  ҚАЗІРДІҢ ӨЗІНДЕ approve сәтінде қосылады. Сондықтан 4-ші кезеңде
  `PATCH /payments/{id}/confirm` **жаңа** `room_residents` жазбасын
  ҚОСПАЙДЫ (unique constraint бұзылар еді) — тек
  `applications.status='settled'` етіп қояды. Керісінше, келісімшарт
  `declined`/`expired` болса немесе (болашақта) төлем түпкілікті
  қабылданбаса, сол студенттің белсенді `room_residents` жазбасы
  автоматты жабылады (`moved_out_at=now()`), орны босайды.
- **Auto-contract hook**: "рапорт approved болған сәтте автоматты
  келісімшарт жасау" логикасы 3-ші кезеңдегі `ReportService.Vote()`
  ішіне шағын, міндетті емес hook ретінде қосылды
  (`ReportService.SetOnApproved`, `main.go`-да
  `contractService.OnReportApproved`-ке байланған). Contract жасау
  `application_id` бойынша idempotent (`CreateIfNotExists`) — сол
  студент басқа рапортта қайта пайда болса, қайталанбайды.
- **Contract.file_url** нақты .docx/PDF generation орнына рапорттың
  байланысты шаблонының (`report_templates.file_url`) көшірмесі
  ретінде толтырылады.
- **PATCH /contracts/{id}/respond** — тек `status='sent'` және
  `now() < response_deadline` болғанда. `accept` — `payments` жазбасын
  автоматты жасайды, сомасы `dormitories.price_per_semester`-ден
  алынады (орнатылмаса — `400`). `decline` — `applications.status
  ='rejected'` + бөлмені босату.
- **POST /payments/{id}/submit** — `contract.status='accepted'`
  болғанда ғана, қайта-қайта шақыруға болады (мысалы алдыңғы чек
  `rejected` болса).
- **PATCH /payments/{id}/confirm** — `confirm` кезінде
  `applications.status='settled'` етіп қояды (жаңа enum мәні,
  `application_status_history`-ге "Төлем расталды" деп жазылады).
  **Ескерту (фронтенд-3 сұрауы бойынша тексерілді)**: `reject`
  әрекетінде себеп/comment өрісі жоқ — `Payment` доменінде
  (`internal/domain/payment.go`) тек `Status`/`ConfirmedBy`/`ConfirmedAt`
  бар. Студентке көрсетілетін жалғыз түсініктеме —
  `notifier`-мен жіберілетін тұрақты мәтін ("Сіздің төлеміңіз
  расталмады, чекті қайта жүктеңіз."), ол `PaymentService.
  notifyStudentPaymentDecision`-де хардкодталған. Фронтенд осы мәтінді
  қайталайды (backend-тен қайта сұрамай), себебі ол әрдайым бірдей.
- **POST /exit-requests** — студенттің өз белсенді `room_residents`
  жазбасы бойынша (`moved_out_at IS NULL`) автоматты табылады, бір
  мезгілде бір ғана `pending` шығу өтініші бола алады (partial unique
  index). `approve` — `RoomService`/`RoomRepository.MoveOutResident`
  қайта пайдаланылып, бөлме босатылады.

### ⚠️ Мерзімі өткен келісімшарт логикасы дұрысталды (кезең 5, түзету A)

4-ші кезеңде response_deadline өтсе, контракт автоматты `expired` болып,
өтініш те автоматты `rejected` болатын. **Бұл қате болатын** — спекте
бұл тек менеджердің рұқсатымен болу керек делінген. Түзетілген нұсқа:

- `ContractService.FlagOverdueContracts` (ескі `ExpireOverdue`-дың
  орнына) — `response_deadline` өткен `sent` контракттарды тек
  `awaiting_manager_decision`-ге ауыстырады. **Ешбір application/
  room_residents өзгермейді.**
- Менеджер оларды `GET /api/v1/contracts?status=awaiting_manager_decision`
  арқылы көреді.
- `PATCH /api/v1/contracts/{id}/manager-decision`:
  - `action=void` → `status='expired'`, `applications.status='rejected'`
    (`application_status_history`-ге "Мерзімде жауап бермегендіктен
    менеджер өтінішті жойды" деп жазылады), студенттің белсенді
    `room_residents` жазбасы жабылады (`moved_out_at=now()`).
  - `action=extend`, `new_deadline` міндетті → `status='sent'`-ке
    қайта оралады, `response_deadline` жаңарады, `reminder_sent_at`
    тазаланады (жаңа мерзімге жаңа ескерту циклі).

### Response deadline ескертуі (кезең 5, түзету C)

`ContractService.RemindApproachingDeadline` — `response_deadline`-ге
дейін `CONTRACT_REMINDER_HOURS_BEFORE_DEADLINE` (default 24) сағат
қалған, әлі `status='sent'` контракттар бойынша барлық admin/manager
пайдаланушыларға notification жібереді. Бір контрактқа тек бір рет
жіберіледі (`contracts.reminder_sent_at`).

Флаг қою (A) мен ескерту (C) екеуі де сол бір фондық
`time.Ticker`/`POST /admin/contracts/expire-check` шақыруында бірге
орындалады (`ContractHandler.ExpireCheck` екеуін де шақырып,
`{flagged_count, reminded_count}` қайтарады).

### Жатақхана/бөлме ауыстыру (кезең 5, қосымша B)

- **POST /transfer-requests** — тек **settled** студент (`room_residents`-те
  `moved_out_at IS NULL` жазбасы бар) және оның шешілмеген
  (`pending`/`needs_correction`) application-ы жоқ болса ғана. Бір
  студентте бір мезгілде тек бір `pending` transfer_request бола алады
  (partial unique index). `requested_dormitory_id`/`requested_room_id`
  — студенттің таңдауы бойынша ерікті кеңестер ғана, түпкілікті
  шешімді менеджер қабылдайды.
- **PATCH /transfer-requests/{id}/decision** — `action=approve`,
  `room_id` міндетті:
  1. студенттің қазіргі белсенді `room_residents` жазбасы жабылады
     (`RoomRepository.MoveOutResident`);
  2. жаңа бөлмеге 1-ші кезеңдегі `RoomService.AddResident` арқылы
     қосылады (capacity/restriction валидациясы қайта пайдаланылады);
  3. екеуі де сәтті болғанда ғана `transfer_requests.status='approved'`
     болады — жаңа бөлме валидациядан өтпесе, өтініш `pending` күйінде
     қалады (ескі бөлме жабылып қойса да, `pending` — менеджер басқа
     бөлме таңдап қайта көре алады деген белгі).
  Ескі бөлме мен жаңа бөлме — **бір транзакцияда емес** (2 бөлек
  repository шақыруы), алдыңғы кезеңдерде де кездескен сол баламалы
  trade-off.
  `action=reject`, `comment` міндетті.

## Auth және RBAC

- `POST /api/v1/auth/register` — тек student үшін self-registration.
  `iin` (ЖСН, 12 таңбалы сан, бірегей) міндетті өріс. Тіркелген аккаунт
  бірден жұмыс істемейді — `approval_status='pending'` күйінде жасалады,
  токен қайтармайды
- `POST /api/v1/auth/login` — access (қысқа мерзімді JWT) + refresh
  (ұзақ мерзімді, DB-де хэші сақталған) token қайтарады. `role=student`
  болса, `approval_status != 'approved'` кезінде 403 қайтарады
  ("тіркелуіңіз әлі менеджердің растауын күтуде" / "қабылданбады") —
  admin/manager/committee_member үшін бұл тексеріс жоқ (олар тек admin
  арқылы, әрдайым `approved` етіп жасалады)
- `GET /api/v1/admin/students/pending` — **admin немесе manager**: растауды
  күтіп тұрған студенттер тізімі
- `PATCH /api/v1/admin/students/{id}/approval` — **admin немесе manager**:
  `{"action": "approve"|"reject"}`. `reject` аккаунтты өшірмейді, тек
  логинді мәңгі бұғаттайды (басқа "reject" ағындарымен бірдей — мыс.
  өтініштер де өшірілмейді)
- `POST /api/v1/auth/refresh` — refresh token-ды rotate етеді (ескісі revoke)
- `POST /api/v1/auth/logout` — refresh token-ды revoke етеді
- Admin/Manager/CommitteeMember пайдаланушыларын тек **admin**
  `POST /api/v1/admin/users` арқылы тіркей алады
- Рөл/chairperson тағайындау (`PATCH .../role`, `PATCH .../chairperson`)
  — тек **admin** (Manager-де бұл құқық жоқ). Chairperson маршруты
  нақтырақ: `PATCH /api/v1/admin/committee-members/{id}/chairperson`
  (`/admin/users/{id}/chairperson` емес — бар болғаны осы)
- `GET /api/v1/admin/users?role=` — **admin немесе manager** (кезең 4
  фронтенд-і сұрауы бойынша қосылған; бұрын тек `ListByRole`-ды қатты
  кодталған `GET /admin/committee-members` арқылы ғана шақыруға болатын,
  жалпы пайдаланушылар тізімін алатын endpoint мүлдем болмаған).
  Тіркеу/рөл өзгерту әрекеттерінен айырмашылығы — бұл тек оқу, сондықтан
  manager-ге де ашық
- Dormitory/Room/Benefit CRUD — **admin немесе manager**
- Оқу (`GET`) endpoint-тері — кез келген аутентификацияланған пайдаланушы
- Студент өз профилін (`/students/{id}/profile`) тек өзі немесе
  admin/manager өзгерте алады

### Application/Notification endpoint-тері (кезең 2)

**Student:**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| POST | `/api/v1/applications` | жаңа өтініш жасау |
| GET | `/api/v1/applications/my` | өз өтініштерім |
| GET | `/api/v1/applications/{id}` | толық ақпарат (өтініш + құжаттар + тарих) — меншік құқығы тексеріледі, тек өз өтінішін көре алады (кезең 2, фронтенд-2 тарапынан сұралған түзету: бастапқыда бұл маршрут тек admin/manager үшін ашық болатын) |
| PATCH | `/api/v1/applications/{id}` | тек `needs_correction`-де, тек өзінікін өзгерту → `pending`-ге қайтады |
| POST | `/api/v1/applications/{id}/documents` | құжат қосу (тек `file_url` қабылданады) |
| GET | `/api/v1/notifications` | өз хабарламаларым |
| PATCH | `/api/v1/notifications/{id}/read` | оқылды деп белгілеу |

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/applications?status=pending` | кезекті сүзгімен көру |
| GET | `/api/v1/applications/{id}` | толық ақпарат — жоғарыдағымен бір ғана endpoint, admin/manager кез келген өтінішті көре алады |
| PATCH | `/api/v1/applications/{id}/decision` | `{action: approve\|reject\|request_correction, room_id?, comment?}` |

### Report/Committee endpoint-тері (кезең 3)

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| POST | `/api/v1/uploads` | `multipart/form-data` (`file` өрісі) — файлды серверге сақтайды, абсолют URL қайтарады (кейін `report-templates`-тің `file_url`-і ретінде қолданылады; frontend-тегі "компьютерден таңдау" талабы бойынша қосылған, бұрын тек сыртқы URL қолмен енгізілетін) |
| POST | `/api/v1/report-templates` | шаблон жүктеу (`name`, `file_url`) |
| GET | `/api/v1/report-templates` | шаблондар тізімі |
| POST | `/api/v1/reports` | `{template_id, application_ids}` — жаңа рапорт, комиссияға жіберіледі |
| GET | `/api/v1/reports?status=pending_committee` | рапорттар тізімі сүзгімен |
| POST | `/api/v1/reports/{id}/revise` | `{application_ids}` — тек `rejected` рапортта, жаңа рапорт жасайды |
| GET | `/api/v1/reports/{id}/export` | шаблон `file_url` + студенттер тізімі (JSON) |

**Committee (кез келген комиссия мүшесі, соның ішінде chairperson):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| PATCH | `/api/v1/reports/{id}/vote` | `{decision: approved\|rejected, reason?}` |

**Кез келген аутентификацияланған пайдаланушы:**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/reports/{id}` | рапорт + студенттер + әр мүшенің дауысы |

### Contract/Payment/Exit-request endpoint-тері (кезең 4)

**Student:**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/contracts/my` | өз келісімшарттарым (фронтенд-3 сұрауы бойынша қосылған — бастапқыда болмаған, `ContractRepository.ListByStudent` — `applications.student_id` арқылы JOIN) |
| PATCH | `/api/v1/contracts/{id}/respond` | `{action: accept\|decline}` |
| GET | `/api/v1/payments/my` | өз төлемдерім (фронтенд-3 сұрауы бойынша қосылған, сол сияқты JOIN арқылы `contracts`→`applications`) |
| POST | `/api/v1/payments/{id}/submit` | `{receipt_file_url}` |
| POST | `/api/v1/exit-requests` | `{reason?}` — өз белсенді бөлмесі бойынша |
| GET | `/api/v1/exit-requests/my` | өз шығу өтініштерім |

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/payments?status=submitted` | төлемдер тізімі сүзгімен (кезең 6 фронтенд сұрауы бойынша қосылған — бұрын мүлдем жоқ болатын, тек `/payments/my` мен `/contracts/{id}/payment` бар еді) |
| PATCH | `/api/v1/payments/{id}/confirm` | `{action: confirm\|reject}` |
| POST | `/api/v1/admin/contracts/expire-check` | overdue флаг қою + deadline ескертулерін қолмен іске қосу |
| GET | `/api/v1/contracts?status=awaiting_manager_decision` | манагер шешімін күтетін келісімшарттар (кезең 5) |
| PATCH | `/api/v1/contracts/{id}/manager-decision` | `{action: void\|extend, new_deadline?}` (кезең 5) |
| GET | `/api/v1/exit-requests?status=pending` | шығу өтініштері тізімі сүзгімен |
| PATCH | `/api/v1/exit-requests/{id}/decision` | `{action: approve\|reject, comment?}` |

**Кез келген аутентификацияланған пайдаланушы (иесі немесе admin/manager):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/applications/{id}/contract` | сол өтініштің келісімшарты |
| GET | `/api/v1/contracts/{id}/payment` | сол келісімшарттың төлемі |
| GET | `/api/v1/exit-requests/{id}` | бір шығу өтінішінің толық ақпараты |

### Room transfer endpoint-тері (кезең 5)

**Student:**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| POST | `/api/v1/transfer-requests` | `{requested_dormitory_id?, requested_room_id?, reason?}` |
| GET | `/api/v1/transfer-requests/my` | өз ауыстыру өтініштерім |

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/transfer-requests?status=pending` | ауыстыру өтініштері тізімі сүзгімен |
| PATCH | `/api/v1/transfer-requests/{id}/decision` | `{action: approve\|reject, room_id?, comment?}` |

**Кез келген аутентификацияланған пайдаланушы (иесі немесе admin/manager):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/transfer-requests/{id}` | бір ауыстыру өтінішінің толық ақпараты |

### Residence endpoint-і (фронтенд-3 сұрауы бойынша қосылған)

`GET /api/v1/students/{id}/residence` — иесі не admin/manager
(`canAccessStudentResource`, `user_handler.go`-дағы бармен бірдей). Жауабы:
`{room_id, dormitory_id, room_number, capacity, moved_in_at}`, белсенді
`room_residents` жазбасы жоқ болса — `404`.

Бұл endpoint қосылғанға дейін студенттің қазіргі бөлмесін табатын **ешбір
жол болмаған**: `applications.assigned_room_id` өрісі базадан оқылады, бірақ
кодтың ешбір жерінде жазылмайды (әрдайым `null`); нақты орналасу тек
`room_residents` кестесінде, ал оны оқитын `RoomRepository.
GetActiveResidentByStudent` тек ішкі сервистерде (`exit_request_service.go`,
`transfer_request_service.go`) қолданылған, HTTP-қа шығарылмаған. Жаңа
`RoomService.GetActiveResidence` осы репозиторий әдісін қайта пайдаланып,
`RoomHandler.GetMyResidence`-ке қосады.

Толық маршрут тізімі — `internal/http/router.go`.

## Іске қосу

### 1. .env дайындау

```bash
cp .env.example .env
# JWT_SECRET пен DATABASE_URL-ды өзгертіңіз
```

| Айнымалы | Сипаттама | Default |
|---|---|---|
| `SERVER_PORT` | HTTP сервер порты | `8080` |
| `DATABASE_URL` | Postgres DSN | — (міндетті) |
| `JWT_SECRET` | JWT қол қою құпиясы | — (міндетті) |
| `ACCESS_TOKEN_TTL_MINUTES` | access token өмір сүру мерзімі | `15` |
| `REFRESH_TOKEN_TTL_DAYS` | refresh token өмір сүру мерзімі | `30` |
| `CONTRACT_RESPONSE_DEADLINE_DAYS` | келісімшартқа жауап беру мерзімі (күн) | `7` |
| `CONTRACT_EXPIRY_CHECK_INTERVAL_MINUTES` | фондық "overdue флаг қою + ескерту" тексерісінің жиілігі | `60` |
| `CONTRACT_REMINDER_HOURS_BEFORE_DEADLINE` | deadline-ге дейін неше сағат қалғанда менеджерге ескерту жіберу | `24` |
| `UPLOAD_DIR` | `POST /uploads` файлдарды сақтайтын жергілікті папка (`/api/v1/uploads/`-тен статикалық түрде беріледі) | `./uploads` |

### 2. Миграцияларды қолдану

`golang-migrate` CLI құралын бір рет орнатыңыз:

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

Содан кейін:

```bash
migrate -database "$DATABASE_URL" -path migrations up
# Артқа қайту үшін:
migrate -database "$DATABASE_URL" -path migrations down 1
```

### 3. Серверді іске қосу

```bash
go mod download
go run ./cmd/api
```

### 4. Бірінші admin пайдаланушысын жасау

Self-registration тек student үшін жұмыс істейді, сондықтан admin
`cmd/seed` арқылы жасалады (немесе бар болса — жаңартылады, яғни қайта
іске қосуға қауіпсіз):

```sh
go run ./cmd/seed -email admin@example.com -password Admin123
```

Флагтардың бәрінің әдепкі мәні бар (`-email` → `studhouse@korkyt.kz`,
`-password` → `Admin123`, `-full-name` → `Админ`), сондықтан флагсыз да
іске қосуға болады. Егер берілген email базада бұрыннан бар болса, тек
құпия сөзі мен рөлі (`admin`-ге) жаңартылады, жаңа жол қосылмайды.
Docker Compose ортасында бинарник контейнерге бірге бумаланады:

```sh
docker compose exec backend ./seed -email admin@example.com -password Admin123
```

### 5. Фондық тапсырма (overdue флаг қою + deadline ескерту)

Бөлек cron/worker процесі қажет емес — `go run ./cmd/api` іске қосылған
сәтте `startContractExpiryChecker` (`cmd/api/main.go`) сервермен бірге
`time.Ticker`-мен (`CONTRACT_EXPIRY_CHECK_INTERVAL_MINUTES`, default
60 минут) фонда жұмыс істей бастайды және әр тик сайын екеуін де
шақырады: `ContractService.FlagOverdueContracts` (мерзімі өткен `sent`
контракттарды `awaiting_manager_decision`-ге ауыстырады — **application-ды
өзгертпейді**) және `ContractService.RemindApproachingDeadline`
(`CONTRACT_REMINDER_HOURS_BEFORE_DEADLINE` ішінде қалған контракттар
бойынша менеджерлерге ескерту). Сервер тоқтағанда бірге тоқтайды.

Cron/systemd timer сияқты сыртқы жоспарлаушы қолданатын ортада (мысалы
контейнерді минутына бір рет қайта іске қоспай, бөлек тексеру керек
болса) дәл сол екі әдісті бір рет орындайтын
`POST /api/v1/admin/contracts/expire-check` (admin/manager) endpoint-ін
шақыруға болады — `{"flagged_count": N, "reminded_count": M}` қайтарады.
Екеуі де идемпотентті, сондықтан ticker пен қолмен шақыруды бірге
қосу қауіпсіз.

## Кейінгі кезеңдерге қалдырылғандар

"Кері байланыс күту уақыты" логикасы (жалпы SLA/eskalation ережелері)
осы кезеңдердің ешқайсысында жоқ. Нақты .docx/PDF генерациясы (шаблон
placeholder-ларын студент деректерімен ауыстыру) жасалмады —
`GET /reports/{id}/export` тек JSON қайтарады, `contracts.file_url` —
рапорт шаблонының көшірмесі ғана. Нақты төлем шлюзі (payment gateway)
интеграцияланбаған — тек чек файлын (`receipt_file_url`) қабылдап,
менеджер қолмен растайды/қабылдамайды. Нақты email/SMTP/SMS
интеграциясы жоқ (`internal/service/notifier` тек DB-ге жазып, логқа
шығарады). Файл сақтау инфрақұрылымы (S3/MinIO/disk) орнатылмаған —
`application_documents`/`report_templates` тек frontend-тен келген
`file_url`-ды қабылдайды. `student_benefits` кестесі тек room
restriction валидациясы үшін минимал "студентте льгота бар" жазбасын
сақтайды. Chairperson-ге ерекше салмақты дауыс құқығы жоқ — ол
`committee_member` ретінде тең дауыс береді.

Білуге тиіс шектеу: `ExitRequestService.Decide` мен
`TransferRequestService.Decide`-та room_residents-ті жабу/қосу —
өз статус-жаңарту транзакциясының сыртында, бөлек repository шақырулары
(бір DB транзакциясында емес). `TransferRequestService.Decide` бұл
тәуекелді азайту үшін нақты бөлме ауыстыруды (ескі жабу + жаңа қосу)
transfer_request-тің ӨЗ статусын 'approved' етіп белгілеуден БҰРЫН
орындайды — сол арқылы жаңа бөлме валидациядан өтпей қалса, өтініш
дұрыс "pending" күйінде қалады (жалған "approved" болмайды), бірақ
ескі бөлменің дереу жабылуы мен жаңасының қосылуы арасындағы өте тар
сәт әлі де бір транзакция емес — алдыңғы кезеңдерде де кездескен сол
баламалы trade-off (phase 1/2 repository интерфейстерін өзгертпеу үшін).
