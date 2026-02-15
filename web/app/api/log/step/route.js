import { handleStep } from '../../../../lib/store'

export async function POST(request) {
  const body = await request.json()
  handleStep(body)
  return Response.json({ ok: true })
}
