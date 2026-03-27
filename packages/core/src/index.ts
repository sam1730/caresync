import { normalise } from './normaliser'
import { mapToFhir } from './fhir-mapper'
import { SalesforceConnector } from './sf-connector'
import { CareSyncConfig, RawDeviceData } from './types'

export { normalise } from './normaliser'
export { mapToFhir } from './fhir-mapper'
export { SalesforceConnector } from './sf-connector'
export * from './types'

export class CareSync {
  private connector: SalesforceConnector

  constructor(private config: CareSyncConfig) {
    this.connector = new SalesforceConnector(config)
  }

  async push(rawData: RawDeviceData): Promise<void> {
    const normalised = normalise(rawData)
    const observations = mapToFhir(normalised)
    await this.connector.upsertObservations(observations)
    console.log(`Synced ${observations.length} observations for patient ${rawData.patientId}`)
  }
}
