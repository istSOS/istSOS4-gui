// Catalog supplied by the sosraw service owner. Codes are categories, not scores.
// Keep the original descriptions, including the service-specific meaning of 101.
export const QUALITY_FLAGS = [
  { code: 100, description: 'Dato caricato in banca dati formato corretto' },
  {
    code: 101,
    description:
      'Dato inserito manualmente per facilitare sovrascrittura dati a seguito di problematica pluviometri del 2025',
  },
  { code: 110, description: 'Valore nullo' },
  { code: 120, description: 'Valore non convertibile' },
  { code: 130, description: 'Raw external source' },
  {
    code: 200,
    description:
      'the value is in a resonable range for that observed property and station',
  },
  {
    code: 210,
    description:
      "Valore sensato per il sensore all'interno di soglie minime e massime",
  },
  {
    code: 220,
    description:
      'Controllo di plausibilita sulla base dei dati delle ultime 24/48 ore',
  },
  {
    code: 230,
    description:
      'Confronto con i dati di altri sensori vicini o dati radar e verifica di affidabilita',
  },
  {
    code: 310,
    description: 'Dato analizzato manualmente e ritenuto NON corretto',
  },
  {
    code: 320,
    description:
      'Dato analizzato manualmente e ritenuto corretto grazie ad una correzione manuale',
  },
  { code: 321, description: 'Dato parzialmente corretto' },
  {
    code: 330,
    description:
      'Dato analizzato manualmente e ritenuto corretto senza alcuna correzione',
  },
] as const

export const MANUAL_FLAG_CODES = [310, 320, 321, 330, 110]

export function qualityFlagDescription(value: unknown): string {
  return (
    QUALITY_FLAGS.find((flag) => String(flag.code) === String(value))
      ?.description ?? ''
  )
}
