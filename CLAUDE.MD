# CLAUDE.md

## Project Overview

CareSync is a headless TypeScript monorepo and open-source npm library for syncing wearable health data into Salesforce Health Cloud.

Core pipeline:

1. Pull health data from wearable devices via the Open Wearables API
2. Normalise raw data into a clean internal schema
3. Map the data to FHIR R4 `Observation` resources
4. Authenticate with Salesforce via OAuth 2.0
5. Upsert FHIR records into Salesforce Health Cloud

A local mock server is included so developers can test without a real Salesforce org.

## High-level rules

- This project is headless. Do not add a UI unless explicitly requested.
- Keep the library backend-friendly and reusable.
- Use TypeScript throughout.
- Use an npm workspaces monorepo layout.
- Target Node.js 22+ and npm 10+.
- Favor strict typing and clear interfaces.
- Keep modules small and testable.
- Keep transformation logic pure where possible.
- Isolate side effects to connectors, network clients, and server code.
- Do not hardcode secrets or credentials.

## Repository structure

Expected layout:

```text
caresync/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├���─ normaliser.ts
│   │   │   ├── fhir-mapper.ts
│   │   │   ├── sf-connector.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── normaliser.test.ts
│   │   │   ├── fhir-mapper.test.ts
│   │   │   └── sf-connector.test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mock-server/
│       ├── src/
│       │   ├── server.ts
│       │   └── routes/
│       │       └── fhir.ts
│       ├── fixtures/
│       │   └── observation.json
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   ├── basic-sync.ts
│   └── sample-payload.json
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.base.json
└── README.md
```

## Project setup requirements

### Root package.json

```json
{
  "name": "caresync",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev": "docker-compose up"
  }
}
```

### packages/core/package.json

