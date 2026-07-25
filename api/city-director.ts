import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cityDirector } from '../server/logic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { condition } = (req.body ?? {}) as { condition?: string }
  res.json(await cityDirector(condition))
}
