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

export type SalesforceApiMode = 'platform-fhir' | 'healthcare-api'

export interface FhirIdentifier {
  system?: string
  value?: string
}

export interface FhirHumanName {
  family?: string
  given?: string[]
}

export interface FhirPatient {
  resourceType: 'Patient'
  id?: string
  identifier?: FhirIdentifier[]
  name?: FhirHumanName[]
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
}

export interface FhirBundleEntry<TResource> {
  resource?: TResource
}

export interface FhirBundle<TResource> {
  resourceType: 'Bundle'
  total?: number
  entry?: FhirBundleEntry<TResource>[]
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
    text?: string
  }
  subject: {
    reference: string
  }
  effectiveDateTime: string
  issued?: string
  valueQuantity: {
    value: number
    unit: string
    system: string
    code: string
  }
}

export interface HealthcareApiPatientDefaults {
  givenName?: string
  familyName?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
}

export interface HealthcareApiConfig {
  baseUrl?: string
  fhirVersion?: string
  apiVersion?: string
  patientIdentifierSystem?: string
  patientDefaults?: HealthcareApiPatientDefaults
}

export interface CareSyncConfig {
  salesforce: {
    clientId: string
    clientSecret: string
    instanceUrl: string
    loginUrl?: string
    apiMode?: SalesforceApiMode
    healthcareApi?: HealthcareApiConfig
    username?: string
    password?: string
  }
  openWearables?: {
    apiUrl: string
    apiKey: string
  }
  useMock?: boolean
  mockServerUrl?: string
}
