# Student House — Backend (кезең 1: схема + Auth/RBAC)

Қорқыт Ата атындағы Қызылорда университетінің жатақхана басқару жүйесі.
Бұл кезеңде тек негізгі дерекқор схемасы мен авторизация/аутентификация
(JWT + RBAC) жасалды. Өтініш/рапорт/келісімшарт/төлем логикасы келесі
кезеңдерде қосылады.

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

Өтініш (application), рапорт, келісімшарт, хабарлама, төлем логикасы —
осы кезеңде жоқ. `student_benefits` кестесі тек room restriction
валидациясы үшін минимал "студентте льгота бар" жазбасын сақтайды —
бұл льгота алу процесінің (approval workflow) толық емес нұсқасы.
