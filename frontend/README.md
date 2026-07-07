# Student House — фронтенд (кезең 1-6: толық функционалдық қамту)

Backend-тегі auth/RBAC/profile/application/notification/contract/payment/
exit-request/transfer-request/dormitory/room/benefit/user-management/report
мүмкіндіктеріне арналған React SPA. Барлық 3 рөл (student, admin/manager,
committee_member) толық қамтылған.

- **Кезең 1**: Login/Register/Profile (gender/course)
- **Кезең 2**: Жатақханалар тізімі, өтініш беру, өтініштер тізімі/толық
  көрінісі (статус тарихы + құжаттар), хабарламалар
- **Кезең 3**: Келісімшартты қабылдау/бас тарту, төлем чегін жүктеу, settled
  студентке арналған "Менің орналасуым" беті (шығу/ауыстыру сұраныстары)
- **Кезең 4**: Admin/Manager панелінің 1-ші бөлігі — жатақхана/бөлме/льгота
  CRUD, пайдаланушы тіркеу, рөл тағайындау
- **Кезең 5**: Admin/Manager панелінің 2-ші бөлігі — өтініш кезегі
  (approve/reject/request_correction), рапорт шаблондары/құрастыру/тізім/
  выгрузка
- **Кезең 6**: Admin/Manager панелінің соңғы бөлігі (келісімшарт
  қадағалауы, төлем растауы, exit/transfer сұраныстары шешу) + комиссия
  мүшесінің дауыс беру экраны (жаңа `committee_member`-ге арналған
  `CommitteeLayout`)

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
                    transferRequestApi, residenceApi, roomApi, benefitApi,
                    adminUserApi, applicationAdminApi, reportTemplateApi,
                    reportApi, contractAdminApi, paymentAdminApi,
                    exitRequestAdminApi, transferRequestAdminApi (кезең 6)
  components/     — қайта пайдаланылатын UI (Button, Input, Select, Card,
                    Alert, StatusBadge, ContractStatusBadge, ConfirmDialog,
                    ReportStatusBadge, ReportSummaryCards (кезең 6 —
                    ReportDetailPage/CommitteeVotePage арасында ортақ))
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
    admin/
      dormitories/ — DormitoryListPage, DormitoryFormPage,
                     DormitoryDetailPage (кезең 4)
      rooms/       — RoomFormPage (create+edit бір компонентте),
                     RoomResidentsView (кезең 4)
      benefits/    — BenefitListPage, BenefitFormPage (өрістер/құжаттар
                     басқаруымен) (кезең 4)
      users/       — UserListPage, UserRegisterFormPage (admin-only),
                     RoleAssignPage (admin-only) (кезең 4)
      applications/ — ApplicationQueuePage (табтар), ApplicationAdminDetailPage
                     (студент DetailPage-тен бөлек компонент — әрекеттер
                     басқа) (кезең 5)
      reports/     — ReportTemplateListPage, ReportBuilderPage, ReportListPage,
                     ReportDetailPage (кезең 5)
      committee/   — CommitteeReportListPage, CommitteeVotePage (тек
                     committee_member, кезең 6)
      contracts/   — ContractOversightPage (кезең 6)
      payments/    — PaymentReviewPage (кезең 6)
      requests/    — ExitRequestListPage, TransferRequestListPage (кезең 6)
  layouts/        — AuthLayout (Login/Register), DashboardLayout (студент
                    навигациясы), AdminLayout (admin/manager навигациясы,
                    кезең 4, DashboardLayout-тан бөлек), CommitteeLayout
                    (committee_member навигациясы, кезең 6, екеуінен де бөлек)
  routes/         — ProtectedRoute (allowedRoles), RoleBasedRedirect (кезең 4,
                    кезең 6-да committee_member жағдайы қосылды)
  store/          — authStore (zustand), tokenStorage (localStorage көмекшісі)
  types/          — backend DTO-ларына сәйкес TS типтері (index, dormitories,
                    applications, notifications, contracts, payments,
                    exitRequests, transferRequests, residence, rooms,
                    benefits, reports)
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

## Беттер (кезең 4 — admin/manager панелі)

