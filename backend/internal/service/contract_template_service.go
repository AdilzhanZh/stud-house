package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

func contractVar(token, label string) string {
	return `<span class="contract-var" data-token="` + token + `" contenteditable="false">` + label + `</span>`
}

// defaultContractTemplatePagesKK mirrors the approved paper "Шарт" sample
// (Қорқыт Ата атындағы Қызылорда университеті dormitory residence
// contract), split across pages the same way the printed document is —
// title page, then the numbered sections, then signatures — with the blanks
// that vary per student replaced by the matching domain.ContractVariables
// token.
var defaultContractTemplatePagesKK = []string{
	`<div style="text-align:center;margin-top:220px;">` +
		`<p style="margin:0;font-weight:700;">Қорқыт Ата атындағы</p>` +
		`<p style="margin:0 0 48px;font-weight:700;">Қызылорда университеті</p>` +
		`<h2 style="margin:0 0 8px;font-weight:700;">Шарт</h2>` +
		`<p style="margin:0;">Қорқыт Ата атындағы Қызылорда</p>` +
		`<p style="margin:0 0 48px;">университетінің жатақханасында тұру туралы</p>` +
		`<p style="margin:0;">Қызылорда, ` + contractVar("{{date}}", "Күні") + `</p>` +
		`</div>`,

	`<p style="text-align:center;font-weight:700;margin:0 0 4px;">Шарт № _____</p>` +
		`<p style="text-align:center;margin:0 0 16px;">Қорқыт Ата атындағы Қызылорда университетінің жатақханасында тұру туралы</p>` +
		`<p style="margin:0 0 16px;">Қызылорда қ-сы&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;«____» _______ ` +
		contractVar("{{date}}", "Күні") + `</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">«Қорқыт Ата атындағы Қызылорда университеті» коммерциялық емес акционерлік қоғам, әрі қарай «Университет» деп аталады, оның атынан Басқарма Төрағасы-Ректор Н.С. Байқадамов Жарғы негізінде әрекет етуші, бір жағынан және білім алушы (студент, магистрант, докторант, тыңдаушы) ` +
		contractVar("{{student_full_name}}", "Білім алушының аты-жөні") + ` (` +
		contractVar("{{study_group}}", "Институт/оқу тобы") +
		`), бұдан әрі «Білім алушы» деп аталады, екінші жағынан төмендегілер туралы шартты жасады:</p>` +
		`<h3 style="margin:0 0 8px;">1. ШАРТ НЫСАНЫ</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">1.1. Университет «Білім алушыға» ` +
		contractVar("{{dormitory_name}}", "Жатақхана атауы") + ` жатақханасынан №` +
		contractVar("{{room_number}}", "Бөлме нөмірі") + ` бөлмеден жатын орын береді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">1.2. Білім алушыны жатақханаға орналастыру жатақханалардағы орындарды бөлу жөніндегі комиссия берген білім алушыларға жатақхана беру туралы жолдама негізінде жүзеге асырылады.</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">1.3. Жатақханадан орын беру туралы жолдамамен бірге білім алушы жатақханада тұру үшін төлемақы төленгендігі туралы түбіртек тапсырады.</p>` +
		`<h3 style="margin:0 0 8px;">2. УНИВЕРСИТЕТТІҢ ҚҰҚЫҚТАРЫ МЕН МІНДЕТТЕРІ</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.1. Білім алушыға студенттік жатақханада тұрғаны үшін төлейтін төлемдер мөлшерін анықтайды: айлық төлем — ` +
		contractVar("{{monthly_payment_bachelor}}", "Айлық төлем (бакалавриат)") + `, жылдық төлем — ` +
		contractVar("{{yearly_payment_bachelor}}", "Жылдық төлем (бакалавриат)") + `.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.2. Университет Білім алушыны қажетті инвентарлық мүліктермен, көрпе-төсектермен қамтамасыз етеді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.3. Білім алушыға оқу үдерісіне тікелей қатысы жоқ коммуналдық және тұрмыстық қосымша қызметтер, оның ішінде жеке энергиясиымды электр құралдарын пайдалану және орнатуды (қыздыру, өртке қауіпті және басқа жатақханада қолдануға тыйым салынған), қосымша жарықтандыру нүктелерін ұсынады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.4. Білім алушының студенттік жатақханада уақытша тіркелуіне көмектеседі.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.5. Білім алушының тұру қауіпсіздігін қамтамасыз ету мақсатында жатақханаға кіргізу-бақылау режимін жүргізеді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.6. Жатақханадағы көпшілік пайдаланатын жерлерді, оның ішінде санитарлық торабтарды, ас әзірлеуге арналған бөлмелер мен дәліздердің қалыпты жағдайын қамтамасыз етеді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.7. Жатақханаға жөндеу, сондай-ақ электр және су құбыры желілерді, газ жабдықтарына жөндеу жүргізеді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.8. Қажет болған жағдайда Білім алушының тұратын бөлмесін осы жатақханадағы басқа бөлмеге ауыстырып, бірдей коммуналдық және тұрмыстық қызметтер ұсынуға құқылы.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.9. Осы келісімшартты мына жағдайларда мерзімінен бұрын бұзуға құқылы: Білім алушы жатақхананың ішкі тәртіп ережелерін бұзған жағдайда; жатақханада тұру ақысын 1 және көп ай бойына ешқандай төлемеуі; университет жатақханасында белгісіз себептермен бір ай бойы тұрмаған жағдайда; Білім алушы оқудан шығарылған жағдайда.</p>` +
		`<p style="text-align:justify;margin:0;">2.10. Білім алушыны оның құқықтары мен міндеттері туралы, сондай-ақ студенттік жатақханалардың қызметін ұйымдастыруға байланысты нормативтік құжаттар мен оларға енгізілген өзгертулер туралы дер кезінде хабардар етеді.</p>`,

	`<h3 style="margin:0 0 8px;">3. БІЛІМ АЛУШЫНЫҢ ҚҰҚЫҚТАРЫ МЕН МІНДЕТТЕРІ</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.1. Студенттік жатақхананың ішкі тәртіп ережелерін, қауіпсіздік техникасы мен өрт қауіпсіздігі, жатақханада тұрудың санитарлық-гигиеналық нормаларын орындайды, сондай-ақ жеке бас гигиенасын сақтайды.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.2. Жатақханадағы тұратын бөлмесін тазалайды, көпшілік пайдаланатын жерлердегі тазалықты сақтайды.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.3. Академиялық кезең аяқталғаннан кейін тұратын бөлмесіне жеңіл жөндеу жүргізеді, өзінің атындағы барлық төсек-орындарды, жиһаз, мүліктер, жабдықтармен өз бөлмесінің кілтін жатақхананың комендантына тапсырады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.4. Тұратын бөлмесіндегі де, көпшілік пайдаланатын орындардағы да инвентарлық жабдықтарды, жиһаздарды бүлдірген үшін заңнамамен бекітілген тәртіпте, сондай-ақ ұсақ инвентарларды жоғалтқаны үшін университеттің шаруашылық жұмыстар жөніндегі департаментінің актісімен анықталған, шынайы келтірілген залалы мөлшерінде мүлікті жауапкершілік арқалайды.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.5. Келісімшарттың 3.4 тармағында көрсетілген жағдайлардан бөлек, Университетке мүліктік залал білім алушы жатақханаға шақырған қонақтармен келтірілген жағдайда жеке мүліктік жауапкершілік арқалайды.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.6. Оқу академиялық кезеңі аяқталғанда, сондай-ақ Университеттен шығарылған немесе академиялық демалысқа шыққан жағдайда білім алушы тіркеу есебінен алынып, жатақханадағы жатын орнын 5 күн ішінде босатып береді және тұрған кезінде алынған жатақхананың тиісті инвентарлық мүліктерін жатақхана комендантына алдын ала береді.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.7. Жатақханада тұрғаны үшін әр айдың 10-на дейін осы шартта көрсетілген университеттің есеп шотына ақша аудару арқылы тұрақты түрде төлем жасап отырады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.8. Қоғамдық жұмыстардың барлық түріне қатысады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.9. Студенттік өзін-өзі басқару органдарын сайлауға қатысады.</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">3.10. Жеке құжаттарындағы барлық өзгерістер туралы (төлқұжатын ауыстыру, тегін өзгерту, тұрақты мекенжайын өзгерту т.с.с) комендантқа міндетті түрде хабарлайды.</p>` +
		`<h3 style="margin:0 0 8px;">4. ШАРТТЫҢ ӘРЕКЕТ ЕТУІ</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.1. Осы шарт тараптар қолдарын қойған күннен бастап күшіне еніп, білім алушы университеттегі негізгі оқуын аяқтағанға дейін өз күшінде болады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.2. Шартта қаралған жағдайларда университеттің бастамасымен бұзылған кезде осы шарт мерзімінен бұрын күшін жояды.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.3. Барлық қалған жағдайларда шарт білім алушының бастамасымен ол үшін кез келген уақытта мерзімінен бұрын бұзыла алады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.4. Осы шартта айтылмаған барлық басқа шарттар оның ажырамас бөлігі болып табылатын жазбаша қосымша келісім түрінде ресімделген жағдайда ғана заңды болады.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.5. Заңнамамен көзделген, бірақ осы келісімшартта айтылмаған шарттар осы шартқа қарамай әрекет етеді.</p>` +
		`<p style="text-align:justify;margin:0;">4.6. Шарт 2 данада жасалады және әр тарапта бір-бір данадан сақталады.</p>`,

	`<h3 style="margin:0 0 8px;">5. ТАРАПТАРДЫҢ ЗАҢДЫ МЕКЕН-ЖАЙЛАРЫ МЕН БАНКТІК РЕКВИЗИТТЕРІ</h3>` +
		`<p style="font-weight:700;margin:12px 0 4px;">«УНИВЕРСИТЕТ»</p>` +
		`<p style="margin:0 0 2px;">Атауы: «Қорқыт Ата атындағы Қызылорда университеті» коммерциялық емес акционерлік қоғамы</p>` +
		`<p style="margin:0 0 2px;">Орналасқан жері: ` +
		contractVar("{{dormitory_address}}", "Жатақхана мекен-жайы") + `</p>` +
		`<p style="margin:0 0 2px;">РНН 331000037638&nbsp;&nbsp;&nbsp;&nbsp;БИН 960540000620</p>` +
		`<p style="margin:0 0 16px;">Банктік реквизиттері: «Қазақстан халық банкі» АҚ, ИИК: KZ 276017201000000125, БИК: HSBKKZKX КБЕ 16</p>` +
		`<p style="margin:0 0 32px;">Басқарма Төрағасы-Ректор&nbsp;&nbsp;&nbsp;___________&nbsp;&nbsp;&nbsp;Н.С.Байқадамов</p>` +
		`<p style="font-weight:700;margin:12px 0 4px;">«БІЛІМ АЛУШЫ»</p>` +
		`<p style="margin:0 0 2px;">Т.А.Ә.: ` + contractVar("{{student_full_name}}", "Білім алушының аты-жөні") + `</p>` +
		`<p style="margin:0 0 2px;">ЖСН: ` + contractVar("{{student_iin}}", "ЖСН") + `</p>` +
		`<p style="margin:0 0 16px;">Телефон: ` + contractVar("{{student_phone}}", "Телефон") + `</p>` +
		`<p style="margin:0;">Қолы: __________________</p>`,
}

