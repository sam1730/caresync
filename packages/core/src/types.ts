export interface RawDeviceData {
  deviceId: string
  patientId: string
  timestamp: string
  metrics: {
    steps?: number
    heartRate?: number
    sleepMinutes?: number
    hrvMs?: number
    spo2Percent?: number
    caloriesBurned?: number
  }
}

export interface NormalisedData {
  patientId: string
  deviceId: string
  recordedAt: Date
  steps?: number
  heartRateBpm?: number
  sleepMinutes?: number
  hrvMs?: number
  spo2Percent?: number
  caloriesBurned?: number
}

export interface FhirObservation {
  resourceType: 'Observation'
  id?: string
  status: 'final' | 'preliminary'
  code: {
    coding: Array<{
      system: string
      code: string
      display: string
    }>
  }
  subject: {
    reference: string
  }
  effectiveDateTime: string
  valueQuantity: {
    value: number
    unit: string
    system: string
    code: string
  }
}

export interface CareSyncConfig {
  salesforce: {
    clientId: string
    clientSecret: string
    instanceUrl: string
    username: string
    password: string
  }
  openWearables?: {
    apiUrl: string
    apiKey: string
  }
  useMock?: boolean
  mockServerUrl?: string
}
