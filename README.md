# CareSync

> Wearable data → FHIR R4 → Salesforce Health Cloud  
> A headless TypeScript library. No UI. Drop it into any backend.

## What it does

CareSync is an open-source npm library that:
1. Pulls health data from wearable devices via the Open Wearables API
2. Normalises the raw data into a clean internal schema
3. Maps it to FHIR R4 `Observation` resources
4. Authenticates with Salesforce via OAuth 2.0
5. Upserts the FHIR records into Salesforce Health Cloud

A local mock server is included so developers can test without a real Salesforce org.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker + Docker Compose (for mock server)
- A free [Salesforce Developer Org](https://developer.salesforce.com/signup)

## Installation

```bash
npm install @caresync/core
```

## Quick start

```typescript
import { CareSync } from '@caresync/core'

async function main() {
  const client = new CareSync({
    salesforce: {
      clientId: process.env.SF_CLIENT_ID!,
      clientSecret: process.env.SF_CLIENT_SECRET!,
      instanceUrl: process.env.SF_INSTANCE_URL!,
      loginUrl: process.env.SF_LOGIN_URL,
      apiMode: 'healthcare-api',
      healthcareApi: {
        baseUrl: process.env.SF_HEALTHCARE_API_BASE_URL,
        patientIdentifierSystem: process.env.SF_HEALTHCARE_PATIENT_IDENTIFIER_SYSTEM,
      },
    },
    useMock: process.env.USE_MOCK === 'true',
    mockServerUrl: process.env.MOCK_SERVER_URL,
  })

  await client.push({
    deviceId: 'garmin-forerunner-255',
    patientId: 'patient-001',
    timestamp: new Date().toISOString(),
    metrics: {
      steps: 9432,
      heartRate: 68,
      sleepMinutes: 460,
      hrvMs: 58,
      spo2Percent: 98,
      caloriesBurned: 2100,
    },
  })
}

await main()
```

## Environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Salesforce Connected App credentials
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_INSTANCE_URL=https://your-domain.my.salesforce.com
SF_LOGIN_URL=https://your-domain.my.salesforce.com
SF_API_MODE=healthcare-api

# Salesforce Healthcare API (used when SF_API_MODE=healthcare-api)
SF_HEALTHCARE_API_BASE_URL=https://api.healthcloud.salesforce.com
SF_HEALTHCARE_PATIENT_IDENTIFIER_SYSTEM=https://caresync.dev/patient-id
SF_HEALTHCARE_PATIENT_GIVEN_NAME=CareSync
SF_HEALTHCARE_PATIENT_FAMILY_NAME=Demo
SF_HEALTHCARE_PATIENT_GENDER=unknown

# Open Wearables API
OPEN_WEARABLES_API_URL=https://api.openwearables.io
OPEN_WEARABLES_API_KEY=your_api_key

# Mock server (for local dev/testing)
MOCK_SERVER_URL=http://localhost:3001
USE_MOCK=true
```

## API modes

CareSync now supports two Salesforce write modes:

- `platform-fhir`: posts to the org-hosted Salesforce FHIR REST endpoint. This is the mode used by the local mock server.
- `healthcare-api`: posts to the Salesforce Healthcare API host, for example `https://api.healthcloud.salesforce.com/clinical-diagnostics/fhir-r4/v1/Observation`, and resolves or creates a real `Patient` resource before writing Observations.

## Running locally

```bash
# 1. Clone and install
git clone https://github.com/yourname/caresync
cd caresync
npm install

# 2. Copy env file
cp .env.example .env
# Leave USE_MOCK=true and SF_API_MODE=platform-fhir for local testing without Salesforce credentials

# 3. Build the workspaces
npm run build

# 4. Run tests
npm test

# 5. Start the mock server in a separate terminal
npm run mock

# 6. Run the example against the mock server
USE_MOCK=true SF_API_MODE=platform-fhir MOCK_SERVER_URL=http://localhost:3001 npm run example
```

## Local development

```bash
# Run the mock server with Docker instead of ts-node-dev
npm run dev

# Run the mock server directly from the workspace
npm run mock

# Run the example against the Salesforce Healthcare API
USE_MOCK=false SF_API_MODE=healthcare-api npm run example

# Run the example against the org-hosted platform FHIR endpoint instead
USE_MOCK=false SF_API_MODE=platform-fhir npm run example

# Run the example against Salesforce after setting USE_MOCK=false in .env
npm run example
```

## Running tests

```bash
npm test
```

## Project structure

```
caresync/
├── packages/
│   ├── core/               ← @caresync/core npm package
│   │   ├── src/
│   │   │   ├── normaliser.ts
│   │   │   ├── fhir-mapper.ts
│   │   │   ├── sf-connector.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── tests/
│   └── mock-server/        ← local Fastify mock of Health Cloud
├── examples/
├── docker-compose.yml
└── .env.example
```

## Publishing

```bash
cd packages/core
npm run build
npm publish --access public
```

## Salesforce Setup

To use CareSync with a real Salesforce org, you need to set up a Connected App and choose which API surface you want to target.

### 1. Create a Connected App

1. Log in to your [Salesforce Developer Org](https://developer.salesforce.com/signup)
2. Navigate to **Setup** → **App Manager**
3. Click **New Connected App**
4. Fill in the basic information:
   - Connected App Name: `CareSync`
   - API Name: `CareSync`
   - Contact Email: your email
5. Enable OAuth Settings:
   - Check **Enable OAuth Settings**
   - Callback URL: `http://localhost:3000/callback` (or your callback URL)
   - Selected OAuth Scopes:
  - `api` - Manage user data via APIs
6. Click **Save** and then **Continue**
7. Copy the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)
8. Enable the **Client Credentials Flow** for the Connected App
9. Assign a **Run As** user for the Connected App
10. If you use `SF_API_MODE=healthcare-api`, add Healthcare API custom scopes for Patient and Observation access.

Recommended custom scopes for `healthcare-api` mode:

- `system_patient_read`
- `system_patient_write`
- `system_observation_write`

Or grant the broader equivalents:

- `system_all_read`
- `system_all_write`

### 2. Choose the API surface

For `SF_API_MODE=platform-fhir`:

1. In Salesforce Setup, search for **Health Cloud**
2. Navigate to **Health Cloud Settings**
3. Enable **FHIR R4 API**
4. Save your settings

For `SF_API_MODE=healthcare-api`:

1. Accept the Salesforce Healthcare API terms and enable access for your org
2. Use the Healthcare API host for your region, such as `https://api.healthcloud.salesforce.com`
3. Keep using your org My Domain URL only for OAuth token issuance

### 3. Configure Your Environment

1. Copy your org's My Domain URL from the browser (for example `https://yourorg.my.salesforce.com`)
2. Update your `.env` file with:
   - `SF_CLIENT_ID`: Your Consumer Key
   - `SF_CLIENT_SECRET`: Your Consumer Secret
  - `SF_INSTANCE_URL`: Your org My Domain URL
  - `SF_LOGIN_URL`: Your org My Domain URL
  - `SF_API_MODE`: `platform-fhir` or `healthcare-api`
  - `SF_HEALTHCARE_API_BASE_URL`: your regional Healthcare API host when using `healthcare-api`
  - `SF_HEALTHCARE_PATIENT_IDENTIFIER_SYSTEM`: the identifier system used to resolve or create Patients before Observation writes
3. Set `USE_MOCK=false` to use the real Salesforce org

When `SF_API_MODE=healthcare-api`, CareSync first tries to resolve `patientId` as an existing `Patient/{id}`. If that is not found, it searches by `identifier=<system>|<patientId>`. If no match exists, it creates a minimal `Patient` resource and uses the returned resource id for the Observation `subject.reference`.

## Using Open Wearables with CareSync

CareSync is designed to sync wearable health data from the Open Wearables API into Salesforce Health Cloud. Here's how to set it up:

### 1. Get Open Wearables API Access

1. Visit [Open Wearables](https://openwearables.io) or your Open Wearables instance
2. Sign up for an account or log in
3. Navigate to your API settings/developer console
4. Generate an API key
5. Note your API URL (e.g., `https://api.openwearables.io`)

### 2. Configure CareSync for Open Wearables

Update your `.env` file with Open Wearables credentials:

```env
OPEN_WEARABLES_API_URL=https://api.openwearables.io
OPEN_WEARABLES_API_KEY=your_api_key_here
```

### 3. Fetch Data from Open Wearables

CareSync expects wearable data in the following format:

```typescript
{
  deviceId: string          // e.g., "garmin-forerunner-255"
  patientId: string         // e.g., "patient-001"
  timestamp: string         // ISO 8601 format
  metrics: {
    steps?: number
    heartRate?: number
    sleepMinutes?: number
    hrvMs?: number
    spo2Percent?: number
    caloriesBurned?: number
  }
}
```

### 4. Integration Pattern

To integrate Open Wearables with CareSync:

```typescript
import { CareSync } from '@caresync/core'
import axios from 'axios'

// Initialize CareSync
const careSync = new CareSync({
  salesforce: {
    clientId: process.env.SF_CLIENT_ID!,
    clientSecret: process.env.SF_CLIENT_SECRET!,
    instanceUrl: process.env.SF_INSTANCE_URL!,
    loginUrl: process.env.SF_LOGIN_URL,
    apiMode: 'healthcare-api',
    healthcareApi: {
      baseUrl: process.env.SF_HEALTHCARE_API_BASE_URL,
      patientIdentifierSystem: process.env.SF_HEALTHCARE_PATIENT_IDENTIFIER_SYSTEM,
    },
  },
  useMock: false,
})

// Fetch data from Open Wearables
async function syncOpenWearablesData(patientId: string) {
  try {
    // Fetch from Open Wearables API
    const response = await axios.get(
      `${process.env.OPEN_WEARABLES_API_URL}/patients/${patientId}/metrics`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPEN_WEARABLES_API_KEY}`,
        },
      }
    )

    // Transform Open Wearables response to CareSync format
    const wearableData = {
      deviceId: response.data.deviceId || 'unknown-device',
      patientId: patientId,
      timestamp: response.data.timestamp,
      metrics: {
        steps: response.data.steps,
        heartRate: response.data.heartRate,
        sleepMinutes: response.data.sleepMinutes,
        hrvMs: response.data.hrv,
        spo2Percent: response.data.spo2,
        caloriesBurned: response.data.calories,
      },
    }

    // Push to Salesforce Health Cloud via CareSync
    await careSync.push(wearableData)
    console.log(`Successfully synced data for patient ${patientId}`)
  } catch (error) {
    console.error('Failed to sync wearable data:', error)
    throw error
  }
}

