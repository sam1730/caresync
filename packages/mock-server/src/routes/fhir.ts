import { FastifyInstance } from 'fastify'

export async function fhirRoutes(app: FastifyInstance): Promise<void> {
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
}