// defaultContractTemplatePagesRU is the Russian-language mirror of
// defaultContractTemplatePagesKK — the same sample document, same page
// split, same domain.ContractVariables tokens in the same places (Kazakh
// dormitory contracts are always issued in both languages).
var defaultContractTemplatePagesRU = []string{
	`<div style="text-align:center;margin-top:220px;">` +
		`<p style="margin:0;font-weight:700;">Кызылординский университет</p>` +
		`<p style="margin:0 0 48px;font-weight:700;">имени Коркыт Ата</p>` +
		`<h2 style="margin:0 0 8px;font-weight:700;">ДОГОВОР</h2>` +
		`<p style="margin:0;">на проживание в общежитии</p>` +
		`<p style="margin:0 0 48px;">Кызылординского университета имени Коркыт Ата</p>` +
		`<p style="margin:0;">Кызылорда, ` + contractVar("{{date}}", "Дата") + `</p>` +
		`</div>`,

	`<p style="text-align:center;font-weight:700;margin:0 0 4px;">ДОГОВОР № _____</p>` +
		`<p style="text-align:center;margin:0 0 16px;">на проживание в общежитии Кызылординского университета имени Коркыт Ата</p>` +
		`<p style="margin:0 0 16px;">г. Кызылорда&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;«____» _______ ` +
		contractVar("{{date}}", "Дата") + `</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">Некоммерческое акционерное общество «Кызылординский университет имени Коркыт Ата», именуемый в дальнейшем «Университет», в лице Председателя Правления-Ректора Н.С. Байкадамова, действующего на основании Устава, с одной стороны, и обучающийся (студент, магистрант, докторант, слушатель) ` +
		contractVar("{{student_full_name}}", "Ф.И.О. обучающегося") + ` (` +
		contractVar("{{study_group}}", "Институт/ОП") +
		`), именуемый в дальнейшем «Обучающийся», с другой стороны, заключили настоящий договор о нижеследующем:</p>` +
		`<h3 style="margin:0 0 8px;">1. ПРЕДМЕТ ДОГОВОРА</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">1.1. Университет предоставляет обучающемуся место в общежитии ` +
		contractVar("{{dormitory_name}}", "Название общежития") + ` в комнате №` +
		contractVar("{{room_number}}", "Номер комнаты") + `.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">1.2. Вселение Обучающегося в общежитие осуществляется на основании направления о предоставлении общежития обучающимся, выданного комиссией по распределению мест в общежитиях.</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">1.3. Вместе с направлением о предоставлении общежития обучающийся предоставляет копию квитанции об оплате за проживание в студенческом общежитии.</p>` +
		`<h3 style="margin:0 0 8px;">2. ПРАВА И ОБЯЗАННОСТИ УНИВЕРСИТЕТА</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.1. Определяет размер платежей за проживание в студенческом общежитии: ежемесячный платёж — ` +
		contractVar("{{monthly_payment_bachelor}}", "Ежемесячный платёж (бакалавриат)") + `, годовой платёж — ` +
		contractVar("{{yearly_payment_bachelor}}", "Годовой платёж (бакалавриат)") + `.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.2. Университет обеспечивает обучающегося необходимой инвентарной мебелью, постельными принадлежностями.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.3. Предоставляет обучающемуся дополнительные коммунальные и бытовые услуги, не связанные с учебным процессом, в том числе пользование личными энергоёмкими электроприборами и установками (кроме нагревательных, пожароопасных и других запрещённых к применению в общежитии), дополнительными точками освещения.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.4. Содействует временному регистрационному учёту обучающегося в студенческом общежитии.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.5. В целях обеспечения безопасного проживания обучающегося осуществляет контрольно-пропускной режим в общежитии.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.6. Обеспечивает нормальное состояние мест общественного пользования в общежитии, в том числе санитарных узлов, комнат для приготовления пищи и коридоров.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.7. Проводит ремонт общежития, а также ремонт электро- и водопроводных сетей, газового оборудования.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.8. В случае необходимости имеет право изменить обучающемуся его комнату проживания на другую комнату в этом же общежитии с предоставлением равноценных коммунальных и бытовых услуг.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">2.9. Имеет право досрочно расторгнуть настоящий договор в случаях: нарушения обучающимся Правил внутреннего распорядка общежития; неоплаты за проживание в общежитии в течение непрерывно 1-го и более месяца; непроживания в общежитии по неизвестным университету причинам в течение одного месяца; отчисления обучающегося из университета.</p>` +
		`<p style="text-align:justify;margin:0;">2.10. Своевременно информирует обучающегося о его правах и обязанностях, а также о нормативных документах, связанных с организацией деятельности студенческих общежитий и вносимых в них изменениях.</p>`,

	`<h3 style="margin:0 0 8px;">3. ПРАВА И ОБЯЗАННОСТИ ОБУЧАЮЩЕГОСЯ</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.1. Исполняет Правила внутреннего распорядка студенческого общежития, техники безопасности и противопожарной защиты в общежитии, а также соблюдает личную гигиену.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.2. Проводит уборку в проживаемой комнате общежития, поддерживает чистоту в местах общего пользования общежития.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.3. По окончании академического периода осуществляет текущий ремонт в комнате проживания, сдаёт коменданту общежития все числящиеся за ним постельные принадлежности, мебель, инвентарь, оборудование и ключи от своей комнаты.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.4. В установленном законодательством порядке несёт имущественную ответственность за порчу инвентарного оборудования, мебели как в проживаемой комнате, так и в местах общего пользования, а также за утерю мелкого инвентаря в размерах реального причинённого ущерба, определяемого актом департамента по хозяйственной работе университета.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.5. Кроме случаев, указанных в п. 3.4 договора, лично несёт имущественную ответственность и в случаях, когда имущественный вред Университету был причинён гостями, приглашёнными обучающимся в общежитие.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.6. По окончании обучения, а также в случае отчисления из университета или нахождения в академическом отпуске обучающийся снимается с регистрационного учёта и освобождает занимаемое койко-место в общежитии в течение 5 дней, предварительно передав коменданту полученное во время проживания соответствующее инвентарное имущество общежития.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.7. Регулярно до 10-го числа каждого месяца, следующего за расчётным, вносит плату за проживание в общежитии путём перечисления денежных средств на расчётный счёт университета, указанный в настоящем договоре.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.8. Принимает участие во всех видах общественных работ.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">3.9. Участвует в избрании органов студенческого самоуправления.</p>` +
		`<p style="text-align:justify;margin:0 0 16px;">3.10. В обязательном порядке информирует коменданта о всех изменениях в личных документах (обмен паспорта, изменение фамилии, изменение постоянного места жительства и т.д.).</p>` +
		`<h3 style="margin:0 0 8px;">4. ДЕЙСТВИЕ ДОГОВОРА</h3>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.1. Настоящий договор вступает в силу со дня его подписания сторонами и действует до окончания обучающимся основного обучения в Университете.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.2. Настоящий договор досрочно утрачивает силу при его расторжении по инициативе Университета в случаях, предусмотренных настоящим договором.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.3. Во всех остальных случаях договор может быть досрочно расторгнут по инициативе обучающегося в любое для него время.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.4. Все иные условия, не оговорённые в данном договоре, действуют только в случае оформления их в виде дополнительного письменного соглашения, являющегося неотъемлемой его частью.</p>` +
		`<p style="text-align:justify;margin:0 0 6px;">4.5. Условия, предусмотренные законодательством, но не оговорённые в настоящем договоре, действуют независимо от настоящего договора.</p>` +
		`<p style="text-align:justify;margin:0;">4.6. Договор составлен в 2-х экземплярах и хранится по одному экземпляру у каждой из сторон.</p>`,

	`<h3 style="margin:0 0 8px;">5. ЮРИДИЧЕСКИЕ АДРЕСА И БАНКОВСКИЕ РЕКВИЗИТЫ СТОРОН</h3>` +
		`<p style="font-weight:700;margin:12px 0 4px;">«УНИВЕРСИТЕТ»</p>` +
		`<p style="margin:0 0 2px;">Наименование: Некоммерческое акционерное общество «Кызылординский университет имени Коркыт Ата»</p>` +
		`<p style="margin:0 0 2px;">Местонахождение: ` +
		contractVar("{{dormitory_address}}", "Адрес общежития") + `</p>` +
		`<p style="margin:0 0 2px;">РНН 331000037638&nbsp;&nbsp;&nbsp;&nbsp;БИН 960540000620</p>` +
		`<p style="margin:0 0 16px;">Банковские реквизиты: АО «Народный банк Казахстана», ИИК: KZ 276017201000000125, БИК: HSBKKZKX КБЕ 16</p>` +
		`<p style="margin:0 0 32px;">Председатель Правления-Ректор&nbsp;&nbsp;&nbsp;___________&nbsp;&nbsp;&nbsp;Н.С.Байкадамов</p>` +
		`<p style="font-weight:700;margin:12px 0 4px;">«ОБУЧАЮЩИЙСЯ»</p>` +
		`<p style="margin:0 0 2px;">Ф.И.О.: ` + contractVar("{{student_full_name}}", "Ф.И.О. обучающегося") + `</p>` +
		`<p style="margin:0 0 2px;">ИИН: ` + contractVar("{{student_iin}}", "ИИН") + `</p>` +
		`<p style="margin:0 0 16px;">Телефон: ` + contractVar("{{student_phone}}", "Телефон") + `</p>` +
		`<p style="margin:0;">Подпись: __________________</p>`,
}

