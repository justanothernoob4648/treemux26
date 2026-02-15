import { handleStart } from '../../../../lib/store'

export async function POST(request) {
  const body = await request.json()
  handleStart(body)
  return Response.json({ ok: true })
}
