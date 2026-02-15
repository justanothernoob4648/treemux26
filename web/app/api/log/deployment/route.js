import { handleDeployment } from '../../../../lib/store'

export async function POST(request) {
  const body = await request.json()
  handleDeployment(body)
  return Response.json({ ok: true })
}
