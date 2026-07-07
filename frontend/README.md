# Student House — фронтенд (кезең 1: студент порталы)

Backend-тегі auth/RBAC/profile мүмкіндіктеріне арналған React SPA. Бұл кезеңде
тек **студент** рөліне арналған Login/Register/Profile беттері бар. Менеджер/
админ панелі — бөлек, кейінгі кезең.

## Стек

- Vite + React + TypeScript
- react-router-dom — роутинг
- axios — HTTP клиент (JWT interceptor + автоматты refresh)
- react-hook-form + zod — форма валидациясы
- Tailwind CSS v4 — стильдеу
- zustand — аутентификация күйі (lightweight, Context+useReducer-ге қарағанда
  бойлерплейті аз, себебі бізге тек жалпақ auth state қажет)

## Іске қосу

```bash
cp .env.example .env   # VITE_API_BASE_URL мәнін backend мекенжайына сәйкестендіру
npm install
npm run dev
```

Backend (`go run ./cmd/api`) бөлек портта (әдепкі `:8080`) жұмыс істеп тұруы
керек — CORS конфигурациясы backend жағында әлі көрсетілмегендіктен, дамыту
кезінде фронтенд пен backend-ті бір хостта (мысалы, reverse proxy арқылы)
немесе backend-те CORS рұқсат етілген түрде жүргізу қажет болуы мүмкін.

## Жоба құрылымы

```
src/
  api/            — axios instance (client.ts) + endpoint функциялары
  components/     — қайта пайдаланылатын UI (Button, Input, Select, Card, Alert)
  features/
    auth/         — LoginPage, RegisterPage, useAuth, useAuthBootstrap, schemas
    profile/      — ProfilePage
  layouts/        — AuthLayout (Login/Register), DashboardLayout (навигация)
  routes/         — ProtectedRoute
  store/          — authStore (zustand), tokenStorage (localStorage көмекшісі)
  types/          — backend DTO-ларына сәйкес TS типтері
```

## Токен сақтау және refresh логикасы

- **access_token** — тек жадыда (`store/authStore.ts`, zustand), беттi
  hard-refresh еткенде жоғалады.
- **refresh_token** — `localStorage`-та (`store/tokenStorage.ts`). Бұл SPA-ге
  стандартты тәжірибе (backend httpOnly cookie қайтармайды, JSON body-де
  беруге мәжбүр), бірақ **XSS осалдығы болса, шабуылшы осы токенді оқи
  алады** — production-да CSP және dependency-аудит арқылы осы тәуекелді
  азайту ұсынылады.
- Backend-те `GET /auth/me` секілді endpoint жоқ, ал access-token JWT-де тек
  `sub` (user id), `role`, `is_chairperson` бар (`pkg/jwtutil/access.go`) —
  `full_name`/`email`/`phone` жоқ. Сондықтан беттi қайта жүктегенде сессияны
  қалпына келтіру үшін соңғы `user` объектісі (құпия сөз хэші ешқашан
  фронтенд-ке жетпейді) `refresh_token`-мен қатар `localStorage`-та
  кэштеледі (`getStoredUser`/`setStoredUser`). Бұл — `useAuthBootstrap.ts`
  жасайтын жалғыз тәсіл, себебі backend осы деректерді қайта сұрауға арналған
  бөлек endpoint ұсынбайды.
- `api/client.ts` ішінде axios response interceptor 401 келгенде бір рет
  `/auth/refresh` шақырады (бірнеше сұраныс бір мезгілде 401 алса, тек біреуі
  ғана refresh жасайды — қалғандары сол promise-ты күтеді), сәтті болса
  бастапқы сұранысты жаңа токенмен қайталайды, сәтсіз болса — сессияны
  тазалап `/login`-ге бағыттайды.

## RBAC (frontend деңгейінде)

`ProtectedRoute` компоненті токен жоқ болса `/login`-ге бағыттайды. `role`
бойынша шектеу үшін `allowedRoles` prop дайын тұр (бұл кезеңде қолданылмайды —
тек студент рөлі бар), келесі кезеңде менеджер/админ панелі қосылғанда
пайдаланылады.

## Белгілі шектеу: "faculty" өрісі

Спецификацияда profile форма `gender, course, faculty` дейді, бірақ
backend-тегі `StudentProfile`-де (`internal/domain/user.go`) faculty өрісі
жоқ — тек `gender` және `course`. Осы жоба бойынша шешім: **faculty өрісі
frontend формасынан толығымен алынып тасталды** (backend қайтармайтын/
қабылдамайтын деректі жинаудың мағынасы жоқ). Егер келешекте backend-ке
faculty қосылса, `types/index.ts`-тегі `StudentProfile` мен
`features/profile/ProfilePage.tsx`-тегі форма сол кезде толықтырылады.

## Тестелу шегі

Бұл ортада жергілікті Postgres/Docker қолжетімді болмағандықтан, backend
серверін іске қосып, толық end-to-end (нақты login/register/profile
сұраныстары) сценарийін тексеру мүмкін болмады. Тексерілгендер:

- `npm run build` (`tsc -b && vite build`) — таза
- `npx oxlint src` — ескертусіз
- `npm run dev` арқылы сервер дұрыс HTML/JS қайтарады (статикалық тексеру)

Backend қолжетімді ортада `npm run dev` іске қосып, Login/Register/Profile
ағынын нақты сервермен тексеру ұсынылады.
