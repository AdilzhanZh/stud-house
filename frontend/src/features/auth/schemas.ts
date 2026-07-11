import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email форматы дұрыс емес'),
  password: z.string().min(1, 'Құпия сөзді енгізіңіз'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    aty: z.string().min(1, 'Атын енгізіңіз'),
    familiya: z.string().optional(),
    tegi: z.string().optional(),
    email: z.string().email('Email форматы дұрыс емес'),
    phone: z.string().min(1, 'Телефон нөмірін енгізіңіз'),
    iin: z.string().regex(/^\d{12}$/, 'ЖСН (ИИН) 12 таңбалы сан болуы керек'),
    gender: z.enum(['male', 'female'], { message: 'Жынысын таңдаңыз' }),
    course: z.enum(['1', '2', '3', '4', '5', '6'], { message: 'Курсты таңдаңыз' }),
    academic_degree: z.enum(['bachelor', 'master'], { message: 'Оқу деңгейін таңдаңыз' }),
    password: z.string().min(8, 'Құпия сөз кемінде 8 таңбадан тұруы керек'),
    password_confirm: z.string().min(1, 'Құпия сөзді қайталаңыз'),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Құпия сөздер сәйкес келмейді',
    path: ['password_confirm'],
  })
  .refine(
    (data) => {
      const maxCourse = data.academic_degree === 'master' ? 2 : 4
      return Number(data.course) <= maxCourse
    },
    {
      message: 'Таңдалған оқу деңгейіне сәйкес курсты таңдаңыз',
      path: ['course'],
    },
  )

export type RegisterFormValues = z.infer<typeof registerSchema>
