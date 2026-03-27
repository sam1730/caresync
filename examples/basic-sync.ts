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
