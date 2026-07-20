import { Route, Routes } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { HomePage } from './features/home/HomePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { EditProfilePage } from './features/profile/EditProfilePage'
import { DormitoriesPage } from './features/dormitories/DormitoriesPage'
import { DormitoryInfoPage } from './features/dormitories/DormitoryInfoPage'
import { NewApplicationPage } from './features/applications/NewApplicationPage'
import { MyApplicationsPage } from './features/applications/MyApplicationsPage'
import { ApplicationDetailPage } from './features/applications/ApplicationDetailPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'
import { ContractsPage } from './features/contracts/ContractsPage'
import { MyResidencePage } from './features/residence/MyResidencePage'
import { DormitoryListPage } from './features/admin/dormitories/DormitoryListPage'
import { DormitoryFormPage } from './features/admin/dormitories/DormitoryFormPage'
import { DormitoryDetailPage } from './features/admin/dormitories/DormitoryDetailPage'
import { RoomFormPage } from './features/admin/rooms/RoomFormPage'
import { RoomResidentsView } from './features/admin/rooms/RoomResidentsView'
import { DocumentListPage } from './features/admin/documents/DocumentListPage'
import { BenefitFormPage } from './features/admin/benefits/BenefitFormPage'
import { UserListPage } from './features/admin/users/UserListPage'
import { UserRegisterFormPage } from './features/admin/users/UserRegisterFormPage'
import { RoleAssignPage } from './features/admin/users/RoleAssignPage'
import { PendingStudentsPage } from './features/admin/users/PendingStudentsPage'
import { DashboardPage } from './features/admin/dashboard/DashboardPage'
import { ResidentsPage } from './features/admin/residents/ResidentsPage'
import { NotificationBroadcastPage } from './features/admin/notifications/NotificationBroadcastPage'
import { ApplicationQueuePage } from './features/admin/applications/ApplicationQueuePage'
import { ApplicationAdminDetailPage } from './features/admin/applications/ApplicationAdminDetailPage'
import { ReportListPage } from './features/admin/reports/ReportListPage'
import { ReportDetailPage } from './features/admin/reports/ReportDetailPage'
import { ReportTemplateListPage } from './features/admin/reports/ReportTemplateListPage'
import { ReportCreatePage } from './features/admin/reports/ReportCreatePage'
import { CommitteeReportListPage } from './features/admin/committee/CommitteeReportListPage'
import { CommitteeVotePage } from './features/admin/committee/CommitteeVotePage'
import { ContractsAndPaymentsPage } from './features/admin/contracts/ContractsAndPaymentsPage'
import { ExitRequestListPage } from './features/admin/requests/ExitRequestListPage'
import { TransferRequestListPage } from './features/admin/requests/TransferRequestListPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleBasedRedirect } from './routes/RoleBasedRedirect'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'

function App() {
  const isReady = useAuthBootstrap()

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Жүктелуде...
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard/home" element={<HomePage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />
          <Route path="/dashboard/profile/edit" element={<EditProfilePage />} />
          <Route path="/dormitories" element={<DormitoriesPage />} />
        <Route path="/dormitories/:id" element={<DormitoryInfoPage />} />
          <Route path="/applications/new" element={<NewApplicationPage />} />
          <Route path="/applications/my" element={<MyApplicationsPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/contracts/my" element={<ContractsPage />} />
          <Route path="/my-residence" element={<MyResidencePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/residents" element={<ResidentsPage />} />
          <Route path="/admin/notifications/broadcast" element={<NotificationBroadcastPage />} />
          <Route path="/admin/dormitories" element={<DormitoryListPage />} />
          <Route path="/admin/dormitories/new" element={<DormitoryFormPage />} />
          <Route path="/admin/dormitories/:id/edit" element={<DormitoryFormPage />} />
          <Route path="/admin/dormitories/:id" element={<DormitoryDetailPage />} />
          <Route path="/admin/dormitories/:dormitoryId/rooms/new" element={<RoomFormPage />} />
          <Route path="/admin/rooms/:roomId/edit" element={<RoomFormPage />} />
          <Route path="/admin/rooms/:roomId/residents" element={<RoomResidentsView />} />
          <Route path="/admin/documents" element={<DocumentListPage />} />
          <Route path="/admin/benefits/new" element={<BenefitFormPage />} />
          <Route path="/admin/benefits/:id/edit" element={<BenefitFormPage />} />
          <Route path="/admin/students/pending" element={<PendingStudentsPage />} />

          <Route path="/admin/applications" element={<ApplicationQueuePage />} />
          <Route path="/admin/applications/:id" element={<ApplicationAdminDetailPage />} />
          <Route path="/admin/reports" element={<ReportListPage />} />
          <Route path="/admin/reports/templates" element={<ReportTemplateListPage />} />
          <Route path="/admin/reports/new" element={<ReportCreatePage />} />
          <Route path="/admin/reports/:id" element={<ReportDetailPage />} />
          <Route path="/committee/reports" element={<CommitteeReportListPage />} />
          <Route path="/committee/reports/:id" element={<CommitteeVotePage />} />

          <Route path="/admin/contracts" element={<ContractsAndPaymentsPage />} />
          <Route path="/admin/exit-requests" element={<ExitRequestListPage />} />
          <Route path="/admin/transfer-requests" element={<TransferRequestListPage />} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/users" element={<UserListPage />} />
            <Route path="/admin/users/new" element={<UserRegisterFormPage />} />
            <Route path="/admin/users/:id/role" element={<RoleAssignPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<RoleBasedRedirect />} />
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  )
}

export default App
