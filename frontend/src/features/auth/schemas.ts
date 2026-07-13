import { z } from 'zod'
import type { TFunction } from 'i18next'

export function buildLoginSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(1, t('validation.passwordRequired')),
  })
}

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

export function buildRegisterSchema(t: TFunction) {
  return z
    .object({
      aty: z.string().min(1, t('validation.nameRequired')),
      familiya: z.string().optional(),
      tegi: z.string().optional(),
      email: z.string().email(t('validation.emailInvalid')),
      phone: z.string().min(1, t('validation.phoneRequired')),
      iin: z.string().regex(/^\d{12}$/, t('validation.iinFormat')),
      gender: z.enum(['male', 'female'], { message: t('validation.genderRequired') }),
      course: z.enum(['1', '2', '3', '4', '5', '6'], { message: t('validation.courseRequired') }),
      academic_degree: z.enum(['bachelor', 'master'], { message: t('validation.degreeRequired') }),
      password: z.string().min(8, t('validation.passwordMin')),
      password_confirm: z.string().min(1, t('validation.passwordConfirmRequired')),
    })
    .refine((data) => data.password === data.password_confirm, {
      message: t('validation.passwordMismatch'),
      path: ['password_confirm'],
    })
    .refine(
      (data) => {
        const maxCourse = data.academic_degree === 'master' ? 2 : 4
        return Number(data.course) <= maxCourse
      },
      {
        message: t('validation.courseForDegree'),
        path: ['course'],
      },
    )
}

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>
