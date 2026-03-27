import { Connection } from 'jsforce'
import axios from 'axios'
import { FhirObservation, CareSyncConfig } from './types'

export class SalesforceConnector {
  private config: CareSyncConfig
  private conn: Connection | null = null

  constructor(config: CareSyncConfig) {
    this.config = config
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
      oauth2: {
        clientId: this.config.salesforce.clientId,
        clientSecret: this.config.salesforce.clientSecret,
        loginUrl: this.config.salesforce.instanceUrl,
      },
    })

    await conn.login(
      this.config.salesforce.username,
      this.config.salesforce.password
    )

    this.conn = conn
    return conn
  }

  async upsertObservations(observations: FhirObservation[]): Promise<void> {
    const baseUrl = this.config.useMock
      ? this.config.mockServerUrl ?? 'http://localhost:3001'
      : this.config.salesforce.instanceUrl

    const results = await Promise.allSettled(
      observations.map((obs) =>
        axios.post(
          `${baseUrl}/services/data/v59.0/fhir/r4/Observation`,
          obs,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              Authorization: `Bearer mock-token`,
            },
          }
        )
      )
    )

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.error(`${failures.length} observations failed to upsert`)
      throw new Error(`Partial upsert failure: ${failures.length}/${observations.length} failed`)
    }
  }
}
