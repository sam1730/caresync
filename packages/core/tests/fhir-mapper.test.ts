import { describe, it, expect } from 'vitest'
import { mapToFhir } from '../src/fhir-mapper'

describe('fhir-mapper', () => {
  it('maps steps to a valid FHIR Observation', () => {
    const observations = mapToFhir({
      patientId: 'patient-456',
      deviceId: 'garmin-123',
      recordedAt: new Date('2026-03-01T08:00:00Z'),
      steps: 8432,
    })

    expect(observations).toHaveLength(1)
    expect(observations[0].resourceType).toBe('Observation')
    expect(observations[0].code.coding[0].code).toBe('55423-8')
    expect(observations[0].code.coding[0].display).toBe('Number of steps in unspecified time')
    expect(observations[0].code.text).toBe('Number of steps in unspecified time')
    expect(observations[0].valueQuantity.value).toBe(8432)
    expect(observations[0].subject.reference).toBe('Patient/patient-456')
    expect(observations[0].issued).toBe('2026-03-01T08:00:00.000Z')
  })

  it('uses an explicit patient subject reference when provided', () => {
    const observations = mapToFhir(
      {
        patientId: 'patient-456',
        deviceId: 'garmin-123',
        recordedAt: new Date('2026-03-01T08:00:00Z'),
        heartRateBpm: 72,
      },
      { subjectReference: 'Patient/001REALPATIENT' }
    )

    expect(observations[0].subject.reference).toBe('Patient/001REALPATIENT')
  })

  it('skips undefined metrics', () => {
    const observations = mapToFhir({
      patientId: 'p1',
      deviceId: 'd1',
      recordedAt: new Date(),
    })
    expect(observations).toHaveLength(0)
  })

  it('maps all metrics when all provided', () => {
    const observations = mapToFhir({
      patientId: 'p1',
      deviceId: 'd1',
      recordedAt: new Date(),
      steps: 1000,
      heartRateBpm: 70,
      sleepMinutes: 480,
      hrvMs: 55,
      spo2Percent: 98,
      caloriesBurned: 500,
    })
    expect(observations).toHaveLength(6)
  })
})