```json
{
  "name": "@caresync/core",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "jsforce": "^2.0.0",
    "fhir": "^4.11.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### packages/mock-server/package.json

```json
{
  "name": "@caresync/mock-server",
  "version": "0.1.0",
  "scripts": {
    "start": "ts-node src/server.ts",
    "dev": "ts-node-dev src/server.ts"
  },
  "dependencies": {
    "fastify": "^4.24.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  }
}
```

Each package `tsconfig.json` should extend the root config:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

### .env.example

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

## Core types

Implement `packages/core/src/types.ts` with:

```typescript
export interface RawDeviceData {
  deviceId: string
  patientId: string
  timestamp: string
  metrics: {
    steps?: number
    heartRate?: number
    sleepMinutes?: number
    hrvMs?: number
    spo2Percent?: number
    caloriesBurned?: number
  }
}

export interface NormalisedData {
  patientId: string
  deviceId: string
  recordedAt: Date
  steps?: number
  heartRateBpm?: number
  sleepMinutes?: number
  hrvMs?: number
  spo2Percent?: number
  caloriesBurned?: number
}

export interface FhirObservation {
  resourceType: 'Observation'
  id?: string
  status: 'final' | 'preliminary'
  code: {
    coding: Array<{
      system: string
      code: string
      display: string
    }>
  }
  subject: {
    reference: string
  }
  effectiveDateTime: string
  valueQuantity: {
    value: number
    unit: string
    system: string
    code: string
  }
}

export interface CareSyncConfig {
  salesforce: {
    clientId: string
    clientSecret: string
    instanceUrl: string
    username: string
    password: string
  }
  openWearables?: {
    apiUrl: string
    apiKey: string
  }
  useMock?: boolean
  mockServerUrl?: string
}
```

## Implementation rules

### Normaliser

In `packages/core/src/normaliser.ts`:

- export `normalise(raw: RawDeviceData): NormalisedData`
- require `patientId`
- require `timestamp`
- parse `timestamp` into `Date`
- throw:
  - `patientId is required`
  - `timestamp is required`
  - `Invalid timestamp: <value>`

Mapping rules:

- `steps` → `steps`
- `heartRate` → `heartRateBpm`
- `sleepMinutes` → `sleepMinutes`
- `hrvMs` → `hrvMs`
- `spo2Percent` → `spo2Percent`
- `caloriesBurned` → `caloriesBurned`

### FHIR mapper

In `packages/core/src/fhir-mapper.ts`:

Use these LOINC mappings:

- steps → `55423-8` → `Number of steps in unspecified time`
- heart rate → `8867-4` → `Heart rate`
- sleep duration → `93832-4` → `Sleep duration`
- HRV → `80404-7` → `R-R interval`
- SpO2 → `59408-5` → `Oxygen saturation`
- calories burned → `41981-2` → `Calories burned`

Use:

- `http://loinc.org`
- `http://unitsofmeasure.org`

UCUM/unit mappings:

- `steps` → `steps` / `{steps}`
- `heartRateBpm` → `beats/min` / `/min`
- `sleepMinutes` → `min` / `min`
- `hrvMs` → `ms` / `ms`
- `spo2Percent` → `%` / `%`
- `caloriesBurned` → `kcal` / `kcal`

Rules:

- create one `Observation` per defined metric
- skip undefined metrics
- set `resourceType` to `Observation`
- set `status` to `final`
- set `subject.reference` to `Patient/{patientId}`
- set `effectiveDateTime` from `recordedAt.toISOString()`

### Salesforce connector

In `packages/core/src/sf-connector.ts`:

- create `SalesforceConnector`
- constructor accepts `CareSyncConfig`
- support `useMock`
- use `axios` for HTTP
- use `Promise.allSettled`
- POST to `/services/data/v59.0/fhir/r4/Observation`
- throw on partial failures
- support real Salesforce OAuth 2.0 via `jsforce`

In mock mode:
- use `mockServerUrl` or `http://localhost:3001`
- no real auth required
- bearer token may be `mock-token`

### Public API

In `packages/core/src/index.ts`:

Export:
- `normalise`
- `mapToFhir`
- `SalesforceConnector`
- all types

Create `CareSync` class:
- constructor accepts `CareSyncConfig`
- `push(rawData: RawDeviceData)` must do:
  - normalise
  - mapToFhir
  - upsertObservations

### Mock server

In `packages/mock-server/src/server.ts`:

- use Fastify
- port `3001`
- `GET /health` returns `{ status: 'ok', mock: true }`
- `POST /services/data/v59.0/fhir/r4/Observation` returns `201` and echoes the body with a mock `id`
- `GET /services/data/v59.0/fhir/r4/Patient/:id` returns a mock FHIR Patient

## Docker requirements

### docker-compose.yml

```yaml
version: '3.8'
services:
  mock-server:
    build:
      context: ./packages/mock-server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    volumes:
      - ./packages/mock-server/fixtures:/app/fixtures
```

### packages/mock-server/Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD ["npm", "run", "start"]
```

## Tests

Use Vitest.

### Required tests

`packages/core/tests/normaliser.test.ts`
- valid payload normalization
- missing `patientId`
- invalid timestamp

`packages/core/tests/fhir-mapper.test.ts`
- single metric mapping
- undefined metrics are skipped
- all metrics mapping

`packages/core/tests/sf-connector.test.ts`
- mock mode behavior
- partial failure handling

## Example

Create `examples/basic-sync.ts` using `dotenv` and `CareSync`.

Also include:
- `examples/sample-payload.json`

## README requirements

Document:
- what it does
- prerequisites
- installation
- quick start
- environment variables
- how to run tests
- local development flow
- publishing instructions

## Local run flow

```bash
git clone https://github.com/yourname/caresync
cd caresync
npm install
cp .env.example .env
docker-compose up
npm test
npx ts-node examples/basic-sync.ts
```

## Publishing

```bash
cd packages/core
npm run build
npm publish --access public
```

Consumers install with:

```bash
npm install @caresync/core
```

## Salesforce setup reference

1. Setup → App Manager → New Connected App
2. Enable OAuth settings
3. Add scopes: `api`, `refresh_token`, `offline_access`
4. Set callback URL to `http://localhost:3000/callback`
5. Save and copy Consumer Key and Consumer Secret
6. Enable Health Cloud FHIR R4 API
7. Copy the org instance URL

## Future roadmap

Do not implement these unless explicitly requested:

- bulk sync endpoint
- webhook support
- more device types such as Withings, Whoop, Dexcom CGM
- retry queue with exponential backoff
- OpenTelemetry tracing
- CLI tool
- GitHub Actions CI/CD pipeline example

## Open Wearables guidance

CareSync is intended to pull wearable health data from the Open Wearables API.

Current repository expectations include:
- Open Wearables is part of the product scope
- `.env.example` must include:
  - `OPEN_WEARABLES_API_URL`
  - `OPEN_WEARABLES_API_KEY`
- examples and sample payloads may represent Open Wearables payloads

Important:
- The current scaffold does not define a dedicated Open Wearables client module
- Do not invent additional ingestion architecture unless explicitly requested
- If asked to implement Open Wearables fetching, keep it separate from:
  - normalization
  - FHIR mapping
  - Salesforce sync logic