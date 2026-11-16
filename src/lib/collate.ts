/**
 * Alphabetical order in Portuguese ("Água" next to "Agachamento", not after "Z"), for `sort`.
 * One shared collator: on Hermes, `a.localeCompare(b, 'pt-BR')` builds one per call
 * (sorting 147 exercises took ~1 s on the phone; with this, ~3 ms).
 */
export const compareText = new Intl.Collator('pt-BR').compare;
