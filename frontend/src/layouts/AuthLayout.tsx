import { Outlet } from 'react-router-dom'
import { ApplicationJourneyStepper } from '../components/ApplicationJourneyStepper'
import { ThemeToggle } from '../components/ThemeToggle'

// The one deliberately "designed" shell in the app — every other layout
// (DashboardLayout, AdminLayout, CommitteeLayout) stays plain/functional.
// Shared by both /login and /register so the two keep a consistent frame;
// only LoginPage's own form markup has been restyled to match so far.
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-navy-950 font-body text-sand-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
        <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
          <div className="mb-10 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-turquoise-500/15 text-sm font-semibold text-turquoise-400 ring-1 ring-turquoise-400/30">
                SH
              </span>
              <span className="font-heading text-lg text-sand-100">Student House</span>
            </div>
            <ThemeToggle />
          </div>
          <Outlet />
        </div>

        <div className="hidden border-t border-sand-100/10 px-6 py-12 md:flex md:w-[23rem] md:flex-col md:justify-center md:border-l md:border-t-0 md:px-10 lg:w-[26rem]">
          <p className="font-heading text-2xl leading-snug text-sand-100">
            Өтінішіңіздің жолын осылай көресіз
          </p>
          <p className="mt-3 text-sm text-sand-300/70">
            Берілген сәттен бастап орналасқанға дейін — әр қадамды осы жерден бақылайсыз.
          </p>
          <ApplicationJourneyStepper currentStep="approved" orientation="vertical" className="mt-10" />
        </div>
      </div>
    </div>
  )
}
