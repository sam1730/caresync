import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SalesforceConnector } from '../src/sf-connector'
import { FhirObservation, CareSyncConfig } from '../src/types'

const { mockPost, mockGet, mockAuthorize } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockAuthorize: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    post: mockPost,
    get: mockGet,
  },
}))

vi.mock('jsforce', () => ({
  Connection: vi.fn().mockImplementation((options?: { instanceUrl?: string; accessToken?: string }) => ({
    instanceUrl: options?.instanceUrl,
    accessToken: options?.accessToken,
    authorize: mockAuthorize.mockImplementation(async function (this: { accessToken?: string }) {
      this.accessToken = 'real-access-token'
      return { id: '005TEST', organizationId: '00DTEST' }
    }),
  })),
}))

const mockConfig: CareSyncConfig = {
  salesforce: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    instanceUrl: 'https://test.salesforce.com',
  },
  useMock: true,
  mockServerUrl: 'http://localhost:3001',
}

const healthcareConfig: CareSyncConfig = {
  salesforce: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    instanceUrl: 'https://example.my.salesforce.com',
    loginUrl: 'https://example.my.salesforce.com',
    apiMode: 'healthcare-api',
    healthcareApi: {
      baseUrl: 'https://api.healthcloud.salesforce.com',
      patientIdentifierSystem: 'https://caresync.dev/patient-id',
    },
  },
}

const sampleObservation: FhirObservation = {
  resourceType: 'Observation',
  status: 'final',
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '55423-8',
        display: 'Number of steps in unspecified time',
      },
    ],
  },
  subject: { reference: 'Patient/patient-001' },
  effectiveDateTime: '2026-03-01T08:00:00.000Z',
  valueQuantity: {
    value: 8432,
    unit: 'steps',
    system: 'http://unitsofmeasure.org',
    code: '{steps}',
  },
}

describe('SalesforceConnector', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockGet.mockReset()
    mockAuthorize.mockReset()
  })

  it('constructs without throwing', () => {
    expect(() => new SalesforceConnector(mockConfig)).not.toThrow()
  })

  it('throws on partial upsert failure', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 403,
        statusText: 'Forbidden',
        data: {
          errorCode: 'INSUFFICIENT_ACCESS',
          message: 'FHIR API is not enabled for this user',
        },
      },
    })

    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([sampleObservation])).rejects.toThrow(
      'Partial upsert failure: 1/1 failed. Number of steps in unspecified time (55423-8): HTTP 403 Forbidden - {"errorCode":"INSUFFICIENT_ACCESS","message":"FHIR API is not enabled for this user"}'
    )
  })

  it('resolves when all observations upsert successfully', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { id: 'mock-123' } })

    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([sampleObservation])).resolves.toBeUndefined()
    expect(mockPost).toHaveBeenCalledWith(
      'http://localhost:3001/services/data/v63.0/fhir/r4/Observation',
      sampleObservation,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/fhir+json',
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/fhir+json',
          'X-CORRELATION-ID': expect.any(String),
        }),
      })
    )
  })

  it('uses the documented sandbox healthcare host when no explicit healthcare base URL is configured', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { id: 'obs-123' } })

    const connector = new SalesforceConnector({
      salesforce: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        instanceUrl: 'https://example.sandbox.my.salesforce.com',
        loginUrl: 'https://example.sandbox.my.salesforce.com',
        apiMode: 'healthcare-api',
      },
    })

    await expect(connector.upsertObservations([sampleObservation])).resolves.toBeUndefined()
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.healthcloud.salesforce.com/sandBox/clinical-diagnostics/fhir-r4/v1/Observation',
      sampleObservation,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/fhir+json',
          Authorization: 'Bearer real-access-token',
          'Content-Type': 'application/fhir+json',
        }),
      })
    )
  })

  it('uses the Healthcare API clinical diagnostics endpoint when configured', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { id: 'obs-123' } })

    const connector = new SalesforceConnector(healthcareConfig)
    await expect(connector.upsertObservations([sampleObservation])).resolves.toBeUndefined()
    expect(mockAuthorize).toHaveBeenCalledWith({ grant_type: 'client_credentials' })
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.healthcloud.salesforce.com/clinical-diagnostics/fhir-r4/v1/Observation',
      sampleObservation,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/fhir+json',
          Authorization: 'Bearer real-access-token',
          'Content-Type': 'application/fhir+json',
        }),
      })
    )
  })

  it('throws for an invalid runtime api mode', async () => {
    const connector = new SalesforceConnector({
      ...healthcareConfig,
      salesforce: {
        ...healthcareConfig.salesforce,
        apiMode: 'broken-mode' as unknown as 'healthcare-api',
      },
    })

    await expect(connector.upsertObservations([sampleObservation])).rejects.toThrow(
      'Invalid Salesforce API mode: broken-mode. Expected "platform-fhir" or "healthcare-api".'
    )
  })

  it('resolves an existing healthcare Patient by identifier search', async () => {
    mockGet
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({
        data: {
          resourceType: 'Bundle',
          total: 1,
          entry: [
            {
              resource: {
                resourceType: 'Patient',
                id: '001PATIENT',
              },
            },
          ],
        },
      })

    const connector = new SalesforceConnector(healthcareConfig)
    await expect(connector.resolvePatientReference('patient-001')).resolves.toBe('001PATIENT')
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      'https://api.healthcloud.salesforce.com/admin/fhir-r4/v1/Patient?identifier=https%3A%2F%2Fcaresync.dev%2Fpatient-id%7Cpatient-001',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/fhir+json',
          Authorization: 'Bearer real-access-token',
        }),
      })
    )
  })

  it('creates a healthcare Patient when no existing match is found', async () => {
    mockGet
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: { resourceType: 'Bundle', total: 0, entry: [] } })
    mockPost.mockResolvedValueOnce({
      data: {
        resourceType: 'Patient',
        id: '001CREATED',
      },
    })

    const connector = new SalesforceConnector(healthcareConfig)
    await expect(connector.resolvePatientReference('patient-001')).resolves.toBe('001CREATED')
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.healthcloud.salesforce.com/admin/fhir-r4/v1/Patient',
      expect.objectContaining({
        resourceType: 'Patient',
        identifier: [
          {
            system: 'https://caresync.dev/patient-id',
            value: 'patient-001',
          },
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/fhir+json',
          Authorization: 'Bearer real-access-token',
          'Content-Type': 'application/fhir+json',
        }),
      })
    )
  })

  it('resolves with empty observations array', async () => {
    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([])).resolves.toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
