package apperror

import "regexp"

// Translate returns msg translated to lang ("ru" or "en"), or msg unchanged
// for any other lang (including "kk", the canonical source language every
// apperror.* call site is written in) or for a message this dictionary
// doesn't recognize. This is what makes error responses come back in the
// caller's selected UI language instead of always Kazakh — see
// pkg/reqlang for how the language is read off the request and
// pkg/response for where this gets applied before a response is written.
//
// Keep this in sync with apperror.* call sites across the codebase: when a
// message changes or a new one is added, add/update its entry in
// staticTranslations (or dynamicPatterns for messages built with
// fmt.Sprintf), otherwise the raw Kazakh string leaks through untranslated
// for ru/en callers.
func Translate(msg, lang string) string {
	if lang != "ru" && lang != "en" {
		return msg
	}
	if t, ok := staticTranslations[msg]; ok {
		if lang == "ru" {
			return t.ru
		}
		return t.en
	}
	for _, p := range dynamicPatterns {
		if groups := p.re.FindStringSubmatch(msg); groups != nil {
			return p.translate(lang, groups[1:])
		}
	}
	return msg
}

type translation struct{ ru, en string }

var staticTranslations = map[string]translation{
	"логин немесе құпия сөз қате": {"Неверный логин или пароль", "Incorrect login or password"},
	"refresh token жарамсыз":      {"Недействительный refresh-токен", "Invalid refresh token"},
	"refresh token мерзімі өткен немесе кері қайтарылған": {
		"Срок действия refresh-токена истёк или он отозван",
		"The refresh token has expired or has been revoked",
	},
	"ЖСН (ИИН) 12 таңбалы сан болуы керек": {
		"ИИН должен состоять из 12 цифр",
		"IIN must be a 12-digit number",
	},
	"авторизация қажет":             {"Требуется авторизация", "Authorization required"},
	"атауы және мекенжайы міндетті": {"Название и адрес обязательны", "Name and address are required"},
	"атауы міндетті":                {"Название обязательно", "Name is required"},
	"аты-жөні, email және құпия сөз міндетті": {
		"ФИО, email и пароль обязательны",
		"Full name, email and password are required",
	},
	"аты-жөні, email, ЖСН (ИИН) және құпия сөз міндетті": {
		"ФИО, email, ИИН и пароль обязательны",
		"Full name, email, IIN and password are required",
	},
	"аудитория түрі белгісіз": {"Неизвестный тип аудитории", "Unknown audience type"},
	"ауыстыру сұранысының идентификаторы дұрыс емес": {
		"Неверный идентификатор запроса на перевод",
		"Invalid transfer request identifier",
	},
	"ауыстыру өтініші бойынша шешім бұрын қабылданды": {
		"Решение по запросу на перевод уже принято",
		"A decision on the transfer request has already been made",
	},
	"ауыстыру өтініші табылмады": {"Запрос на перевод не найден", "Transfer request not found"},
	"аяқталған өтінішке құжат қосуға болмайды": {
		"Нельзя добавить документ к завершённой заявке",
		"Cannot add a document to a finalized application",
	},
	"белсенді бөлмеге орналасу жоқ": {"Нет активного заселения в комнату", "No active room residency"},
	"белсенді тұрғын жазбасы табылмады": {
		"Активная запись о проживании не найдена",
		"No active residency record found",
	},
	"бір немесе бірнеше өтініш басқа қаралып жатқан хаттамада бар": {
		"Одна или несколько заявок уже есть в другом рассматриваемом протоколе",
		"One or more applications are already in another protocol under review",
	},
	"бір немесе бірнеше өтініш табылмады": {
		"Одна или несколько заявок не найдены",
		"One or more applications not found",
	},
	"бұл email немесе ЖСН (ИИН) бұрыннан тіркелген": {
		"Этот email или ИИН уже зарегистрированы",
		"This email or IIN is already registered",
	},
	"бұл email-мен пайдаланушы бұрыннан бар": {
		"Пользователь с таким email уже существует",
		"A user with this email already exists",
	},
	"бұл ЖСН (ИИН) бұрыннан тіркелген": {"Этот ИИН уже зарегистрирован", "This IIN is already registered"},
	"бұл ауыстыру сұранысын көруге құқығыңыз жоқ": {
		"У вас нет прав на просмотр этого запроса на перевод",
		"You don't have permission to view this transfer request",
	},
	"бұл жатақхана қазір өтініш қабылдамайды": {
		"Это общежитие сейчас не принимает заявки",
		"This dormitory is not currently accepting applications",
	},
	"бұл жатақханада осы нөмірлі бөлме бұрыннан бар": {
		"В этом общежитии уже есть комната с таким номером",
		"A room with this number already exists in this dormitory",
	},
	"бұл жатақханада әлі бөлме енгізілмеген, өтініш беруге болмайды": {
		"В этом общежитии ещё не добавлены комнаты, подать заявку нельзя",
		"This dormitory has no rooms added yet, applications cannot be submitted",
	},
	"бұл жатақханаға белсенді өтініштер тіркелген, оны өшіру мүмкін емес": {
		"К этому общежитию привязаны активные заявки, удалить его нельзя",
		"This dormitory has active applications linked to it and cannot be deleted",
	},
	"бұл жатақханаға тіркелген өтініштер басқа жазбамен байланысты, оны өшіру мүмкін емес": {
		"Заявки, привязанные к этому общежитию, связаны с другими записями, удалить его нельзя",
		"Applications linked to this dormitory are tied to other records and it cannot be deleted",
	},
	"бұл жатақханаға өтініштер тіркелген, оны өшіру мүмкін емес": {
		"К этому общежитию привязаны заявки, удалить его нельзя",
		"This dormitory has applications linked to it and cannot be deleted",
	},
	"бұл тіркелу әлдеқашан қаралған": {
		"Эта регистрация уже рассмотрена",
		"This registration has already been reviewed",
	},
	"бұл хаттама басқа хаттаманың негізі болғандықтан оны өшіру мүмкін емес": {
		"Этот протокол является основанием для другого протокола, удалить его нельзя",
		"This protocol is the basis of another protocol and cannot be deleted",
	},
	"бұл хаттаманы қарайтын комиссия мүшесі жоқ": {
		"Нет членов комиссии, рассматривающих этот протокол",
		"There are no committee members reviewing this protocol",
	},
	"бұл шаблон қолданыстағы хаттамада пайдаланылып тұр, оны өшіру мүмкін емес": {
		"Этот шаблон используется в действующем протоколе, удалить его нельзя",
		"This template is used in an existing protocol and cannot be deleted",
	},
	"бұл шығу сұранысын көруге құқығыңыз жоқ": {
		"У вас нет прав на просмотр этого запроса на выселение",
		"You don't have permission to view this exit request",
	},
	"бұл құжат жатақханаға бұрын қосылған": {
		"Этот документ уже добавлен к общежитию",
		"This document has already been added to the dormitory",
	},
	"бұл құжат льгота немесе жатақханада қолданылып тұр, оны өшіру мүмкін емес": {
		"Этот документ используется в льготе или общежитии, удалить его нельзя",
		"This document is in use by a benefit or dormitory and cannot be deleted",
	},
	"бұл құжат льготаға бұрын қосылған": {
		"Этот документ уже добавлен к льготе",
		"This document has already been added to the benefit",
	},
	"бұл әрекетті орындауға құқығыңыз жоқ": {
		"У вас нет прав на выполнение этого действия",
		"You don't have permission to perform this action",
	},
	"бұл өтініш басқа жазбамен байланысты, оны өшіру мүмкін емес": {
		"Эта заявка связана с другой записью, удалить её нельзя",
		"This application is linked to another record and cannot be deleted",
	},
	"бұл өтініш бойынша келісімшарт табылмады": {
		"Договор по этой заявке не найден",
		"No contract found for this application",
	},
	"бұл өтінішті көруге құқығыңыз жоқ": {
		"У вас нет прав на просмотр этой заявки",
		"You don't have permission to view this application",
	},
	"бұл өтініштің келісімшартын көруге құқығыңыз жоқ": {
		"У вас нет прав на просмотр договора по этой заявке",
		"You don't have permission to view this application's contract",
	},
	"бөлме идентификаторы дұрыс емес": {"Неверный идентификатор комнаты", "Invalid room identifier"},
	"бөлме нөмірі міндетті":           {"Номер комнаты обязателен", "Room number is required"},
	"бөлме табылмады":                 {"Комната не найдена", "Room not found"},
	"бөлме толығымен толған":          {"Комната полностью заполнена", "The room is at full capacity"},
	"бөлмеге тек студент рөліндегі пайдаланушыны орналастыруға болады": {
		"В комнату можно поселить только пользователя с ролью студента",
		"Only a user with the student role can be placed in a room",
	},
	"ерлерге және қыздарға арналған бөлме сандарын енгізу міндетті": {
		"Необходимо указать количество комнат для юношей и девушек",
		"The number of rooms for male and female students is required",
	},
	"ерлерге, қыздарға және ортаққа арналған бөлмелер қосындысы жалпы бөлме санына тең болуы керек": {
		"Сумма комнат для юношей, девушек и общих должна быть равна общему количеству комнат",
		"The sum of male, female and mixed rooms must equal the total room count",
	},
	"ерлерге/қыздарға/ортаққа арналған бөлме саны теріс сан бола алмайды": {
		"Количество комнат для юношей/девушек/общих не может быть отрицательным",
		"The number of male/female/mixed rooms cannot be negative",
	},
	"жалпы бөлме санын енгізу міндетті": {
		"Необходимо указать общее количество комнат",
		"The total number of rooms is required",
	},
	"жалпы сыйымдылық теріс сан бола алмайды": {
		"Общая вместимость не может быть отрицательным числом",
		"Total capacity cannot be a negative number",
	},
	"жатақхана бағасы белгіленбеген, әкімшіге хабарласыңыз": {
		"Стоимость общежития не установлена, обратитесь к администратору",
		"The dormitory price is not set, please contact the administrator",
	},
	"жатақхана идентификаторы дұрыс емес": {
		"Неверный идентификатор общежития",
		"Invalid dormitory identifier",
	},
	"жатақхана табылмады":     {"Общежитие не найдено", "Dormitory not found"},
	"жатақхана таңдалмаған":   {"Общежитие не выбрано", "No dormitory selected"},
	"жатақхана түрі жарамсыз": {"Недопустимый тип общежития", "Invalid dormitory type"},
	"жауап беру мерзімі өтті, менеджердің шешімі күтілуде": {
		"Срок ответа истёк, ожидается решение менеджера",
		"The response deadline has passed, awaiting the manager's decision",
	},
	"жаңа мерзім болашақта болуы керек": {
		"Новый срок должен быть в будущем",
		"The new deadline must be in the future",
	},
	"жынысы жарамсыз":  {"Недопустимый пол", "Invalid gender"},
	"жынысын таңдаңыз": {"Выберите пол", "Please select a gender"},
	"жүйеде тек бір ғана админ бола алады": {
		"В системе может быть только один админ",
		"The system can only have one admin",
	},
	"келісімшарт идентификаторы дұрыс емес": {
		"Неверный идентификатор договора",
		"Invalid contract identifier",
	},
	"келісімшарт менеджердің шешімін күтіп тұрған жоқ": {
		"Договор не ожидает решения менеджера",
		"The contract is not awaiting a manager's decision",
	},
	"келісімшарт табылмады":     {"Договор не найден", "Contract not found"},
	"келісімшарт қабылданбаған": {"Договор не принят", "The contract has not been accepted"},
	"келісімшартқа жауап бұрын берілген немесе ол енді белсенді емес": {
		"Ответ на договор уже дан, либо он больше не активен",
		"The contract has already been responded to, or it is no longer active",
	},
	"кемінде бір баған таңдалуы керек": {
		"Необходимо выбрать хотя бы один столбец",
		"At least one column must be selected",
	},
	"комиссия мүшелігі тек менеджерге ғана тағайындалады": {
		"Членство в комиссии назначается только менеджеру",
		"Committee membership can only be assigned to a manager",
	},
	"көрсетілген құжат жарамсыз":       {"Указанный документ недействителен", "The specified document is invalid"},
	"льгота идентификаторы дұрыс емес": {"Неверный идентификатор льготы", "Invalid benefit identifier"},
	"льгота табылмады":                 {"Льгота не найдена", "Benefit not found"},
	"льгота құжаты, жатақхана құжаты немесе құжат атауының тек біреуі көрсетілуі керек": {
		"Должен быть указан только один из вариантов: документ льготы, документ общежития или название документа",
		"Only one of benefit document, dormitory document, or document name must be specified",
	},
	"льготаны тек студент рөліндегі пайдаланушыға тағайындауға болады": {
		"Льготу можно назначить только пользователю с ролью студента",
		"A benefit can only be assigned to a user with the student role",
	},
	"көрсетілген email мекенжайы табылмады, тексеріңіз": {
		"Указанный email не найден, проверьте адрес",
		"The specified email could not be found, please check it",
	},
	"мақұлдау үшін бөлме міндетті": {"Для одобрения необходима комната", "A room is required to approve"},
	"оқу деңгейі жарамсыз":         {"Недопустимый уровень образования", "Invalid academic degree"},
	"оқу деңгейін (бакалавриат/магистратура) таңдаңыз": {
		"Выберите уровень образования (бакалавриат/магистратура)",
		"Please select an academic degree (bachelor's/master's)",
	},
	"пайдаланушы идентификаторы дұрыс емес": {
		"Неверный идентификатор пользователя",
		"Invalid user identifier",
	},
	"пайдаланушы табылмады": {"Пользователь не найден", "User not found"},
	"пайдаланушыны жоюға болмайды, ол басқа жазбаларда (өтініш, келісімшарт, дауыс және т.б.) қолданылады": {
		"Пользователя нельзя удалить, он используется в других записях (заявка, договор, голос и т.д.)",
		"The user cannot be deleted — they are referenced in other records (application, contract, vote, etc.)",
	},
	"пайдалануға берілген жылы дұрыс емес, ЖЖЖЖ-АА-КК форматында болуы керек": {
		"Неверный год ввода в эксплуатацию, формат должен быть ГГГГ-ММ-ДД",
		"Invalid commissioning date, format must be YYYY-MM-DD",
	},
	"приоритет салмағы 1 мен 10 аралығында болуы керек": {
		"Вес приоритета должен быть от 1 до 10",
		"Priority weight must be between 1 and 10",
	},
	"профиль (жынысы/курсы) тек студентке ғана орнатылады": {
		"Профиль (пол/курс) устанавливается только студенту",
		"Profile (gender/course) can only be set for a student",
	},
	"рөл бойынша сүзгі жарамсыз": {"Недопустимый фильтр по роли", "Invalid role filter"},
	"рөл жарамсыз":               {"Недопустимая роль", "Invalid role"},
	"рөл фильтрі дұрыс емес":     {"Неверный фильтр роли", "Invalid role filter"},
	"салынған жылы дұрыс емес, ЖЖЖЖ-АА-КК форматында болуы керек": {
		"Неверный год постройки, формат должен быть ГГГГ-ММ-ДД",
		"Invalid construction date, format must be YYYY-MM-DD",
	},
	"сессияның мерзімі аяқталды, қайта кіріңіз": {
		"Сессия истекла, войдите заново",
		"Your session has expired, please log in again",
	},
	"статус фильтрі дұрыс емес": {"Неверный фильтр статуса", "Invalid status filter"},
	"студент бұрыннан бір бөлмеге орналастырылған": {
		"Студент уже поселён в комнату",
		"The student is already placed in a room",
	},
	"студент идентификаторы дұрыс емес": {"Неверный идентификатор студента", "Invalid student identifier"},
	"студент табылмады":                 {"Студент не найден", "Student not found"},
	"студент таңдалмаған":               {"Студент не выбран", "No student selected"},
	"студентте бұл льгота бұрыннан бар": {
		"У студента эта льгота уже есть",
		"The student already has this benefit",
	},
	"студентте бұл льгота жоқ": {"У студента нет этой льготы", "The student does not have this benefit"},
	"студенттер бұл арқылы емес, /auth/register арқылы өздері тіркелуі керек": {
		"Студенты должны регистрироваться самостоятельно через /auth/register, а не таким образом",
		"Students must register themselves via /auth/register, not through this endpoint",
	},
	"сурет идентификаторы дұрыс емес": {"Неверный идентификатор изображения", "Invalid image identifier"},
	"сурет сілтемесі міндетті":        {"Ссылка на изображение обязательна", "Image URL is required"},
	"сурет табылмады":                 {"Изображение не найдено", "Image not found"},
	"сыйымдылық оң сан болуы керек": {
		"Вместимость должна быть положительным числом",
		"Capacity must be a positive number",
	},
	"сіз бұл хаттаманың комиссия мүшесі емессіз": {
		"Вы не являетесь членом комиссии по этому протоколу",
		"You are not a committee member for this protocol",
	},
	"сіз бұрыннан бөлмеде тұрасыз, жаңа өтініш беруге болмайды": {
		"Вы уже проживаете в комнате, подать новую заявку нельзя",
		"You are already residing in a room, a new application cannot be submitted",
	},
	"сізде белсенді бөлмеге орналасу жоқ": {
		"У вас нет активного заселения в комнату",
		"You have no active room residency",
	},
	"сізде белсенді өтінішіңіз бар": {"У вас есть активная заявка", "You already have an active application"},
	"сізде қаралуда тұрған ауыстыру өтініші бар": {
		"У вас есть запрос на перевод на рассмотрении",
		"You have a transfer request under review",
	},
	"сізде қаралуда тұрған шығу өтініші бар": {
		"У вас есть запрос на выселение на рассмотрении",
		"You have an exit request under review",
	},
	"тақырып пен мәтін міндетті": {"Заголовок и текст обязательны", "Title and text are required"},
	"таңдалған бөлме көрсетілген жатақханаға жатпайды": {
		"Выбранная комната не относится к указанному общежитию",
		"The selected room does not belong to the specified dormitory",
	},
	"тек шешім қабылдауды күтіп тұрған немесе қабылданбаған өтінішті өшіруге болады": {
		"Удалить можно только заявку, ожидающую решения, или отклонённую",
		"Only an application awaiting a decision, or a rejected one, can be deleted",
	},
	"тек қабылданбаған хаттаманы қайта өңдеуге болады": {
		"Повторно обработать можно только отклонённый протокол",
		"Only a rejected protocol can be reprocessed",
	},
	"тек өз келісімшартыңызға жауап бере аласыз": {
		"Вы можете отвечать только на свой договор",
		"You can only respond to your own contract",
	},
	"тек өз профиліңізді ғана басқара аласыз": {
		"Вы можете управлять только своим профилем",
		"You can only manage your own profile",
	},
	"тек өз профиліңізді ғана көре аласыз": {
		"Вы можете просматривать только свой профиль",
		"You can only view your own profile",
	},
	"тек өз суретіңізді ғана өзгерте аласыз": {
		"Вы можете изменять только своё изображение",
		"You can only change your own image",
	},
	"тек өз тұрғылықты жеріңізді ғана көре аласыз": {
		"Вы можете просматривать только своё место проживания",
		"You can only view your own residence",
	},
	"тек өз өтінішіңізге құжат жүктей аласыз": {
		"Вы можете загружать документы только к своей заявке",
		"You can only upload documents to your own application",
	},
	"тек өз өтінішіңізді өзгерте аласыз": {
		"Вы можете изменять только свою заявку",
		"You can only edit your own application",
	},
	"тек өз өтінішіңізді өшіре аласыз": {
		"Вы можете удалить только свою заявку",
		"You can only delete your own application",
	},
	"тіркелу өтініші қабылданбады, менеджерге хабарласыңыз": {
		"Заявка на регистрацию отклонена, обратитесь к менеджеру",
		"Your registration request was rejected, please contact the manager",
	},
	"тіркелуді растау тек студенттерге қолданылады": {
		"Подтверждение регистрации применяется только к студентам",
		"Registration approval only applies to students",
	},
	"тіркелуіңіз әлі менеджердің растауын күтуде": {
		"Ваша регистрация ещё ожидает подтверждения менеджера",
		"Your registration is still awaiting the manager's approval",
	},
	"түзету сұрау үшін пікір міндетті": {
		"Для запроса на исправление комментарий обязателен",
		"A comment is required to request a correction",
	},
	"тұрғын идентификаторы дұрыс емес": {"Неверный идентификатор жильца", "Invalid resident identifier"},
	"төраға тек комиссия мүшесіне ғана тағайындалады": {
		"Председателем можно назначить только члена комиссии",
		"Chairperson can only be assigned to a committee member",
	},
	"файл міндетті":           {"Файл обязателен", "File is required"},
	"файл сілтемесі міндетті": {"Ссылка на файл обязательна", "File URL is required"},
	"хабарлама мәтіні міндетті": {
		"Текст сообщения обязателен",
		"Message text is required",
	},
	"хабарлама тым ұзын": {"Сообщение слишком длинное", "The message is too long"},
	"хабарландыру идентификаторы дұрыс емес": {
		"Неверный идентификатор уведомления",
		"Invalid notification identifier",
	},
	"хабарландыру табылмады": {"Уведомление не найдено", "Notification not found"},
	"хаттама енді комиссия қарауында емес": {
		"Протокол больше не находится на рассмотрении комиссии",
		"The protocol is no longer under committee review",
	},
	"хаттама идентификаторы дұрыс емес": {"Неверный идентификатор протокола", "Invalid protocol identifier"},
	"хаттама табылмады":                 {"Протокол не найден", "Protocol not found"},
	"хаттама шаблоны табылмады":         {"Шаблон протокола не найден", "Protocol template not found"},
	"хаттама қабылданбаған емес немесе өтініштердің бірі басқа қаралып жатқан хаттамада бар": {
		"Протокол не является отклонённым, либо одна из заявок уже есть в другом рассматриваемом протоколе",
		"The protocol is not rejected, or one of the applications is already in another protocol under review",
	},
	"чек файлының сілтемесі міндетті": {"Ссылка на файл чека обязательна", "Receipt file URL is required"},
	"шешім жарамсыз":                  {"Недопустимое решение", "Invalid decision"},
	"шығу сұранысының идентификаторы дұрыс емес": {
		"Неверный идентификатор запроса на выселение",
		"Invalid exit request identifier",
	},
	"шығу өтініші бойынша шешім бұрын қабылданды": {
		"Решение по запросу на выселение уже принято",
		"A decision on the exit request has already been made",
	},
	"шығу өтініші табылмады": {"Запрос на выселение не найден", "Exit request not found"},
	"қабылдамау үшін пікір міндетті": {
		"Для отклонения комментарий обязателен",
		"A comment is required to reject",
	},
	"қабылдамау үшін себебі міндетті": {
		"Для отклонения причина обязательна",
		"A reason is required to reject",
	},
	"қажетті құжат табылмады":         {"Требуемый документ не найден", "Required document not found"},
	"құжат атауы міндетті":            {"Название документа обязательно", "Document name is required"},
	"құжат идентификаторы дұрыс емес": {"Неверный идентификатор документа", "Invalid document identifier"},
	"құжат каталогта табылмады":       {"Документ не найден в каталоге", "Document not found in the catalog"},
	"құжат табылмады":                 {"Документ не найден", "Document not found"},
	"құпия сөз кемінде 8 таңбадан тұруы керек": {
		"Пароль должен содержать не менее 8 символов",
		"Password must be at least 8 characters long",
	},
	"ағымдағы құпия сөз қате": {"Текущий пароль неверен", "Current password is incorrect"},
	"Күтпеген қате орын алды, қайталап көріңіз": {
		"Произошла непредвиденная ошибка, попробуйте снова",
		"An unexpected error occurred, please try again",
	},
	"үлгі идентификаторы дұрыс емес": {"Неверный идентификатор шаблона", "Invalid template identifier"},
	"үстіңгі және астыңғы орын саны сыйымдылыққа тең болуы керек": {
		"Количество верхних и нижних мест должно быть равно вместимости",
		"The number of top and bottom beds must equal the capacity",
	},
	"ұзарту үшін жаңа мерзім міндетті": {
		"Для продления новый срок обязателен",
		"A new deadline is required to extend",
	},
	"әдепкі хаттама шаблоны табылмады": {
		"Шаблон протокола по умолчанию не найден",
		"Default protocol template not found",
	},
	"әрекет жарамсыз":                  {"Недопустимое действие", "Invalid action"},
	"өз аккаунтыңызды жоя алмайсыз":    {"Вы не можете удалить свой аккаунт", "You cannot delete your own account"},
	"өтініш идентификаторы дұрыс емес": {"Неверный идентификатор заявки", "Invalid application identifier"},
	"өтініш табылмады":                 {"Заявка не найдена", "Application not found"},
	"өтініш шешім қабылдауды күтіп тұрған жоқ": {
		"Заявка не ожидает решения",
		"The application is not awaiting a decision",
	},
	"өтініштер тізімі міндетті": {"Список заявок обязателен", "A list of applications is required"},
	"өтінішті тек түзету қажет болған кезде ғана өзгертуге болады": {
		"Заявку можно изменить только когда требуется исправление",
		"The application can only be edited when a correction is needed",
	},
}

