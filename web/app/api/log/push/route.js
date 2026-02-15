import { handlePush } from '../../../../lib/store'

export async function POST(request) {
  const body = await request.json()
  handlePush(body)
  return Response.json({ ok: true })
}
