# CareSync Task Instructions

Apply these instructions when working on CareSync implementation tasks.

## Product definition

CareSync is an open-source npm library that:

1. Pulls health data from wearable devices via the Open Wearables API
2. Normalises the raw data into a clean internal schema
3. Maps it to FHIR R4 `Observation` resources
4. Authenticates with Salesforce via OAuth 2.0
5. Upserts the FHIR records into Salesforce Health Cloud

It is a headless TypeScript library with no UI and should be usable in any backend.

A local mock server is included so developers can test without a real Salesforce org.

## Prerequisites

Assume the project is built for an environment with:

- Node.js 22+
- npm 10+
- Docker + Docker Compose
- a Salesforce Developer Org
- an Open Wearables account or local instance
- Git

## Required repository structure

Scaffold or preserve this structure:

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
│   │   │   └── routes/
│   │   │       └── fhir.ts
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

## Phase 1 — Project setup

### Root setup

Initialize the monorepo with npm workspaces.

Root `package.json` should be:

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

### Core package

Create `packages/core/package.json` with:

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

### Mock server package

Create `packages/mock-server/package.json` with:

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

### TypeScript configuration

Root `tsconfig.base.json` should be:

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

### Environment template

`.env.example` should contain:

```env
# Salesforce Connected App credentials
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_INSTANCE_URL=https://yourorg.salesforce.com
SF_USERNAME=your@email.com
SF_PASSWORD=yourpassword

# Open Wearables API
OPEN_WEARABLES_API_URL=https://api.openwearables.com
OPEN_WEARABLES_API_KEY=your_api_key

# Mock server (for local dev/testing)
MOCK_SERVER_URL=http://localhost:3001
USE_MOCK=true
```

## Phase 2 — Core types

Implement `packages/core/src/types.ts` with these interfaces:

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

## Phase 3 — Normaliser

Implement `packages/core/src/normaliser.ts` with this behavior:

- export `normalise(raw: RawDeviceData): NormalisedData`
- require `patientId`
- require `timestamp`
- parse `timestamp` into a valid `Date`
- throw `patientId is required` if missing
- throw `timestamp is required` if missing
- throw `Invalid timestamp: <value>` if invalid
- map:
  - `metrics.heartRate` → `heartRateBpm`
  - all other supported metrics directly

Reference behavior:

```typescript
import { RawDeviceData, NormalisedData } from './types'

export function normalise(raw: RawDeviceData): NormalisedData {
  if (!raw.patientId) throw new Error('patientId is required')
  if (!raw.timestamp) throw new Error('timestamp is required')

  const recordedAt = new Date(raw.timestamp)
  if (isNaN(recordedAt.getTime())) {
    throw new Error(`Invalid timestamp: ${raw.timestamp}`)
  }

  return {
    patientId: raw.patientId,
    deviceId: raw.deviceId,
    recordedAt,
    steps: raw.metrics.steps ?? undefined,
    heartRateBpm: raw.metrics.heartRate ?? undefined,
    sleepMinutes: raw.metrics.sleepMinutes ?? undefined,
    hrvMs: raw.metrics.hrvMs ?? undefined,
    spo2Percent: raw.metrics.spo2Percent ?? undefined,
    caloriesBurned: raw.metrics.caloriesBurned ?? undefined,
  }
}
```

## Phase 4 — FHIR mapper

Map normalized metrics to FHIR R4 `Observation` resources.

### LOINC codes

| Metric | LOINC code | Display |
|---|---|---|
| Steps | `55423-8` | Number of steps in unspecified time |
| Heart rate | `8867-4` | Heart rate |
| Sleep duration | `93832-4` | Sleep duration |
| HRV | `80404-7` | R-R interval |
| SpO2 | `59408-5` | Oxygen saturation |
| Calories burned | `41981-2` | Calories burned |

### Systems and units

- LOINC system: `http://loinc.org`
- UCUM system: `http://unitsofmeasure.org`

Metric mappings:

- `steps`
  - code: `55423-8`
  - display: `Number of steps`
  - unit: `steps`
  - UCUM: `{steps}`
- `heartRateBpm`
  - code: `8867-4`
  - display: `Heart rate`
  - unit: `beats/min`
  - UCUM: `/min`
