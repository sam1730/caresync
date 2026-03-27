# CareSync

> Wearable data → FHIR R4 → Salesforce Health Cloud  
> A headless TypeScript library. No UI. Drop it into any backend.

## What it does

CareSync is an open-source npm library that:
1. accepts wearable data from Open Wearables, mock payloads, or your own ingestion pipeline
2. normalises the raw data into a clean internal schema
3. maps it to FHIR R4 `Observation` resources
4. authenticates with Salesforce via OAuth 2.0
5. upserts the FHIR records into Salesforce Health Cloud

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

## How CareSync fits into your pipeline

CareSync is intentionally headless. It does **not** fetch vendor data for you. Instead, it gives you a reusable pipeline for:

1. accepting wearable data from Open Wearables, your own ingestion service, CSV imports, or partner APIs
2. normalising the payload into a stable internal shape
3. mapping supported metrics to FHIR R4 `Observation`
4. posting those resources to Salesforce Health Cloud

That means you can use CareSync with:

- **Open Wearables** as the upstream data source
- **your own ETL jobs** that already collect device data
- **local mock data** during development
- **custom backend services** that need a clean TypeScript API

## Quick start

### Option A: run locally with the mock server

This is the fastest way to try CareSync without Salesforce credentials.

```bash
# 1. Clone and install
git clone https://github.com/yourname/caresync
cd caresync
npm install

# 2. Copy env file
cp .env.example .env

# 3. Use the local mock server
# Keep USE_MOCK=true
# Set SF_API_MODE=platform-fhir

# 4. Start the mock server
npm run mock

# 5. In another terminal, run the example
npm run example
```

### Option B: use a real Salesforce org

Use this when you want to write to Salesforce Health Cloud.

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
        patientDefaults: {
          givenName: process.env.SF_HEALTHCARE_PATIENT_GIVEN_NAME,
          familyName: process.env.SF_HEALTHCARE_PATIENT_FAMILY_NAME,
          gender: process.env.SF_HEALTHCARE_PATIENT_GENDER as 'male' | 'female' | 'other' | 'unknown' | undefined,
          birthDate: process.env.SF_HEALTHCARE_PATIENT_BIRTH_DATE,
        },
      },
    },
    useMock: false,
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

### Option C: use the reusable functions directly

If you want full control over each stage:

```typescript
import { mapToFhir, normalise } from '@caresync/core'

const raw = {
  deviceId: 'garmin-forerunner-255',
  patientId: 'patient-001',
  timestamp: new Date().toISOString(),
  metrics: {
    steps: 9432,
    heartRate: 68,
  },
}

const normalised = normalise(raw)
const observations = mapToFhir(normalised)

console.log({ normalised, observations })
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
SF_HEALTHCARE_PATIENT_BIRTH_DATE=1970-01-01

# Open Wearables API
OPEN_WEARABLES_API_URL=https://api.openwearables.io
OPEN_WEARABLES_API_KEY=your_api_key

# Mock server (for local dev/testing)
MOCK_SERVER_URL=http://localhost:3001
USE_MOCK=true
```

## Choose the right Salesforce mode

| Mode | When to use it | Endpoint family | Auth pattern |
| --- | --- | --- | --- |
| `platform-fhir` | Local development, org-hosted FHIR testing, mock server | `/services/data/v63.0/fhir/r4/...` | Salesforce org token |
| `healthcare-api` | Production-style Health Cloud integrations following the latest Healthcare API docs | `/clinical-diagnostics/fhir-r4/v1/...` and `/admin/fhir-r4/v1/...` | OAuth 2.0 client credentials |

## API modes

CareSync now supports two Salesforce write modes:

- `platform-fhir`: posts to the org-hosted Salesforce FHIR REST endpoint. This is the mode used by the local mock server.
- `healthcare-api`: posts to the Salesforce Healthcare API host, for example `https://api.healthcloud.salesforce.com/clinical-diagnostics/fhir-r4/v1/Observation`, and resolves or creates a real `Patient` resource before writing Observations.

In `healthcare-api` mode, CareSync follows the documented intent of:

1. authenticating with a Connected App using the **client credentials** flow
2. writing `Observation` resources to the **Clinical Diagnostics** API
3. resolving the target patient first via the **Admin** API
4. creating a minimal `Patient` resource when the identifier does not already exist

