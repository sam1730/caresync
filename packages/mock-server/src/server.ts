import Fastify, { FastifyReply, FastifyRequest } from 'fastify'

type PatientRecord = {
  resourceType: 'Patient'
  id: string
  identifier?: Array<{
    system?: string
    value?: string
  }>
  name?: Array<{
    family?: string
    given?: string[]
  }>
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
}

const app = Fastify({ logger: true })
const patientStore = new Map<string, PatientRecord>()

app.addContentTypeParser('application/fhir+json', { parseAs: 'string' }, (request, body, done) => {
  try {
    const parsedBody = typeof body === 'string' && body.length > 0 ? JSON.parse(body) : {}
    done(null, parsedBody)
  } catch (error) {
    done(error as Error, undefined)
  }
})

app.get('/health', async () => ({ status: 'ok', mock: true }))

function buildMockPatient(id: string): PatientRecord {
  return (
    patientStore.get(id) ?? {
      resourceType: 'Patient',
      id,
      identifier: [{ system: 'https://caresync.dev/patient-id', value: id }],
      name: [{ family: 'MockPatient', given: ['Test'] }],
    }
  )
}

async function handleObservationPost(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, unknown>

  app.log.info({ observation: body }, 'Mock: received Observation upsert')

  return reply.code(201).send({
    resourceType: 'Observation',
    id: `mock-${Date.now()}`,
    ...body,
  })
}

async function handlePlatformPatientGet(request: FastifyRequest) {
  const { id } = request.params as { id: string }
  return buildMockPatient(id)
}

async function handleHealthcarePatientGet(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const patient = patientStore.get(id)

  if (!patient) {
    return reply.code(404).send({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-found',
          diagnostics: `Patient/${id} was not found in the mock Healthcare API store`,
        },
      ],
    })
  }

  return patient
}

app.post('/services/data/v59.0/fhir/r4/Observation', handleObservationPost)
app.post('/services/data/v63.0/fhir/r4/Observation', handleObservationPost)
app.post('/clinical-diagnostics/fhir-r4/v1/Observation', handleObservationPost)

app.get('/services/data/v59.0/fhir/r4/Patient/:id', handlePlatformPatientGet)
app.get('/services/data/v63.0/fhir/r4/Patient/:id', handlePlatformPatientGet)
app.get('/admin/fhir-r4/v1/Patient/:id', handleHealthcarePatientGet)

app.get('/admin/fhir-r4/v1/Patient', async (request) => {
  const { identifier } = request.query as { identifier?: string }
  const [system, value] = identifier?.split('|') ?? []
  const matches = Array.from(patientStore.values()).filter((patient) =>
    patient.identifier?.some((item) => item.system === system && item.value === value)
  )

  return {
    resourceType: 'Bundle',
    total: matches.length,
    entry: matches.map((resource) => ({ resource })),
  }
})

app.post('/admin/fhir-r4/v1/Patient', async (request, reply) => {
  const body = request.body as Omit<PatientRecord, 'id'>
  const patient: PatientRecord = {
    ...body,
    resourceType: 'Patient',
    id: `mock-patient-${Date.now()}`,
  }

  patientStore.set(patient.id, patient)
  app.log.info({ patient }, 'Mock: created Patient')

  return reply.code(201).send(patient)
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