type ContractTemplateService struct {
	templates repository.ContractTemplateRepository
}

func NewContractTemplateService(templates repository.ContractTemplateRepository) *ContractTemplateService {
	return &ContractTemplateService{templates: templates}
}

// Get never 404s: before any manager has customized a given language's
// wording, it returns that language's pre-seeded default pages (not
// persisted until Update is first called) — mirrors PetitionTemplateService.
// Get's same trade-off.
func (s *ContractTemplateService) Get(ctx context.Context, language domain.ContractLanguage) (*domain.ContractTemplate, error) {
	if !language.Valid() {
		return nil, apperror.BadRequest("тіл жарамсыз")
	}
	t, err := s.templates.Get(ctx, language)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			pages := defaultContractTemplatePagesKK
			if language == domain.ContractLanguageRU {
				pages = defaultContractTemplatePagesRU
			}
			return &domain.ContractTemplate{Language: language, Pages: pages}, nil
		}
		return nil, err
	}
	return t, nil
}

// Update is manager/admin-only (enforced by the route group). It always
// overwrites the given language's template — there's no per-template
// selection or history, per the current spec.
func (s *ContractTemplateService) Update(ctx context.Context, actorID uuid.UUID, language domain.ContractLanguage, pages []string) (*domain.ContractTemplate, error) {
	if !language.Valid() {
		return nil, apperror.BadRequest("тіл жарамсыз")
	}
	if len(pages) == 0 {
		return nil, apperror.BadRequest("үлгіде кемінде бір бет болуы керек")
	}
	for _, p := range pages {
		if strings.TrimSpace(p) == "" {
			return nil, apperror.BadRequest("үлгінің беттері бос болмауы керек")
		}
	}
	t := &domain.ContractTemplate{Language: language, Pages: pages, UpdatedBy: actorID}
	if err := s.templates.Upsert(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}
