// Mirrors backend internal/service/application_service.go's maxStayMonths:
// a student may declare a stay from the current month up to and including
// June (the academic year's end) — e.g. applying in September allows up to
// 10 months (Sep..Jun), October allows 9, and June itself allows only 1.
export function maxStayMonths(now: Date = new Date()): number {
  const juneMonth = 6
  const m = now.getMonth() + 1
  return ((juneMonth - m + 12) % 12) + 1
}
