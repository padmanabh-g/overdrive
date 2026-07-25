import Fastify from 'fastify'
import {
  cityDirector,
  directorEvent,
  integrations,
  probe,
  rail,
  weather,
  type DirectorEventInput,
  type DirectorInput,
} from './logic'

const app = Fastify({ logger: false })

app.get('/api/health', async () => ({ ok: true, integrations: integrations() }))
app.get('/api/weather', weather)
app.get('/api/rail', async () => rail())

app.post('/api/city-director', async (req) => cityDirector((req.body ?? {}) as DirectorInput))

app.post('/api/director', async (req) => directorEvent((req.body ?? {}) as DirectorEventInput))

app.post('/api/probe', async () => probe())

app.listen({ port: 3000, host: '127.0.0.1' }).then(
  () => console.log('[server] http://localhost:3000'),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
