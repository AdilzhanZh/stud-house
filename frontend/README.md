# Student House — фронтенд (кезең 1-3: студент порталы)

Backend-тегі auth/RBAC/profile/application/notification/contract/payment/
exit-request/transfer-request мүмкіндіктеріне арналған React SPA. Тек
**студент** рөліне арналған беттер бар. Менеджер/админ панелі — бөлек,
кейінгі кезең.

- **Кезең 1**: Login/Register/Profile (gender/course)
- **Кезең 2**: Жатақханалар тізімі, өтініш беру, өтініштер тізімі/толық
  көрінісі (статус тарихы + құжаттар), хабарламалар
- **Кезең 3**: Келісімшартты қабылдау/бас тарту, төлем чегін жүктеу, settled
  студентке арналған "Менің орналасуым" беті (шығу/ауыстыру сұраныстары)

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
  api/            — axios instance (client.ts) + endpoint функциялары:
                    authApi, profileApi, dormitoryApi, applicationApi,
                    notificationApi, contractApi, paymentApi, exitRequestApi,
                    transferRequestApi, residenceApi
  components/     — қайта пайдаланылатын UI (Button, Input, Select, Card,
                    Alert, StatusBadge, ContractStatusBadge, ConfirmDialog)
  features/
    auth/         — LoginPage, RegisterPage, useAuth, useAuthBootstrap, schemas
    profile/      — ProfilePage
    dormitories/  — DormitoriesPage (кезең 2)
    applications/ — NewApplicationPage, MyApplicationsPage,
                    ApplicationDetailPage, statusHelpers (кезең 2)
    notifications/ — NotificationsPage, useUnreadCount (кезең 2)
    contracts/    — ContractsPage, deadline.ts (кезең 3)
    payments/     — PaymentPage (кезең 3)
    residence/    — MyResidencePage, useIsSettled (кезең 3)
  layouts/        — AuthLayout (Login/Register), DashboardLayout (навигация:
                    Профиль/Жатақханалар/Менің өтініштерім/Келісімшарттарым/
                    Менің орналасуым (шартты)/Хабарламалар)
  routes/         — ProtectedRoute
  store/          — authStore (zustand), tokenStorage (localStorage көмекшісі)
  types/          — backend DTO-ларына сәйкес TS типтері (index, dormitories,
                    applications, notifications, contracts, payments,
                    exitRequests, transferRequests, residence)
