import { Connection } from 'jsforce'
import { randomUUID } from 'node:crypto'
import axios from 'axios'
import { FhirBundle, FhirObservation, FhirPatient, CareSyncConfig, SalesforceApiMode } from './types'

const PLATFORM_FHIR_OBSERVATION_PATH = '/services/data/v63.0/fhir/r4/Observation'
const DEFAULT_HEALTHCARE_API_BASE_URL = 'https://api.healthcloud.salesforce.com'
const DEFAULT_HEALTHCARE_FHIR_VERSION = 'fhir-r4'
const DEFAULT_HEALTHCARE_API_VERSION = 'v1'
const DEFAULT_PATIENT_IDENTIFIER_SYSTEM = 'https://caresync.dev/patient-id'

function resolveLoginUrl(config: CareSyncConfig): string {
  const configuredLoginUrl = config.salesforce.loginUrl?.trim()

  if (
    !configuredLoginUrl ||
    configuredLoginUrl === 'https://login.salesforce.com' ||
    configuredLoginUrl === 'https://test.salesforce.com'
  ) {
    return config.salesforce.instanceUrl
  }

  return configuredLoginUrl
}

function hasResponseStatus(error: unknown, statusCode: number): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false
  }

  const response = (error as { response?: { status?: number } }).response
  return response?.status === statusCode
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveApiMode(config: CareSyncConfig): SalesforceApiMode {
  const apiMode = config.salesforce.apiMode ?? 'platform-fhir'

  if (apiMode !== 'platform-fhir' && apiMode !== 'healthcare-api') {
    throw new Error(
      `Invalid Salesforce API mode: ${String(apiMode)}. Expected "platform-fhir" or "healthcare-api".`
    )
  }

  return apiMode
}

function isHealthcareApiMode(config: CareSyncConfig): boolean {
  return !config.useMock && resolveApiMode(config) === 'healthcare-api'
}

function resolveHealthcareApiBaseUrl(config: CareSyncConfig): string {
  const configuredBaseUrl = config.salesforce.healthcareApi?.baseUrl?.trim()
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl)
  }

  if (config.salesforce.instanceUrl.includes('.sandbox.')) {
    return `${DEFAULT_HEALTHCARE_API_BASE_URL}/sandBox`
  }

  return DEFAULT_HEALTHCARE_API_BASE_URL
}

function resolveHealthcareApiPath(config: CareSyncConfig, moduleName: string, resourceType: string): string {
  const healthcareApi = config.salesforce.healthcareApi
  const fhirVersion = healthcareApi?.fhirVersion ?? DEFAULT_HEALTHCARE_FHIR_VERSION
  const apiVersion = healthcareApi?.apiVersion ?? DEFAULT_HEALTHCARE_API_VERSION
  return `${resolveHealthcareApiBaseUrl(config)}/${moduleName}/${fhirVersion}/${apiVersion}/${resourceType}`
}

function buildFhirHeaders(accessToken: string, includeContentType = false): Record<string, string> {
  return {
    Accept: 'application/fhir+json',
    Authorization: `Bearer ${accessToken}`,
    'X-CORRELATION-ID': randomUUID(),
    ...(includeContentType ? { 'Content-Type': 'application/fhir+json' } : {}),
  }
}

