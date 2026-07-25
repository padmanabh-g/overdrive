import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cityDirector, type DirectorInput } from '../server/logic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.json(await cityDirector((req.body ?? {}) as DirectorInput))
}
