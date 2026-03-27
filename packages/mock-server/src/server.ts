import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.addContentTypeParser('application/fhir+json', { parseAs: 'string' }, (request, body, done) => {
  try {
    const parsedBody = typeof body === 'string' && body.length > 0 ? JSON.parse(body) : {}
    done(null, parsedBody)
  } catch (error) {
    done(error as Error, undefined)
  }
})

app.get('/health', async () => ({ status: 'ok', mock: true }))

// Mock FHIR Observation endpoint
app.post('/services/data/v59.0/fhir/r4/Observation', async (request, reply) => {
  const body = request.body as Record<string, unknown>

  app.log.info({ observation: body }, 'Mock: received Observation upsert')

  return reply.code(201).send({
    resourceType: 'Observation',
    id: `mock-${Date.now()}`,
    ...body,
  })
})

// Mock FHIR Patient lookup
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
