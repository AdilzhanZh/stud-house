// Documents/benefits store separate kk/ru text fields (see backend migration
// 000072). The service layer backfills an empty side from the filled one on
// save, but this stays defensive for any records saved before that.
export function bilingualField(nameKk: string, nameRu: string, language: string): string {
  if (language.startsWith('ru')) return nameRu || nameKk
  return nameKk || nameRu
}
