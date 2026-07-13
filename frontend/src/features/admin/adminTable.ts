// Shared class strings for the admin panel's many data-table pages, so a
// table's look (radius, borders, hover) stays one visual system instead of
// each page hand-rolling its own slightly-different variant.
export const adminPageHeading = 'text-[23px] font-bold text-sand-100'
export const adminTableWrapClass = '!p-0 overflow-x-auto'
export const adminTheadClass = 'border-b border-navy-700 text-xs font-semibold tracking-wide text-sand-300 uppercase'
export const adminRowClass = 'border-b border-navy-700 last:border-0'
export const adminRowClickableClass = `${adminRowClass} cursor-pointer transition-colors hover:bg-navy-800/60`
export const adminCellClass = 'px-4 py-3'
export const adminChipButtonClass =
  'rounded-lg px-2.5 py-1.5 text-xs font-semibold text-turquoise-400 ring-1 ring-inset ring-turquoise-400/30 transition-colors hover:bg-turquoise-500/10'