- `sleepMinutes`
  - code: `93832-4`
  - display: `Sleep duration`
  - unit: `min`
  - UCUM: `min`
- `hrvMs`
  - code: `80404-7`
  - display: `R-R interval`
  - unit: `ms`
  - UCUM: `ms`
- `spo2Percent`
  - code: `59408-5`
  - display: `Oxygen saturation`
  - unit: `%`
  - UCUM: `%`
- `caloriesBurned`
  - code: `41981-2`
  - display: `Calories burned`
  - unit: `kcal`
  - UCUM: `kcal`

Implementation requirements:

- export `mapToFhir(data: NormalisedData): FhirObservation[]`
- create one Observation per defined numeric metric
- skip undefined metrics
- set `resourceType` to `Observation`
- set `status` to `final`
- set `subject.reference` to `Patient/{patientId}`
- set `effectiveDateTime` from `recordedAt.toISOString()`

Reference implementation shape:

```typescript
import { NormalisedData, FhirObservation } from './types'

const LOINC_SYSTEM = 'http://loinc.org'
const UCUM_SYSTEM = 'http://unitsofmeasure.org'

interface MetricMapping {
  loincCode: string
  display: string
  unit: string
  ucumCode: string
}

const METRIC_MAPPINGS: Record<string, MetricMapping> = {
  steps: {
    loincCode: '55423-8',
    display: 'Number of steps',
    unit: 'steps',
    ucumCode: '{steps}',
  },
  heartRateBpm: {
    loincCode: '8867-4',
    display: 'Heart rate',
    unit: 'beats/min',
    ucumCode: '/min',
  },
  sleepMinutes: {
    loincCode: '93832-4',
    display: 'Sleep duration',
    unit: 'min',
    ucumCode: 'min',
  },
  hrvMs: {
    loincCode: '80404-7',
    display: 'R-R interval',
    unit: 'ms',
    ucumCode: 'ms',
  },
  spo2Percent: {
    loincCode: '59408-5',
    display: 'Oxygen saturation',
    unit: '%',
    ucumCode: '%',
  },
  caloriesBurned: {
    loincCode: '41981-2',
    display: 'Calories burned',
    unit: 'kcal',
    ucumCode: 'kcal',
  },
}

export function mapToFhir(data: NormalisedData): FhirObservation[] {
  const observations: FhirObservation[] = []

  for (const [key, mapping] of Object.entries(METRIC_MAPPINGS)) {
    const value = data[key as keyof NormalisedData]
    if (value === undefined || typeof value !== 'number') continue

    observations.push({
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [
          {
            system: LOINC_SYSTEM,
            code: mapping.loincCode,
            display: mapping.display,
          },
        ],
      },
      subject: {
        reference: `Patient/${data.patientId}`,
      },
      effectiveDateTime: data.recordedAt.toISOString(),
      valueQuantity: {
        value,
        unit: mapping.unit,
        system: UCUM_SYSTEM,
        code: mapping.ucumCode,
      },
    })
  }

  return observations
}
```

## Phase 5 — Salesforce connector

Implement `packages/core/src/sf-connector.ts`.

Requirements:

- create a `SalesforceConnector` class
- constructor accepts `CareSyncConfig`
- support a `useMock` flag
- in mock mode, redirect to local mock server URL
- use `axios` for HTTP
- use `Promise.allSettled` for bulk upsert handling
- throw an error on partial failures
- support Salesforce OAuth 2.0 using `jsforce`

Reference implementation behavior:

```typescript
import jsforce from 'jsforce'
import axios from 'axios'
import { FhirObservation, CareSyncConfig } from './types'

export class SalesforceConnector {
  private config: CareSyncConfig
  private conn: jsforce.Connection | null = null

  constructor(config: CareSyncConfig) {
    this.config = config
  }

  private async connect(): Promise<jsforce.Connection> {
    if (this.conn) return this.conn

    const baseUrl = this.config.useMock
      ? this.config.mockServerUrl ?? 'http://localhost:3001'
      : this.config.salesforce.instanceUrl

    if (this.config.useMock) {
      this.conn = new jsforce.Connection({ instanceUrl: baseUrl, accessToken: 'mock-token' })
      return this.conn
    }

    const conn = new jsforce.Connection({
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
```