| Маршрут | Сипаттама |
|---|---|
| `/admin/dormitories` | Жатақханалар кестесі: атауы, мекенжайы, сыйымдылық (`X/Y`, `GET .../capacity`), "Өзгерту"/"Бөлмелерін көру" әрекеттері |
| `/admin/dormitories/new`, `/admin/dormitories/{id}/edit` | Жатақхана формасы (name/address/total_capacity/QR URL). Суреттер бөлімі тек өзгерту режимінде көрінеді (dormitory images-тегідей — алдымен сақтау керек, содан кейін URL қосу) |
| `/admin/dormitories/{id}` | Capacity progress bar + бөлмелер кестесі (№, сыйымдылық, тұрғын саны, шектеулер қысқаша) + "Жаңа бөлме" |
| `/admin/dormitories/{dormitoryId}/rooms/new`, `/admin/rooms/{roomId}/edit` | Бөлме формасы: room_number, capacity, жыныс бойынша шектеу (select), курс бойынша шектеу (**checkbox тізімі 1-6**, төменде түсіндірілген) |
| `/admin/rooms/{roomId}/residents` | Тұрғындар тізімі (студент аты `GET /admin/users`-тен ілінеді, moved_in_at күні) |
| `/admin/benefits` | Льготалар тізімі + "Жаңа льгота" |
| `/admin/benefits/new`, `/admin/benefits/{id}/edit` | name/description формасы; өзгерту режимінде — қажетті өрістер мен құжаттардың динамикалық тізімі (қосу/өшіру) |
| `/admin/users` | Пайдаланушылар кестесі, рөл бойынша сүзгі. "Жаңа пайдаланушы тіркеу" түймесі **тек admin-ге** көрінеді |
| `/admin/users/new` | Тіркеу формасы (admin-only маршрут): full_name/email/phone/password/role (`admin`/`manager`/`committee_member` — **student жоқ**, себебі студент өзі `/register`-ден тіркеледі) |
| `/admin/users/{id}/role` | Рөл select + chairperson checkbox (admin-only маршрут). Checkbox тек рөл `committee_member` болғанда белсенді |

Навигация: `AdminLayout` — `DashboardLayout`-тан толық бөлек (Өтініш кезегі/
Жатақханалар/Льготалар/Рапорт шаблондары/Рапорттар/Пайдаланушылар, кезең
5-те толықтырылды). `RoleBasedRedirect` әдепкі бетті рөлге қарай
таңдайды (`admin`/`manager` → `/admin/dormitories`, басқа рөл →
`/dashboard/profile`) — себебі `ProfilePage` тек студентке арналған
(`UserService.GetStudentProfile` admin/manager үшін профиль жазбасы
болмағандықтан қате қайтарады).

## Беттер (кезең 5 — өтініш кезегі + рапорт)

| Маршрут | Сипаттама |
|---|---|
| `/admin/applications` | Табтар: Менеджерді күтуде (`pending`) / Түзетуде (`needs_correction`) / Қабылданды (`approved`) / Қабылданбады (`rejected`). Кесте: студент аты (`GET /admin/users`-тен ілінеді), жатақхана, күні, статус badge |
| `/admin/applications/{id}` | Студент (аты/email/телефон), құжаттар, статус тарихы. Студенттің 2-ші кезеңдегі `ApplicationDetailPage`-інен **бөлек компонент** (`ApplicationAdminDetailPage`) — әрекеттер мүлдем басқа. Тек `status==='pending'` болғанда 3 әрекет (төменде түсіндірілген себеппен `needs_correction`-да жоқ): Қабылдау (бөлме `select`, `GET /dormitories/{id}/rooms` арқылы сүзілген, 409-да қате хабарламасын көрсетіп select ашық қалады), Қабылдамау (comment міндетті), Түзету сұрау (comment міндетті) |
| `/admin/report-templates` | Шаблондар тізімі + жаңа шаблон формасы (name, file_url) |
| `/admin/reports/new` | Шаблон таңдау + approved өтініштер checkbox тізімі (**рапортта әлі жоқтары** — төменде түсіндірілген клиент жақтағы есептеу арқылы сүзілген) → `POST /reports` |
| `/admin/reports` | Кесте: құрылған күні, шаблон атауы, статус badge, студенттер саны (`GET /reports/{id}` арқылы әр рапортқа cross-reference) |
| `/admin/reports/{id}` | Студенттер тізімі (аты/email/телефон — backend-тен дайын келеді, `reportStudentResponse`), комиссия дауыстары (мүше аты + шешімі/себебі/уақыты). `rejected` болса — checkbox арқылы студенттерді қысқарту формасы (`POST /reports/{id}/revise`); `approved` болса — "Выгрузка" (төменде түсіндірілген) |

### Белгілі шектеу: `Decide` тек `status='pending'`-де жұмыс істейді

