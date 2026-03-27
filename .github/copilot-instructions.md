# GitHub Copilot Instructions for CareSync

## Project summary

CareSync is a headless TypeScript monorepo and open-source npm library for syncing wearable health data into Salesforce Health Cloud.

Primary pipeline:

1. Pull health data from wearable devices via the Open Wearables API
2. Normalise raw data into a clean internal schema
3. Map the internal schema to FHIR R4 `Observation` resources
4. Authenticate with Salesforce via OAuth 2.0
5. Upsert FHIR records into Salesforce Health Cloud

A local mock server is included so developers can test without a real Salesforce org.

## Core expectations

- Keep this project headless
- Do not add a UI
- Make the library reusable in any backend
- Use TypeScript throughout
- Use an npm workspace monorepo
- Target Node.js 22+
- Target npm 10+
- Prefer strict typing and small testable modules
- Keep public APIs minimal and explicit
- Validate external input early
- Throw descriptive errors for invalid input
- Prefer pure transformation functions where possible
- Keep integration side effects isolated to connector/server code

## Monorepo structure

Expected repository layout:

- `packages/core`
  - reusable library package
  - contains normalization, FHIR mapping, Salesforce connector, shared types, and public exports
- `packages/mock-server`
  - local Fastify mock of Salesforce Health Cloud FHIR API
- `examples`
  - minimal usage example and sample payloads
- root files
  - `docker-compose.yml`
  - `.env.example`
  - `package.json`
  - `tsconfig.base.json`
  - `README.md`

## Domain expectations

### Normalization
Raw wearable payloads should be normalized into a clean internal schema.

### FHIR mapping
Normalized data should map to FHIR R4 `Observation` resources using LOINC codes and UCUM-compatible units.

### Salesforce integration
FHIR observations should be upserted into Salesforce Health Cloud using OAuth 2.0, with support for mock mode.

### Local development
A local mock server must exist for testing without a real Salesforce org.

## Libraries and tooling

Preferred libraries and tools:

- `axios` for HTTP
- `jsforce` for Salesforce connectivity
- `fastify` for the mock server
- `vitest` for unit tests
- `dotenv` for example/local configuration
- Docker and Docker Compose for local mock environment

## Testing expectations

Use Vitest for tests.

At minimum, cover:

- payload normalization
- invalid input validation
- FHIR mapping for one metric
- FHIR mapping for all metrics
- FHIR mapping when metrics are absent
- Salesforce/mock connector behavior
- partial failure handling

When changing functionality:
- update or add tests in the same change
- keep tests focused and readable

## Documentation expectations

Keep documentation aligned with implementation.

`README.md` should cover:

- what CareSync does
- prerequisites
- installation
- quick start
- environment variables
- running locally
- running tests
- publishing the package

## Environment and secrets

Expected environment variables include:

- `SF_CLIENT_ID`
- `SF_CLIENT_SECRET`
- `SF_INSTANCE_URL`
- `SF_USERNAME`
- `SF_PASSWORD`
- `OPEN_WEARABLES_API_URL`
- `OPEN_WEARABLES_API_KEY`
- `MOCK_SERVER_URL`
- `USE_MOCK`

Never hardcode secrets or expose credentials in logs.

## Non-goals unless explicitly requested

Do not add these unless the task specifically asks for them:

- frontend/UI
- database persistence
- queueing infrastructure
- webhooks
- CLI tooling
- telemetry
- CI/CD workflows
- roadmap features beyond the requested task

## Roadmap awareness

Possible future enhancements may include:

- bulk sync endpoint
- webhook support
- support for more device types
- retry queue with exponential backoff
- OpenTelemetry tracing
- CLI tool
- GitHub Actions CI/CD pipeline example

Do not implement roadmap items unless explicitly requested.

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