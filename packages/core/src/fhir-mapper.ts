import { NormalisedData, FhirObservation } from './types'

const LOINC_SYSTEM = 'http://loinc.org'
const UCUM_SYSTEM = 'http://unitsofmeasure.org'

interface MetricMapping {
  loincCode: string
  display: string
  unit: string
  ucumCode: string
}

const METRIC_MAPPINGS: Record<string, MetricMapping> = {
  steps: {
    loincCode: '55423-8',
    display: 'Number of steps',
    unit: 'steps',
    ucumCode: '{steps}',
  },
  heartRateBpm: {
    loincCode: '8867-4',
    display: 'Heart rate',
    unit: 'beats/min',
    ucumCode: '/min',
  },
  sleepMinutes: {
    loincCode: '93832-4',
    display: 'Sleep duration',
    unit: 'min',
    ucumCode: 'min',
  },
  hrvMs: {
    loincCode: '80404-7',
    display: 'R-R interval',
    unit: 'ms',
    ucumCode: 'ms',
  },
  spo2Percent: {
    loincCode: '59408-5',
    display: 'Oxygen saturation',
    unit: '%',
    ucumCode: '%',
  },
  caloriesBurned: {
    loincCode: '41981-2',
    display: 'Calories burned',
    unit: 'kcal',
    ucumCode: 'kcal',
  },
}

export function mapToFhir(data: NormalisedData): FhirObservation[] {
  const observations: FhirObservation[] = []

  for (const [key, mapping] of Object.entries(METRIC_MAPPINGS)) {
    const value = data[key as keyof NormalisedData]
    if (value === undefined || typeof value !== 'number') continue

    observations.push({
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [
          {
            system: LOINC_SYSTEM,
            code: mapping.loincCode,
            display: mapping.display,
          },
        ],
      },
      subject: {
        reference: `Patient/${data.patientId}`,
      },
      effectiveDateTime: data.recordedAt.toISOString(),
      valueQuantity: {
        value,
        unit: mapping.unit,
        system: UCUM_SYSTEM,
        code: mapping.ucumCode,
      },
    })
  }

  return observations
}
