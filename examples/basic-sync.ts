import { CareSync, RawDeviceData, SalesforceApiMode } from '@caresync/core'
import * as dotenv from 'dotenv'
import samplePayload from './sample-payload.json'

dotenv.config()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function resolveApiMode(value: string | undefined, useMock: boolean): SalesforceApiMode {
  const apiMode = value ?? (useMock ? 'platform-fhir' : 'healthcare-api')

  if (apiMode !== 'platform-fhir' && apiMode !== 'healthcare-api') {
    throw new Error(
      `Invalid SF_API_MODE value: ${apiMode}. Expected "platform-fhir" or "healthcare-api".`
    )
  }

  return apiMode
}

async function main(): Promise<void> {
  const useMock = process.env.USE_MOCK === 'true'
  const apiMode = resolveApiMode(process.env.SF_API_MODE, useMock)

  const client = new CareSync({
    salesforce: {
      clientId: useMock ? process.env.SF_CLIENT_ID ?? 'mock-client-id' : requireEnv('SF_CLIENT_ID'),
      clientSecret: useMock
        ? process.env.SF_CLIENT_SECRET ?? 'mock-client-secret'
        : requireEnv('SF_CLIENT_SECRET'),
      instanceUrl: useMock
        ? process.env.SF_INSTANCE_URL ?? 'https://mock.salesforce.local'
        : requireEnv('SF_INSTANCE_URL'),
      loginUrl: useMock ? undefined : process.env.SF_LOGIN_URL ?? process.env.SF_INSTANCE_URL,
      apiMode,
      healthcareApi: apiMode === 'healthcare-api'
        ? {
            baseUrl: process.env.SF_HEALTHCARE_API_BASE_URL,
            patientIdentifierSystem: process.env.SF_HEALTHCARE_PATIENT_IDENTIFIER_SYSTEM,
            patientDefaults: {
              givenName: process.env.SF_HEALTHCARE_PATIENT_GIVEN_NAME,
              familyName: process.env.SF_HEALTHCARE_PATIENT_FAMILY_NAME,
              gender: process.env.SF_HEALTHCARE_PATIENT_GENDER as 'male' | 'female' | 'other' | 'unknown' | undefined,
              birthDate: process.env.SF_HEALTHCARE_PATIENT_BIRTH_DATE,
            },
          }
        : undefined,
    },
    useMock,
    mockServerUrl: process.env.MOCK_SERVER_URL,
  })

  await client.push(samplePayload as RawDeviceData)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