function formatErrorData(data: unknown): string {
  if (typeof data === 'string') {
    return data
  }

  if (data === undefined) {
    return 'No response body'
  }

  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

function describeObservation(observation: FhirObservation, index: number): string {
  const coding = observation.code.coding[0]

  if (!coding) {
    return `Observation ${index + 1}`
  }

  return `${coding.display} (${coding.code})`
}

function formatHttpFailure(context: string, reason: unknown): string {
  if (typeof reason === 'object' && reason !== null && 'response' in reason) {
    const response = reason as {
      response?: {
        status?: number
        statusText?: string
        data?: unknown
      }
    }

    const status = response.response?.status ?? 'unknown'
    const statusText = response.response?.statusText ? ` ${response.response.statusText}` : ''
    const details = formatErrorData(response.response?.data)
    return `${context}: HTTP ${status}${statusText} - ${details}`
  }

  if (reason instanceof Error) {
    return `${context}: ${reason.message.trim() || 'No error details returned'}`
  }

  const fallback = String(reason).trim()
  return `${context}: ${fallback || 'No error details returned'}`
}

function formatFailureReason(observation: FhirObservation, index: number, reason: unknown): string {
  return formatHttpFailure(describeObservation(observation, index), reason)
}

export class SalesforceConnector {
  private config: CareSyncConfig
  private conn: Connection | null = null

  constructor(config: CareSyncConfig) {
    this.config = config
  }

  private getObservationUrl(): string {
    if (this.config.useMock) {
      return `${this.config.mockServerUrl ?? 'http://localhost:3001'}${PLATFORM_FHIR_OBSERVATION_PATH}`
    }

    if (isHealthcareApiMode(this.config)) {
      return resolveHealthcareApiPath(this.config, 'clinical-diagnostics', 'Observation')
    }

    return `${trimTrailingSlash(this.config.salesforce.instanceUrl)}${PLATFORM_FHIR_OBSERVATION_PATH}`
  }

  private getPatientCollectionUrl(): string {
    return resolveHealthcareApiPath(this.config, 'admin', 'Patient')
  }

  private getPatientIdentifierSystem(): string {
    return this.config.salesforce.healthcareApi?.patientIdentifierSystem ?? DEFAULT_PATIENT_IDENTIFIER_SYSTEM
  }

  private buildPatientResource(patientId: string): FhirPatient {
    const defaults = this.config.salesforce.healthcareApi?.patientDefaults

    return {
      resourceType: 'Patient',
      identifier: [
        {
          system: this.getPatientIdentifierSystem(),
          value: patientId,
        },
      ],
      name: [
        {
          family: defaults?.familyName ?? patientId,
          given: [defaults?.givenName ?? 'CareSync'],
        },
      ],
      ...(defaults?.gender ? { gender: defaults.gender } : {}),
      ...(defaults?.birthDate ? { birthDate: defaults.birthDate } : {}),
    }
  }

  private async connect(): Promise<Connection> {
    if (this.conn) return this.conn

    const baseUrl = this.config.useMock
      ? this.config.mockServerUrl ?? 'http://localhost:3001'
      : this.config.salesforce.instanceUrl

    if (this.config.useMock) {
      // Mock mode — no real auth needed
      this.conn = new Connection({ instanceUrl: baseUrl, accessToken: 'mock-token' })
      return this.conn
    }

    const conn = new Connection({
      instanceUrl: this.config.salesforce.instanceUrl,
      oauth2: {
        clientId: this.config.salesforce.clientId,
        clientSecret: this.config.salesforce.clientSecret,
        loginUrl: resolveLoginUrl(this.config),
      },
    })

    await conn.authorize({ grant_type: 'client_credentials' })

    this.conn = conn
    return conn
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) {
      this.conn = null
    }

    const conn = await this.connect()
    const accessToken = conn.accessToken

    if (!accessToken) {
      throw new Error('Salesforce authentication did not provide an access token')
    }

    return accessToken
  }

  private async sendWithAuth<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
    let accessToken = await this.getAccessToken()

    try {
      return await request(accessToken)
    } catch (error) {
      if (!this.config.useMock && hasResponseStatus(error, 401)) {
        accessToken = await this.getAccessToken(true)
        return request(accessToken)
      }

      throw error
    }
  }

  async resolvePatientReference(patientId: string): Promise<string> {
    if (!isHealthcareApiMode(this.config)) {
      return patientId
    }

    const patientCollectionUrl = this.getPatientCollectionUrl()

    try {
      const existingPatient = await this.sendWithAuth(async (accessToken) => {
        const response = await axios.get<FhirPatient>(`${patientCollectionUrl}/${encodeURIComponent(patientId)}`, {
          headers: buildFhirHeaders(accessToken),
        })

        return response.data
      })

      if (existingPatient.id) {
        return existingPatient.id
      }
    } catch (error) {
      if (!hasResponseStatus(error, 404)) {
        throw new Error(`Failed to resolve ${formatHttpFailure(`Patient/${patientId}`, error)}`)
      }
    }

    const identifierQuery = encodeURIComponent(`${this.getPatientIdentifierSystem()}|${patientId}`)
    const searchResult = await this.sendWithAuth(async (accessToken) => {
      const response = await axios.get<FhirBundle<FhirPatient>>(`${patientCollectionUrl}?identifier=${identifierQuery}`, {
        headers: buildFhirHeaders(accessToken),
      })

      return response.data
    })

    const matchedPatient = searchResult.entry?.find((entry) => entry.resource?.id)?.resource
    if (matchedPatient?.id) {
      return matchedPatient.id
    }

    const createdPatient = await this.sendWithAuth(async (accessToken) => {
      const response = await axios.post<FhirPatient>(
        patientCollectionUrl,
        this.buildPatientResource(patientId),
        {
          headers: buildFhirHeaders(accessToken, true),
        }
      )

      return response.data
    })

    if (!createdPatient.id) {
      throw new Error(`Patient create succeeded without returning an id for patient identifier ${patientId}`)
    }

    return createdPatient.id
  }

  async upsertObservations(observations: FhirObservation[]): Promise<void> {
    if (observations.length === 0) {
      return
    }

    const observationUrl = this.getObservationUrl()
    const results = await Promise.allSettled(
      observations.map((obs) =>
        this.sendWithAuth((accessToken) =>
          axios.post(
            observationUrl,
            obs,
            {
              headers: buildFhirHeaders(accessToken, true),
            }
          )
        )
      )
    )

    const failures = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [formatFailureReason(observations[index], index, result.reason)]
        : []
    )

    if (failures.length > 0) {
      throw new Error(
        `Partial upsert failure: ${failures.length}/${observations.length} failed. ${failures.join('; ')}`
      )
    }
  }
}
