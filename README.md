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
