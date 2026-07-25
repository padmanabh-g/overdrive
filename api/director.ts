import type { VercelRequest, VercelResponse } from '@vercel/node'
import { directorEvent, type DirectorEventInput } from '../server/logic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.json(await directorEvent((req.body ?? {}) as DirectorEventInput))
}