The connector uses `Accept: application/fhir+json` and `Content-Type: application/fhir+json` for FHIR payloads.

## Running locally

```bash
# 1. Clone and install
git clone https://github.com/yourname/caresync
cd caresync
npm install

# 2. Copy env file
cp .env.example .env
# Leave USE_MOCK=true and SF_API_MODE=platform-fhir for local testing without Salesforce credentials

# 3. Run tests
npm test

# 4. Start the mock server in a separate terminal
npm run mock

# 5. Run the example against the mock server
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
     - `api`
     - `refresh_token`
     - `offline_access`
6. Click **Save** and then **Continue**
7. Copy the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)
8. Enable the **Client Credentials Flow** for the Connected App
9. Assign a **Run As** user for the Connected App
10. If you use `SF_API_MODE=healthcare-api`, add Healthcare API custom scopes for Patient and Observation access, as required by the latest Salesforce Healthcare API authorization guidance.

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
4. Make sure the Connected App token includes the scopes needed to create `Observation` and read or create `Patient`

If your Salesforce instance is a sandbox and you do not override `SF_HEALTHCARE_API_BASE_URL`, CareSync automatically uses the documented sandbox healthcare host pattern `https://api.healthcloud.salesforce.com/sandBox`.

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
   - `SF_HEALTHCARE_PATIENT_GIVEN_NAME`, `SF_HEALTHCARE_PATIENT_FAMILY_NAME`, `SF_HEALTHCARE_PATIENT_GENDER`, `SF_HEALTHCARE_PATIENT_BIRTH_DATE`: defaults used only when a Patient must be created
3. Set `USE_MOCK=false` to use the real Salesforce org

When `SF_API_MODE=healthcare-api`, CareSync first tries to resolve `patientId` as an existing `Patient/{id}`. If that is not found, it searches by `identifier=<system>|<patientId>`. If no match exists, it creates a minimal `Patient` resource and uses the returned resource id for the Observation `subject.reference`.

### 4. Troubleshooting real Salesforce writes

- **401 Unauthorized**: confirm `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, and Connected App client credentials flow setup
- **403 Forbidden**: verify the Connected App scopes and that the run-as user can access Healthcare API resources
- **404 Not Found**: verify the org has the correct API surface enabled and that `SF_API_MODE` matches the endpoint family you intend to use
- **422/400 FHIR validation errors**: confirm the payload uses supported metrics, valid timestamps, and FHIR-compatible values

Official references:

- Salesforce Healthcare API authorization: https://developer.salesforce.com/docs/industries/health/guide/authorization.html
- Clinical Diagnostics Observation API reference: https://developer.salesforce.com/docs/industries/health/references/clinical_diagnostics?meta=Creates%2Ban%2Bobservation

## Using Open Wearables with CareSync

CareSync works well with Open Wearables, but it does not hide or replace your upstream ingestion logic. The typical pattern is:

1. fetch data from Open Wearables
2. map the provider payload into `RawDeviceData`
3. call `client.push()` or use `normalise()` / `mapToFhir()` directly

Here's how to set it up:

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

    // Transform your Open Wearables response into CareSync's RawDeviceData shape
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

For development and testing without a real Open Wearables account or Salesforce org:

1. Set `USE_MOCK=true` in your `.env`
2. Set `SF_API_MODE=platform-fhir`
3. Set `MOCK_SERVER_URL=http://localhost:3001`
4. Use the sample payload format in `examples/sample-payload.json`
5. Start the mock server with `npm run mock` or `npm run dev`
6. Run the example: `npm run example`

The mock server supports:

- local health checks at `GET /health`
- org-style FHIR observation writes at `/services/data/v63.0/fhir/r4/Observation`
- Healthcare API-style patient and observation routes for local experimentation

### 7. Production Considerations

When moving to production:

- Implement proper error handling for API failures
- Add retry logic for transient failures
- Consider rate limiting when syncing multiple patients
- Implement secure credential storage (for example AWS Secrets Manager or Azure Key Vault)
- Set up monitoring and alerting for sync failures
- Consider implementing a queue for bulk processing outside of this library
- Validate any third-party wearable payloads before mapping them into `RawDeviceData`
