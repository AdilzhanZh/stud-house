# Student House

Қорқыт Ата атындағы Қызылорда университетінің жатақхана басқару жүйесі.

- [`backend/`](backend/) — Go + PostgreSQL API (толық құжаттама: [backend/README.md](backend/README.md))
- [`frontend/`](frontend/) — React + Vite студент порталы (толық құжаттама: [frontend/README.md](frontend/README.md))

## Docker арқылы іске қосу

Бүкіл жүйе (`postgres` + `migrate` + `backend` + `frontend`) бір
`docker-compose.yml` арқылы көтеріледі. Backend пен frontend екеуі де
жеке Dockerfile-мен өз папкаларында (`backend/Dockerfile`,
`frontend/Dockerfile`), ал `docker-compose.yml` мен `.env.docker`
репо түбірінде тұрады.

### 1. Env дайындау

```bash
cp .env.docker .env
```

Кемінде `POSTGRES_PASSWORD` пен `JWT_SECRET`-ті нақты мәнге ауыстыр
(production-ге дейін апармасаңыз да, дефолт мәндермен қалдырмаған жөн).

`VITE_API_BASE_URL` frontend image-ін build ету кезінде JS бандлына
тұрақты түрде "күйдіріледі" (Vite-тің жұмыс істеу тәсілі осылай), сол
себепті оны кейін өзгертсеңіз `docker compose up --build frontend`
арқылы қайта build ету керек — контейнерді қайта іске қосу жеткіліксіз.

### 2. Көтеру

```bash
docker compose up --build
```

Реттілік автоматты: `postgres` (healthcheck: `pg_isready`) → `migrate`
(барлық 26 миграцияны қолданып, сәтті аяқталғанда бір реттік job
ретінде шығады) → `backend` (тек `migrate` сәтті аяқталғанда
көтеріледі) → `frontend`. `backend` контейнерінің 8080-порты сыртқа
ашылмайды — тек `app-network` желісі ішінде, `frontend`-тегі nginx
арқылы ғана қолжетімді (браузер тек nginx-пен сөйлеседі, CORS мәселесі
болмайды).

Көтерілгеннен кейін `http://localhost:8080` (немесе `.env`-де
өзгертілген `FRONTEND_PORT`) арқылы ашылады.

### 3. Бірінші admin пайдаланушысын жасау

Backend-тегі self-registration тек `student` рөлі үшін жұмыс істейді
(қараңыз [backend/README.md](backend/README.md) "Бірінші admin
пайдаланушысын жасау"), сондықтан контейнер ішінде осы CLI-мен
bcrypt-хэш шығарып, содан кейін тікелей SQL арқылы енгізу керек:

```bash
docker compose exec backend ./hashpw -password="StrongPass123"
# -> $2a$10$...bcrypt-хэш...

docker compose exec postgres psql -U student_house -d student_house -c \
  "INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ('Admin', 'admin@example.com', '', '<hashpw шыққан хэш>', 'admin');"
```

(`student_house` — `.env.docker`-дегі `POSTGRES_USER`/`POSTGRES_DB`
дефолт мәні; өзгертсеңіз соған сай ауыстыр.)

### 4. Тоқтату

```bash
docker compose down        # деректі сақтап тоқтатады (postgres-data volume қалады)
docker compose down -v     # деректі толығымен өшіріп тоқтатады
```

### Ескертпелер

- **HTTPS/TLS** бұл compose файлында жоқ — production-да nginx/Caddy/
  Cloudflare сияқты сыртқы reverse proxy арқылы TLS terminate жасалады
  деп есептелген.
- **Kubernetes/Helm** осы ауқымдағы жоба үшін артық — `docker compose`
  жеткілікті.
- Frontend image `node:20-alpine` негізінде `npm install` қолданады
  (`npm ci` емес): жобаның `package-lock.json` Windows-та жасалған және
  alpine (musl)/WASM fallback platform-специфик optional dependency
  жазбаларын қамтымайды, сол себепті `npm ci`-дің қатаң lockfile-сәйкестік
  тексерісі сәтсіз аяқталады.