type dynamicPattern struct {
	re        *regexp.Regexp
	translate func(lang string, groups []string) string
}

var dynamicPatterns = []dynamicPattern{
	{
		re: regexp.MustCompile(`^курс 1 мен (\d+) аралығында болуы керек$`),
		translate: func(lang string, g []string) string {
			if lang == "ru" {
				return "Курс должен быть от 1 до " + g[0]
			}
			return "Course must be between 1 and " + g[0]
		},
	},
	{
		re: regexp.MustCompile(`^(.+) студенті бөлменің жыныс шектеуіне сай келмейді$`),
		translate: func(lang string, g []string) string {
			if lang == "ru" {
				return "Студент " + g[0] + " не соответствует гендерному ограничению комнаты"
			}
			return "Student " + g[0] + " does not meet the room's gender restriction"
		},
	},
	{
		re: regexp.MustCompile(`^(.+) студенті бөлменің курс шектеуіне сай келмейді$`),
		translate: func(lang string, g []string) string {
			if lang == "ru" {
				return "Студент " + g[0] + " не соответствует ограничению курса комнаты"
			}
			return "Student " + g[0] + " does not meet the room's course restriction"
		},
	},
	{
		re: regexp.MustCompile(`^(.+) студентінде бөлме талап ететін льготалардың бірде-біреуі жоқ$`),
		translate: func(lang string, g []string) string {
			if lang == "ru" {
				return "У студента " + g[0] + " нет ни одной из льгот, требуемых комнатой"
			}
			return "Student " + g[0] + " has none of the benefits required by the room"
		},
	},
}
