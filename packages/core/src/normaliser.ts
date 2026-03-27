import { RawDeviceData, NormalisedData } from './types'

export function normalise(raw: RawDeviceData): NormalisedData {
  if (!raw.patientId) throw new Error('patientId is required')
  if (!raw.timestamp) throw new Error('timestamp is required')

  const recordedAt = new Date(raw.timestamp)
  if (isNaN(recordedAt.getTime())) {
    throw new Error(`Invalid timestamp: ${raw.timestamp}`)
  }

  return {
    patientId: raw.patientId,
    deviceId: raw.deviceId,
    recordedAt,
    steps: raw.metrics.steps ?? undefined,
    heartRateBpm: raw.metrics.heartRate ?? undefined,
    sleepMinutes: raw.metrics.sleepMinutes ?? undefined,
    hrvMs: raw.metrics.hrvMs ?? undefined,
    spo2Percent: raw.metrics.spo2Percent ?? undefined,
    caloriesBurned: raw.metrics.caloriesBurned ?? undefined,
  }
}
