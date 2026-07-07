# Student House — Backend (кезең 1-3: схема + Auth/RBAC + өтініш + рапорт/дауыс)

Қорқыт Ата атындағы Қызылорда университетінің жатақхана басқару жүйесі.

- **Кезең 1**: негізгі дерекқор схемасы (users/dormitories/rooms/benefits)
  мен авторизация/аутентификация (JWT + RBAC).
- **Кезең 2**: «студент өтініш береді → менеджер қарайды» ағыны —
  `applications`, `application_status_history`, `application_documents`,
  `notifications`.
- **Кезең 3** (осы қосымша): «менеджер approved өтініштерден рапорт
  құрастырады → комиссия дауыс береді → рапорт мақұлданады/қабылданбайды»
  ағыны — `report_templates`, `reports`, `report_applications`,
  `committee_votes`.

Келісімшарт, төлем, "кері байланыс күту уақыты" логикасы, нақты
.docx/PDF генерациясы, email/SMTP интеграциясы — 4-ші кезеңде.

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

Chairperson бөлек рөл емес — `committee_member` рөлінің үстіне қосымша
`is_chairperson` флагы (DB CHECK constraint осыны бекітеді).

## Бизнес-логика ескертулері

- **Dormitory capacity progress**: `GET /dormitories/{id}/capacity`
  `total_capacity` мен барлық бөлмелер `capacity`-сының қосындысын
  (`allocated_beds`) қайтарады.
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

## Auth және RBAC

- `POST /api/v1/auth/register` — тек student үшін self-registration
- `POST /api/v1/auth/login` — access (қысқа мерзімді JWT) + refresh
  (ұзақ мерзімді, DB-де хэші сақталған) token қайтарады
- `POST /api/v1/auth/refresh` — refresh token-ды rotate етеді (ескісі revoke)
- `POST /api/v1/auth/logout` — refresh token-ды revoke етеді
- Admin/Manager/CommitteeMember пайдаланушыларын тек **admin**
  `POST /api/v1/admin/users` арқылы тіркей алады
- Рөл/chairperson тағайындау (`PATCH .../role`, `PATCH .../chairperson`)
  — тек **admin** (Manager-де бұл құқық жоқ)
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
| PATCH | `/api/v1/applications/{id}` | тек `needs_correction`-де, тек өзінікін өзгерту → `pending`-ге қайтады |
| POST | `/api/v1/applications/{id}/documents` | құжат қосу (тек `file_url` қабылданады) |
| GET | `/api/v1/notifications` | өз хабарламаларым |
| PATCH | `/api/v1/notifications/{id}/read` | оқылды деп белгілеу |

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
| GET | `/api/v1/applications?status=pending` | кезекті сүзгімен көру |
| GET | `/api/v1/applications/{id}` | толық ақпарат (өтініш + құжаттар + тарих) |
| PATCH | `/api/v1/applications/{id}/decision` | `{action: approve\|reject\|request_correction, room_id?, comment?}` |

### Report/Committee endpoint-тері (кезең 3)

**Manager (admin да істей алады):**
| Метод | Маршрут | Сипаттама |
|---|---|---|
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

Self-registration тек student үшін жұмыс істейді, сондықтан бірінші
admin-ды қолмен, тікелей дерекқорға (немесе уақытша seed script арқылы)
енгізу керек, мысалы:

```sql
INSERT INTO users (full_name, email, phone, password_hash, role)
VALUES ('Admin', 'admin@example.com', '', '<bcrypt-hash>', 'admin');
```

(`password_hash` — `pkg/hasher.HashPassword` арқылы алдын ала есептелген
bcrypt хэші.)

## Кейінгі кезеңдерге қалдырылғандар

Келісімшарт жіберу, төлем QR, "кері байланыс күту уақыты" логикасы — 4-ші
кезеңде. Нақты .docx/PDF генерациясы (шаблон placeholder-ларын студент
деректерімен ауыстыру) жасалмады — `GET /reports/{id}/export` тек JSON
қайтарады. Нақты email/SMTP интеграциясы жоқ (`internal/service/notifier`
тек DB-ге жазып, логқа шығарады). Файл сақтау инфрақұрылымы (S3/MinIO/disk)
орнатылмаған — `application_documents`/`report_templates` тек
frontend-тен келген `file_url`-ды қабылдайды. `student_benefits` кестесі
тек room restriction валидациясы үшін минимал "студентте льгота бар"
жазбасын сақтайды — бұл льгота алу процесінің (approval workflow) толық
емес нұсқасы. Chairperson-ге ерекше салмақты дауыс құқығы жоқ — ол
`committee_member` ретінде тең дауыс береді.