## Phase 6 — Public API surface

Implement `packages/core/src/index.ts`.

Requirements:

- export:
  - `normalise`
  - `mapToFhir`
  - `SalesforceConnector`
  - all types
- create a `CareSync` class
- constructor accepts `CareSyncConfig`
- implement `push(rawData: RawDeviceData): Promise<void>`
- `push()` flow must be:
  - normalise
  - mapToFhir
  - upsertObservations

Reference implementation:

```typescript
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
```

## Phase 7 — Mock server

Implement `packages/mock-server/src/server.ts`.

Requirements:

- use Fastify
- listen on port `3001`
- implement `GET /health`
- implement `POST /services/data/v59.0/fhir/r4/Observation`
- implement `GET /services/data/v59.0/fhir/r4/Patient/:id`

Expected behavior:

- `GET /health` returns:
  ```json
  { "status": "ok", "mock": true }
  ```
- `POST /services/data/v59.0/fhir/r4/Observation`
  - returns HTTP `201`
  - returns the request body plus a generated mock `id`
- `GET /services/data/v59.0/fhir/r4/Patient/:id`
  - returns a mock Patient resource with:
    - `resourceType: "Patient"`
    - `id`
    - `name: [{ family: "MockPatient", given: ["Test"] }]`

Reference implementation:

```typescript
import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok', mock: true }))

app.post('/services/data/v59.0/fhir/r4/Observation', async (request, reply) => {
  const body = request.body as Record<string, unknown>

  app.log.info({ observation: body }, 'Mock: received Observation upsert')

  return reply.code(201).send({
    resourceType: 'Observation',
    id: `mock-${Date.now()}`,
    ...body,
  })
})

app.get('/services/data/v59.0/fhir/r4/Patient/:id', async (request) => {
  const { id } = request.params as { id: string }
  return {
    resourceType: 'Patient',
    id,
    name: [{ family: 'MockPatient', given: ['Test'] }],
  }
})

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Mock Salesforce Health Cloud server running on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

## Phase 8 — Docker setup

Root `docker-compose.yml` should be:

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

`packages/mock-server/Dockerfile` should be:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD ["npm", "run", "start"]
```

## Phase 9 — Tests

### `packages/core/tests/normaliser.test.ts`

Must cover:

- valid payload normalization
- missing `patientId`
- invalid timestamp

Reference test:

```typescript
import { describe, it, expect } from 'vitest'
import { normalise } from '../src/normaliser'

describe('normaliser', () => {
  it('normalises a valid payload', () => {
    const result = normalise({
      deviceId: 'garmin-123',
      patientId: 'patient-456',
      timestamp: '2026-03-01T08:00:00Z',
      metrics: { steps: 8432, heartRate: 72 },
    })

    expect(result.steps).toBe(8432)
    expect(result.heartRateBpm).toBe(72)
    expect(result.patientId).toBe('patient-456')
    expect(result.recordedAt).toBeInstanceOf(Date)
  })

  it('throws on missing patientId', () => {
    expect(() =>
      normalise({ deviceId: 'd1', patientId: '', timestamp: '2026-03-01T08:00:00Z', metrics: {} })
    ).toThrow('patientId is required')
  })

  it('throws on invalid timestamp', () => {
    expect(() =>
      normalise({ deviceId: 'd1', patientId: 'p1', timestamp: 'not-a-date', metrics: {} })
    ).toThrow('Invalid timestamp')
  })
})
```

### `packages/core/tests/fhir-mapper.test.ts`

Must cover:

- single metric mapping
- undefined metrics
- all metrics mapping

Reference test:

