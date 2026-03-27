import { describe, it, expect } from 'vitest'
import { normalise } from '../src/normaliser'

describe('normaliser', () => {
  it('normalises a valid payload', () => {
    const result = normalise({
      deviceId: 'garmin-123',
      patientId: 'patient-456',
      timestamp: '2026-03-01T08:00:00Z',
      metrics: { steps: 8432, heartRate: 72 },
    })

    expect(result.steps).toBe(8432)
    expect(result.heartRateBpm).toBe(72)
    expect(result.patientId).toBe('patient-456')
    expect(result.recordedAt).toBeInstanceOf(Date)
  })

  it('throws on missing patientId', () => {
    expect(() =>
      normalise({ deviceId: 'd1', patientId: '', timestamp: '2026-03-01T08:00:00Z', metrics: {} })
    ).toThrow('patientId is required')
  })

  it('throws on invalid timestamp', () => {
    expect(() =>
      normalise({ deviceId: 'd1', patientId: 'p1', timestamp: 'not-a-date', metrics: {} })
    ).toThrow('Invalid timestamp')
  })
})
