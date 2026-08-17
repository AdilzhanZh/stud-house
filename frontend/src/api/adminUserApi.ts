import { apiClient } from './client'
import type { AcademicDegree, Gender, Role, User } from '../types'

export async function listUsers(role?: Role): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/admin/users', {
    params: role ? { role } : undefined,
  })
  return data.data
}

export interface CreateUserPayload {
  full_name: string
  email: string
  phone: string
  password: string
  role: Role
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/admin/users', payload)
  return data.data
}

export interface CreateStudentPayload {
  full_name: string
  email: string
  phone: string
  password: string
  iin: string
  gender: Gender
  course: number
  academic_degree: AcademicDegree
}

// Admin/manager creates a student account directly — same fields as public
// self-registration, but the account is already approved and email-verified
// (no confirmation step to wait on).
export async function createStudent(payload: CreateStudentPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/admin/students', payload)
  return data.data
}

export async function updateUserRole(id: string, role: Role): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/role`, { role })
  return data.data
}

// Admin elects (or removes) a manager onto the committee — only valid for
// role=manager.
export async function setCommitteeMember(id: string, isCommitteeMember: boolean): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/committee-member`, {
    is_committee_member: isCommitteeMember,
  })
  return data.data
}

export async function setChairperson(id: string, isChairperson: boolean): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(
    `/admin/committee-members/${id}/chairperson`,
    { is_chairperson: isChairperson },
  )
  return data.data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`)
}

export async function setUserPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/password`, { new_password: newPassword })
}

export async function listPendingStudents(): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/admin/students/pending')
  return data.data
}

// Approved students with no active room placement — for placing a student
// into a room directly, without going through the application workflow.
export async function listUnhousedStudents(): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/admin/students/unhoused')
  return data.data
}

export async function decideStudentApproval(
  id: string,
  action: 'approve' | 'reject',
): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/admin/students/${id}/approval`, {
    action,
  })
  return data.data
}