```

## Беттер (кезең 2)

| Маршрут | Сипаттама |
|---|---|
| `/dormitories` | Жатақханалар тізімі (карточка + бірінші сурет, бар болса). Белсенді өтініші бар студентке "Өтініш беру" түймесінің орнына ескерту көрсетіледі |
| `/applications/new?dormitory_id=X` | Өтініш беру формасы (тек `notes`; `dormitory_id` — тек оқу үшін) |
| `/applications/my` | Өз өтініштерім, статус badge-мен |
| `/applications/{id}` | Толық көрініс: статус тарихы (timeline), жүктелген құжаттар. `needs_correction` статусында — жаңа құжат қосу формасы (тек URL, төменде ескертілген) және жазбаны жаңарту формасы (`PATCH`, статус `pending`-ге қайтарады) |
| `/notifications` | Хабарламалар тізімі, басқанда оқылды деп белгіленеді. Dashboard сайдбарында оқылмағандар саны 30 секунд сайын polling арқылы жаңарады |

## Беттер (кезең 3)

| Маршрут | Сипаттама |
|---|---|
| `/contracts/my` | Келісімшарттарым тізімі. `status='sent'` болғанда ғана "Қабылдау"/"Бас тарту" (екеуі де `ConfirmDialog` растауын талап етеді); `awaiting_manager_decision` болса — түймесіз ескерту ғана; `response_deadline`-ге дейінгі уақыт `deadline.ts`-те frontend-те шамамен есептеледі |
| `/contracts/{id}/payment` | Тек `contract.status='accepted'` кезінде мазмұнды: жатақхана QR-коды (`GET /dormitories/{id}.payment_qr_code_url`, `contract→application→dormitory` тізбегі арқылы табылады), чек URL-ін жіберу формасы. `rejected` кезінде себебі — төменде түсіндірілген статикалық мәтін |
| `/my-residence` | Тек settled студентке (сайдбарда да, беттің өзінде де `GET /payments/my`-де `confirmed` статус бар-жоғы тексеріледі). Қазіргі жатақхана/бөлме ақпараты + шығу өтінішін беру формасы + ауыстыру сұрауы формасы (жатақхана `select` + себеп). Соңғы екі сұраныстың біреуі `pending` болса — екі форма да жасырылады (5-ші backend кезеңіндегі "бір мезгілде бір белсенді сұраныс" ережесімен үйлесімді frontend-тік шешім) |

## Белгілі шектеу: файл жүктеу

Нақты файл жүктеу (drag-drop upload) инфрақұрылымы жоқ — backend
`application_documents`-те тек URL сақтайды (`FileURL string`), нақты файл
сақтау қызметі (S3/MinIO/disk) жоқ. Сондықтан "Жаңа құжат жүктеу" формасы
тек `document_name` + `file_url` (қолмен енгізілетін сілтеме) қабылдайды —
файл жүктеу қызметі кейінгі кезеңде қосылады.

## Backend-ке кезең 2 аясында енгізілген түзету

`GET /applications/{id}` бастапқыда тек admin/manager рөліне арналған
(`internal/http/router.go`-дағы `mgmt` тобында) болатын — студент өз
өтінішінің толық көрінісін (статус тарихы + құжаттар) ала алмайтын, 403
қайтаратын. `internal/http/handler/application_handler.go`-ға
`canAccessApplication` тексеруі қосылып (admin/manager — кез келгенін,
студент — тек өзінікін), маршрут жалпы `protected` тобына көшірілді
(contract/payment/exit-request/transfer-request endpoint-теріндегі бар
паттернмен бірдей). Толық негіздеме — `backend/README.md`.

## Backend-ке кезең 3 аясында енгізілген түзетулер

Спецификацияда сұралған үш endpoint backend-те мүлдем жоқ болып шықты —
үшеуі де осы кезең аясында қосылды (толық негіздеме — `backend/README.md`):

1. **`GET /contracts/my`** — `ContractRepository.ListByStudent`
   (`applications` арқылы JOIN, себебі `contracts`-та өз алдына
   `student_id` жоқ).
2. **`GET /payments/my`** — сол сияқты, `PaymentRepository.ListByStudent`
   (`contracts`→`applications` арқылы JOIN).
3. **`GET /students/{id}/residence`** — студенттің қазіргі бөлмесін табатын
   алғашқы endpoint. Бұрын мүмкін емес еді:
   `applications.assigned_room_id` базадан оқылады, бірақ ешбір жерде
   жазылмайды (әрдайым `null`); нақты орналасу `room_residents`-те, оны
   оқитын `RoomRepository.GetActiveResidentByStudent` тек ішкі сервистерде
   қолданылған. Жаңа `RoomService.GetActiveResidence` + `RoomHandler.
   GetMyResidence` осыны иесі/admin/manager-ге ашады
   (`canAccessStudentResource` бар тексерумен).

Үшеуі де тек **жаңа код қосу** түрінде жасалды — ешбір бұрынғы
endpoint/логика өзгертілмеді.

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

## Белгілі шектеу: төлем қабылданбау себебі

`Payment` доменінде (`internal/domain/payment.go`) rejection үшін
comment/reason өрісі жоқ — тек `Status`. Backend студентке жіберетін жалғыз
түсініктеме — `PaymentService.notifyStudentPaymentDecision`-де хардкодталған
тұрақты мәтін ("Сіздің төлеміңіз расталмады, чекті қайта жүктеңіз."). Осы
мәтінді `features/payments/PaymentPage.tsx`-те statik жол ретінде
қайталадық (notification-ды қайта сұрамай) — ол әрқашан бірдей болғандықтан
бұл ешбір ақпарат жоғалтпайды.

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
серверін іске қосып, толық end-to-end (нақты login/register/profile/
application/notification/contract/payment/exit-request/transfer-request
сұраныстары) сценарийін тексеру мүмкін болмады. Тексерілгендер:

- `npm run build` (`tsc -b && vite build`) — таза
- `npx oxlint src` — ескертусіз
- `go build ./... && go vet ./... && gofmt -l .` (backend, кезең 2/3-тің
  барлық түзетулерімен бірге) — таза
- Route-конфликт тексеруі (`cmd/routecheck` уақытша) — конфликтсіз

Backend қолжетімді ортада `npm run dev` іске қосып, Login/Register/Profile,
Dormitories→Application→Notifications және
Contracts→Payment→MyResidence(exit/transfer) ағындарын нақты сервермен
тексеру ұсынылады.
