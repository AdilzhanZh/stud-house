import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email форматы дұрыс емес'),
  password: z.string().min(1, 'Құпия сөзді енгізіңіз'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    full_name: z.string().min(1, 'Аты-жөнін енгізіңіз'),
    email: z.string().email('Email форматы дұрыс емес'),
    phone: z.string().min(1, 'Телефон нөмірін енгізіңіз'),
    password: z.string().min(8, 'Құпия сөз кемінде 8 таңбадан тұруы керек'),
    password_confirm: z.string().min(1, 'Құпия сөзді қайталаңыз'),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Құпия сөздер сәйкес келмейді',
    path: ['password_confirm'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>