```typescript
import { describe, it, expect } from 'vitest'
import { mapToFhir } from '../src/fhir-mapper'

describe('fhir-mapper', () => {
  it('maps steps to a valid FHIR Observation', () => {
    const observations = mapToFhir({
      patientId: 'patient-456',
      deviceId: 'garmin-123',
      recordedAt: new Date('2026-03-01T08:00:00Z'),
      steps: 8432,
    })

    expect(observations).toHaveLength(1)
    expect(observations[0].resourceType).toBe('Observation')
    expect(observations[0].code.coding[0].code).toBe('55423-8')
    expect(observations[0].valueQuantity.value).toBe(8432)
    expect(observations[0].subject.reference).toBe('Patient/patient-456')
  })

  it('skips undefined metrics', () => {
    const observations = mapToFhir({
      patientId: 'p1',
      deviceId: 'd1',
      recordedAt: new Date(),
    })
    expect(observations).toHaveLength(0)
  })

  it('maps all metrics when all provided', () => {
    const observations = mapToFhir({
      patientId: 'p1',
      deviceId: 'd1',
      recordedAt: new Date(),
      steps: 1000,
      heartRateBpm: 70,
      sleepMinutes: 480,
      hrvMs: 55,
      spo2Percent: 98,
      caloriesBurned: 500,
    })
    expect(observations).toHaveLength(6)
  })
})
```

### `packages/core/tests/sf-connector.test.ts`

Include tests for:

- mock mode request behavior
- partial failure handling

## Phase 10 — Usage example

Create `examples/basic-sync.ts`:

```typescript
import { CareSync } from '@caresync/core'
import * as dotenv from 'dotenv'
dotenv.config()

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

Also include:

- `examples/sample-payload.json` as a raw Open Wearables payload sample

## README expectations

`README.md` should include:

- what it does
- prerequisites
- installation
- quick start
- environment variables
- how to run tests

Also document local flow:

```bash
# 1. Clone and install
git clone https://github.com/yourname/caresync
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

## Publishing expectations

For npm publishing:

```bash
cd packages/core
npm run build
npm publish --access public
```

Consumers should be able to install with:

```bash
npm install @caresync/core
```

## Salesforce setup reference

When documenting or guiding setup, include these one-time Salesforce steps:

1. Go to Developer Org → Setup → App Manager → New Connected App
2. Enable OAuth settings
3. Add scopes: `api`, `refresh_token`, `offline_access`
4. Set callback URL to `http://localhost:3000/callback`
5. Save and copy the Consumer Key and Consumer Secret
6. Go to Setup → Health Cloud → Enable FHIR R4 API
7. Copy the org instance URL from the browser address bar

## Claude-to-Copilot task intent mapping

These task intents should remain supported when implementing work:

### Scaffold the project
- create a TypeScript monorepo called `caresync`
- use npm workspaces
- create packages `@caresync/core` and `@caresync/mock-server`
- create root build and test scripts
- create strict `tsconfig.base.json`
- add `.env.example` with Salesforce and Open Wearables credentials

### Build the normaliser
- create `normalise()` in `packages/core/src/normaliser.ts`
- accept `RawDeviceData`
- validate required fields
- return `NormalisedData`
- write Vitest tests

### Build the FHIR mapper
- create `mapToFhir()` in `packages/core/src/fhir-mapper.ts`
- accept `NormalisedData`
- return FHIR R4 `Observation[]`
- use required LOINC codes and UCUM units
- skip undefined metrics
- write Vitest tests

### Build the Salesforce connector
- create `SalesforceConnector` in `packages/core/src/sf-connector.ts`
- constructor accepts `CareSyncConfig`
- `upsertObservations()` POSTs each `FhirObservation`
- support `useMock`
- use `axios`
- handle partial failures with `Promise.allSettled`

### Build the mock server
- create Fastify server on port `3001`
- implement observation upsert route
- implement patient lookup route
- implement health route
- add Dockerfile

### Wire it all together
- create `CareSync` class in `packages/core/src/index.ts`
- constructor accepts `CareSyncConfig`
- `push(rawData)` executes normalise → mapToFhir → upsertObservations
- export `CareSync`, `normalise`, `mapToFhir`, `SalesforceConnector`, and all types
- create `examples/basic-sync.ts`

### Add Docker and finish
- create `docker-compose.yml`
- add mock-server Dockerfile
- update root `package.json` so `npm run dev` starts docker-compose
- write `README.md`

## Roadmap for future versions

Future ideas that may appear in planning, but should not be implemented unless explicitly requested:

- bulk sync endpoint for multiple patients
- webhook support from Open Wearables to CareSync
- support for Withings, Whoop, Dexcom CGM, and more device types
- retry queue with exponential backoff
- OpenTelemetry tracing
- CLI tool such as `caresync push --patient p1 --file data.json`
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