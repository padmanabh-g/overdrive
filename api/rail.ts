import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rail } from '../server/logic'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json(rail())
}
