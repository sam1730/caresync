# AGENTS.md

## Mission

Build and maintain CareSync as a headless TypeScript library that moves wearable health data into Salesforce Health Cloud using FHIR R4.

Pipeline:

1. Pull wearable data from the Open Wearables API
2. Normalise raw payloads
3. Map normalized data to FHIR R4 `Observation`
4. Authenticate with Salesforce via OAuth 2.0
5. Upsert FHIR records into Salesforce Health Cloud

A local mock server must support development without a real Salesforce org.

## Agent rules

- Do not add a frontend or UI unless explicitly requested.
- Keep the codebase backend-oriented and reusable.
- Use TypeScript with strict typing.
- Preserve the npm workspaces monorepo structure.
- Prefer minimal, incremental, test-backed changes.
- Validate inputs early and throw descriptive errors.
- Keep pure logic separate from IO/network logic.
- Never hardcode secrets.
- Update docs and examples when behavior changes.

## Required structure

```text
caresync/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── normaliser.ts
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

## Required configuration

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

Each package tsconfig:

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

## Domain model

Implement these types in `packages/core/src/types.ts`:

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

## Implementation tasks

### 1. Normaliser

Implement `packages/core/src/normaliser.ts`:

- `normalise(raw: RawDeviceData): NormalisedData`
- require `patientId`
- require `timestamp`
- parse timestamp into `Date`
- error messages:
  - `patientId is required`
  - `timestamp is required`
  - `Invalid timestamp: <value>`

Map:
- `metrics.steps` → `steps`
- `metrics.heartRate` → `heartRateBpm`
- `metrics.sleepMinutes` → `sleepMinutes`
- `metrics.hrvMs` → `hrvMs`
- `metrics.spo2Percent` → `spo2Percent`
- `metrics.caloriesBurned` → `caloriesBurned`

### 2. FHIR mapper

Implement `packages/core/src/fhir-mapper.ts` with:

LOINC codes:
- `55423-8` for steps
- `8867-4` for heart rate
- `93832-4` for sleep duration
- `80404-7` for HRV
- `59408-5` for SpO2
- `41981-2` for calories burned

Display values:
- Number of steps in unspecified time
- Heart rate
- Sleep duration
- R-R interval
- Oxygen saturation
- Calories burned

Systems:
- `http://loinc.org`
- `http://unitsofmeasure.org`

Units:
- `{steps}`
- `/min`
- `min`
- `ms`
- `%`
- `kcal`

Rules:
- one Observation per defined metric
- skip undefined metrics
- `resourceType = Observation`
- `status = final`
- `subject.reference = Patient/{patientId}`
- `effectiveDateTime = recordedAt.toISOString()`

### 3. Salesforce connector

Implement `packages/core/src/sf-connector.ts`:

- class `SalesforceConnector`
- constructor accepts `CareSyncConfig`
- support real and mock modes
- mock mode uses `mockServerUrl` or `http://localhost:3001`
- use `axios`
- use `Promise.allSettled`
- POST to `/services/data/v59.0/fhir/r4/Observation`
- throw on partial failure
- use `jsforce` for OAuth 2.0 integration

### 4. Public API

Implement `packages/core/src/index.ts`:

- export `normalise`
- export `mapToFhir`
- export `SalesforceConnector`
- export all types
- create `CareSync`
- `push(rawData)` runs:
  - normalise
  - mapToFhir
  - upsertObservations

### 5. Mock server

Implement `packages/mock-server/src/server.ts`:

- Fastify server
- port `3001`
- `GET /health`
- `POST /services/data/v59.0/fhir/r4/Observation`
- `GET /services/data/v59.0/fhir/r4/Patient/:id`

Behavior:
- health returns `{ status: 'ok', mock: true }`
- observation POST returns 201 and mock id plus body
- patient GET returns mock Patient resource

### 6. Docker

Create:

`docker-compose.yml`

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

`packages/mock-server/Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD ["npm", "run", "start"]
```

### 7. Tests

Use Vitest.

Required:

`packages/core/tests/normaliser.test.ts`
- valid payload
- missing patientId
- invalid timestamp

`packages/core/tests/fhir-mapper.test.ts`
- one metric
- zero metrics
- all metrics

`packages/core/tests/sf-connector.test.ts`
- mock mode behavior
- partial failure handling

### 8. Example

Create `examples/basic-sync.ts` using `dotenv`.

Also include:
- `examples/sample-payload.json`

### 9. README

Document:
- what it does
- prerequisites
- installation
- quick start
- environment variables
- how to run tests

Include local commands:

```bash
git clone https://github.com/yourname/caresync
cd caresync
npm install
cp .env.example .env
docker-compose up
npm test
npx ts-node examples/basic-sync.ts
```

### 10. Publish

```bash
cd packages/core
npm run build
npm publish --access public
```

Install command:

```bash
npm install @caresync/core
```

## Salesforce setup notes

Include when relevant:

1. Developer Org → Setup → App Manager → New Connected App
2. Enable OAuth settings
3. Add scopes: `api`, `refresh_token`, `offline_access`
4. Callback URL: `http://localhost:3000/callback`
5. Copy Consumer Key and Consumer Secret
6. Enable Health Cloud FHIR R4 API
7. Copy org instance URL

## Roadmap

Do not implement unless explicitly asked:

- bulk sync endpoint
- webhook support
- Withings, Whoop, Dexcom CGM support
- retry queue
- OpenTelemetry
- CLI tool
- GitHub Actions CI/CD example

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