// Example usage
await syncOpenWearablesData('patient-001')
```

### 5. Supported Metrics

CareSync maps the following metrics to FHIR R4 Observations:

| Metric | LOINC Code | UCUM Unit | Description |
|--------|-----------|-----------|-------------|
| `steps` | 55423-8 | {steps} | Number of steps |
| `heartRate` | 8867-4 | /min | Heart rate in beats per minute |
| `sleepMinutes` | 93832-4 | min | Sleep duration in minutes |
| `hrvMs` | 80404-7 | ms | Heart rate variability (R-R interval) |
| `spo2Percent` | 59408-5 | % | Blood oxygen saturation |
| `caloriesBurned` | 41981-2 | kcal | Calories burned |

### 6. Testing with Mock Data

For development and testing without a real Open Wearables account:

1. Set `USE_MOCK=true` in your `.env`
2. Set `MOCK_SERVER_URL=http://localhost:3001`
3. Use the sample payload format in `examples/sample-payload.json`
4. Start the mock server with `npm run mock` or `npm run dev`
4. Run the example: `npx ts-node examples/basic-sync.ts`

### 7. Production Considerations

When moving to production:

- Implement proper error handling for API failures
- Add retry logic for transient failures
- Consider rate limiting when syncing multiple patients
- Implement secure credential storage (e.g., AWS Secrets Manager, Azure Key Vault)
- Set up monitoring and alerting for sync failures
- Consider implementing a queue for bulk processing
