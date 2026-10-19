/** Lower case without accents, for search: "Supino Inclinado" and "supino inclinado" match "inclin". */
export const normalizeSearch = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
