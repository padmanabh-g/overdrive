import type { VercelRequest, VercelResponse } from '@vercel/node'
import { probe } from '../server/logic'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.json(await probe())
}
