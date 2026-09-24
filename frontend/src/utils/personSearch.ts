// Matches a search query against a person's name/IIN/email regardless of
// word order in the name (e.g. "Ерасыл Бақтыбергенов" must match a person
// stored as "Бақтыбергенов Ерасыл").
export function matchesPersonSearch(
  query: string,
  person: { full_name: string; iin?: string | null; email?: string | null },
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  if ((person.iin ?? '').includes(q)) return true
  if ((person.email ?? '').toLowerCase().includes(q)) return true

  const nameWords = person.full_name.toLowerCase().split(/\s+/).filter(Boolean)
  const queryWords = q.split(/\s+/).filter(Boolean)
  return queryWords.every((qw) => nameWords.some((nw) => nw.includes(qw)))
}
