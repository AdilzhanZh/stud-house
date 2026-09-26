import { z } from 'zod'
import type { TFunction } from 'i18next'

export function buildLoginSchema(t: TFunction) {
  return z.object({
    login: z.string().min(1, t('validation.loginRequired')),
    password: z.string().min(1, t('validation.passwordRequired')),
  })
}

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

function sharedRegisterFields(t: TFunction) {
  return {
    aty: z.string().min(1, t('validation.nameRequired')),
    familiya: z.string().min(1, t('validation.lastNameRequired')),
    tegi: z.string().optional(),
    phone: z.string().min(1, t('validation.phoneRequired')),
    iin: z.string().regex(/^\d{12}$/, t('validation.iinFormat')),
    gender: z.enum(['male', 'female'], { message: t('validation.genderRequired') }),
    course: z.enum(['1', '2', '3', '4', '5', '6'], { message: t('validation.courseRequired') }),
    academic_degree: z.enum(['bachelor', 'master', 'doctorate'], {
      message: t('validation.degreeRequired'),
    }),
    password: z.string().min(8, t('validation.passwordMin')),
    password_confirm: z.string().min(1, t('validation.passwordConfirmRequired')),
  }
}

export function buildRegisterSchema(t: TFunction) {
  return z
    .object({
      ...sharedRegisterFields(t),
      email: z.string().email(t('validation.emailInvalid')),
    })
    .refine((data) => data.password === data.password_confirm, {
      message: t('validation.passwordMismatch'),
      path: ['password_confirm'],
    })
    .refine(
      (data) => {
        const maxCourse =
          data.academic_degree === 'master' ? 2 : data.academic_degree === 'doctorate' ? 3 : 4
        return Number(data.course) <= maxCourse
      },
      {
        message: t('validation.courseForDegree'),
        path: ['course'],
      },
    )
}

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>

// Same as buildRegisterSchema, but for the admin/manager "add student" form
// (StudentRegisterFormPage): email is optional there since a student the
// admin is vouching for in person logs in with their IIN either way.
export function buildAdminStudentSchema(t: TFunction) {
  return z
    .object({
      ...sharedRegisterFields(t),
      email: z.union([z.string().email(t('validation.emailInvalid')), z.literal('')]).optional(),
    })
    .refine((data) => data.password === data.password_confirm, {
      message: t('validation.passwordMismatch'),
      path: ['password_confirm'],
    })
    .refine(
      (data) => {
        const maxCourse =
          data.academic_degree === 'master' ? 2 : data.academic_degree === 'doctorate' ? 3 : 4
        return Number(data.course) <= maxCourse
      },
      {
        message: t('validation.courseForDegree'),
        path: ['course'],
      },
    )
}

export type AdminStudentFormValues = z.infer<ReturnType<typeof buildAdminStudentSchema>>