Спецификацияда "status='pending' немесе 'needs_correction' болғанда 3 әрекет
түймесі" делінген, бірақ backend-тегі `ApplicationService.Decide`
(`internal/service/application_service.go`) тек `app.Status !=
domain.ApplicationPending` болса `409 Conflict` қайтарады — `needs_correction`
таза студенттің өзі `PATCH /applications/{id}` арқылы қайта жібергенде ғана
`pending`-ге оралатын, тек студентке ашық аралық күй. Сондықтан
`ApplicationAdminDetailPage`-те әрекет түймелері тек `status==='pending'`
кезінде көрінеді (сіз таңдаған нұсқа).

### "Рапортта әлі жоқ approved өтініштер" — клиент жақтағы есептеу

Backend-те арнайы `available_for_report` секілді query параметр жоқ —
`ReportService.CreateReport` тек серверде тексереді (сай келмесе `409
Conflict`, "one or more applications are already part of another pending
report"). Сіз таңдаған шешім бойынша (backend өзгеріссіз):
`ReportBuilderPage` `GET /applications?status=approved` +
`GET /reports?status=pending_committee` + әр pending рапорт үшін
`GET /reports/{id}` шақырып, сол рапорттардағы `application_id`-лерді жинап,
approved тізімнен алып тастайды. N+1 сұраныс болса да, pending рапорттар
саны әдетте аз болатындықтан қолайлы.

### "Выгрузка" — JSON blob-download

`GET /reports/{id}/export` (`ReportHandler.Export`) бұл кезеңде нақты құжат
генерациялау орнына **`GetDetail`-мен бірдей JSON қайтарады**
(`h.GetDetail(c)` тікелей шақырылады). Frontend осы JSON-ды браузерге
`Blob`/`URL.createObjectURL` арқылы `.json` файл түрінде жүктейді — бұл
спецификацияның "файлды браузерге жүктеу" талабын нақты генерацияланған
құжат жоқ жағдайда орындайтын ең қарапайым жол. Шаблонның нақты файлы
(`template.file_url`) бөлек сілтеме ретінде рапорт бетінде қолжетімді.

## Беттер (кезең 6 — комиссия дауыс беру + менеджердің соңғы қадағалауы)

| Маршрут | Рөл | Сипаттама |
|---|---|---|
| `/committee/reports` | committee_member | `GET /reports?status=pending_committee` тізімі, әр қатарда "менің дауысым" (`GET /reports/{id}` арқылы cross-reference, ағымдағы `user.id`-ды `votes`-тен іздейді) |
| `/committee/reports/{id}` | committee_member | `ReportSummaryCards` ортақ компоненті арқылы 5-ші кезеңдегі оқу бөлігін қайта пайдаланады (студенттер + дауыстар). Ағымдағы мүшенің дауысы әлі жоқ және `status==='pending_committee'` болғанда ғана "Мақұлдау"/"Мақұлдамау" (соңғысы reason талап етеді) |
| `/admin/contracts` | admin/manager | `GET /contracts?status=awaiting_manager_decision`. Әр қатарда "Мерзімі X өтті" (`formatTimeElapsed`, `deadline.ts`-ке қосымша), "Күшін жою" (`ConfirmDialog` растауымен, `action='void'`) және "Мерзімді ұзарту" (`datetime-local` input, `action='extend'`) |
| `/admin/payments` | admin/manager | `GET /payments?status=submitted` (кезең 6-да қосылған endpoint). Студент аты (`payment→contract→application→student` тізбегі арқылы cross-reference), сома, "Чекті қарау" сілтемесі, "Растау"/"Қабылдамау" |
| `/admin/exit-requests` | admin/manager | `GET /exit-requests?status=pending`. "Мақұлдау"/"Қабылдамау" (comment міндетті) |
| `/admin/transfer-requests` | admin/manager | `GET /transfer-requests?status=pending`. "Мақұлдау" — екі сатылы `select` (жатақхана → сол жатақхананың бөлмелері, `GET /dormitories/{id}/rooms` қайта пайдаланылады — арнайы flat `GET /rooms` жоқ), студент ұсынған `requested_dormitory_id`/`requested_room_id` бар болса әдепкі мән ретінде қойылады. "Қабылдамау" (comment міндетті) |

### Committee/Admin/Manager навигациясы толық бөлек

`CommitteeLayout` (жаңа) — тек "Комиссия рапорттары" сілтемесі, `AdminLayout`
мен `DashboardLayout`-тан толық бөлек. `RoleBasedRedirect`-ке
`committee_member` → `/committee/reports` жағдайы қосылды. `/committee/*`
маршруттары `ProtectedRoute allowedRoles={['committee_member']}` арқылы
қорғалған (4-ші кезеңдегі паттерн қайта қолданылды).

### Backend-ке кезең 6 аясында енгізілген түзету

`GET /api/v1/payments?status=` мүлдем жоқ болатын — тек `/payments/my`
(студент) мен `/contracts/{id}/payment` (бір келісімшарт) бар еді, менеджерге
арналған жалпы төлем кезегі жоқ. Қосылғандар: `PaymentRepository.List(status
*domain.PaymentStatus)`, `PaymentService.List`, `PaymentHandler.List`,
маршрут — **admin немесе manager** (`mgmt` тобында, `GET /contracts` мен бірдей
паттерн). Толық негіздеме — `backend/README.md`.

## Белгілі шектеу: room restrictions "courses"

Спецификацияда бөлме формасында "min_course (nullable number)" делінген,
бірақ нақты backend семантикасы (`internal/domain/room.go`,
`room_service.go`) басқаша: `restrictions.courses` — **рұқсат етілген
курстардың тізімі** (membership check), минимум шегі емес. Сондықтан форма
1-6 курс checkbox тізімі түрінде жасалды (сіз таңдаған нұсқа), min_course
өрісі емес.

## Белгілі шектеу: room resident "броньдалған" күйі

Спецификацияда "moved_in_at NULL болса — броньдалған, әлі көшірілмеген"
делінген, бірақ бұл backend-те мүмкін емес күй: `RoomRepository.
AddResident` `room_id`, `student_id` және `moved_in_at`-ты (DB
`DEFAULT now()`) бір ғана INSERT-те бірге жазады — бөлек "брондау" сатысы
жоқ. `RoomResidentsView` сондықтан `moved_in_at`-ты әрқашан бар күн ретінде
көрсетеді.

## Backend-ке кезең 4 аясында енгізілген түзету

`GET /api/v1/admin/users?role=` мүлдем жоқ болатын — тек `ListByRole`-ды
қатты кодталған рөлмен шақыратын `GET /admin/committee-members` бар еді,
жалпы пайдаланушылар тізімін (rөл сүзгісімен не сүзгісіз) алатын endpoint
болмаған. Қосылғандар: `UserRepository.List(role *domain.Role)`,
`UserService.List`, `UserHandler.List`, маршрут — **admin немесе manager**
(`mgmt` тобында, себебі тек оқу, тіркеу/рөл өзгертуден айырмашылығы бар).
Сонымен қатар: chairperson маршруты нақтылап пайдаланылды —
`PATCH /api/v1/admin/committee-members/{id}/chairperson` (спецификацияда
жазылған `/admin/users/{id}/chairperson` емес, бар болғаны осы). Толық
негіздеме — `backend/README.md`.

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

`ProtectedRoute` компоненті токен жоқ болса `/login`-ге бағыттайды.
`allowedRoles` prop (кезең 1-де дайын тұрған, кезең 4-те алғаш рет
қолданылды): `/admin/*` маршруттары `allowedRoles={['admin','manager']}`
арқылы қорғалған, ал ішінде тағы бір `ProtectedRoute
allowedRoles={['admin']}` — тіркеу/рөл тағайындау беттерін тек admin-ге
қалдырады (manager-ге сол екі бет үшін де `/admin/dormitories`-қа
редирект). Рөлі сәйкес келмесе — 403 бет орнына бар редирект қолданылады
(спецификацияның екі нұсқасының бірі), себебі бұл 1-ші кезеңнен бар
мінез-құлық және оны өзгерту сұралмаған.

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
серверін іске қосып, толық end-to-end сценарийін (студент/admin/manager/
committee_member — барлық 3 рөл) тексеру мүмкін болмады. Тексерілгендер:

- `npm run build` (`tsc -b && vite build`) — таза
- `npx oxlint src` — ескертусіз
- `go build ./... && go vet ./... && gofmt -l .` (backend, кезең 6-дағы
  `GET /payments?status=` қосылуымен бірге) — таза
- Route-конфликт тексеруі (`cmd/routecheck` уақытша, кезең 6-да да қайта
  жүргізілді) — конфликтсіз

Backend қолжетімді ортада `npm run dev` іске қосып, студент ағындарын
(Login/Register/Profile, Dormitories→Application→Notifications,
Contracts→Payment→MyResidence), admin/manager ағынын
(Dormitory→Room→Benefit CRUD, User тіркеу/рөл тағайындау,
Application-queue→decision, Report-template→Builder→List→Detail→revise/
export, Contract-oversight→void/extend, Payment-review→confirm/reject,
Exit/Transfer-request→decision) және committee_member ағынын
(Committee-report-list→Vote) нақты сервермен тексеру ұсынылады.
