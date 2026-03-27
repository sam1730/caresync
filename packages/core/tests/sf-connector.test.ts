import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SalesforceConnector } from '../src/sf-connector'
import { FhirObservation, CareSyncConfig } from '../src/types'

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }))

vi.mock('axios', () => ({
  default: {
    post: mockPost,
  },
}))

const mockConfig: CareSyncConfig = {
  salesforce: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    instanceUrl: 'https://test.salesforce.com',
    username: 'test@example.com',
    password: 'testpassword',
  },
  useMock: true,
  mockServerUrl: 'http://localhost:3001',
}

const sampleObservation: FhirObservation = {
  resourceType: 'Observation',
  status: 'final',
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '55423-8',
        display: 'Number of steps',
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
  })

  it('constructs without throwing', () => {
    expect(() => new SalesforceConnector(mockConfig)).not.toThrow()
  })

  it('throws on partial upsert failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'))

    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([sampleObservation])).rejects.toThrow(
      'Partial upsert failure'
    )
  })

  it('resolves when all observations upsert successfully', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { id: 'mock-123' } })

    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([sampleObservation])).resolves.toBeUndefined()
  })

  it('resolves with empty observations array', async () => {
    const connector = new SalesforceConnector(mockConfig)
    await expect(connector.upsertObservations([])).resolves.toBeUndefined()
  })
})
