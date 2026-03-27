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

const client = new CareSync({
  salesforce: {
    clientId: process.env.SF_CLIENT_ID!,
    clientSecret: process.env.SF_CLIENT_SECRET!,
    instanceUrl: process.env.SF_INSTANCE_URL!,
    username: process.env.SF_USERNAME!,
    password: process.env.SF_PASSWORD!,
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
```

## Environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Salesforce Connected App credentials
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_INSTANCE_URL=https://yourorg.salesforce.com
SF_USERNAME=your@email.com
SF_PASSWORD=yourpassword

# Open Wearables API
OPEN_WEARABLES_API_URL=https://api.openwearables.io
OPEN_WEARABLES_API_KEY=your_api_key

# Mock server (for local dev/testing)
MOCK_SERVER_URL=http://localhost:3001
USE_MOCK=true
```

## Running locally

```bash
# 1. Clone and install
git clone https://github.com/sam1730/caresync
cd caresync
npm install

# 2. Copy env file
cp .env.example .env
# Fill in your Salesforce credentials or leave USE_MOCK=true

# 3. Start mock server
docker-compose up

# 4. Run tests
npm test

# 5. Run the example
npx ts-node examples/basic-sync.ts
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

To use CareSync with a real Salesforce org, you need to set up a Connected App and enable Health Cloud FHIR R4 API:

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
     - `refresh_token` - Perform requests at any time
     - `offline_access` - Perform requests at any time
6. Click **Save** and then **Continue**
7. Copy the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)

### 2. Enable Health Cloud FHIR R4 API

1. In Salesforce Setup, search for **Health Cloud**
2. Navigate to **Health Cloud Settings**
3. Enable **FHIR R4 API**
4. Save your settings

### 3. Configure Your Environment

1. Copy your org's instance URL from the browser (e.g., `https://yourorg.salesforce.com`)
2. Update your `.env` file with:
   - `SF_CLIENT_ID`: Your Consumer Key
   - `SF_CLIENT_SECRET`: Your Consumer Secret
   - `SF_INSTANCE_URL`: Your org's instance URL
   - `SF_USERNAME`: Your Salesforce username
   - `SF_PASSWORD`: Your Salesforce password
3. Set `USE_MOCK=false` to use the real Salesforce org

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
    username: process.env.SF_USERNAME!,
    password: process.env.SF_PASSWORD!,
  },
  useMock: false, // Use real Salesforce
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
2. Use the sample payload format in `examples/sample-payload.json`
3. Start the mock server: `docker-compose up`
4. Run the example: `npx ts-node examples/basic-sync.ts`

### 7. Production Considerations

When moving to production:

- Implement proper error handling for API failures
- Add retry logic for transient failures
- Consider rate limiting when syncing multiple patients
- Implement secure credential storage (e.g., AWS Secrets Manager, Azure Key Vault)
- Set up monitoring and alerting for sync failures
- Consider implementing a queue for bulk processing
