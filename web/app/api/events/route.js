import { getEventsSince, addClient, removeClient } from '../../../lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lastId = parseInt(searchParams.get('lastId') || '0', 10)
  const encoder = new TextEncoder()

  let sendFn

  const stream = new ReadableStream({
    start(controller) {
      // Send catchup events since client's last known id
      const catchup = getEventsSince(lastId)
      for (const event of catchup) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Register for new events
      sendFn = (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          removeClient(sendFn)
        }
      }
      addClient(sendFn)
    },
    cancel() {
      if (sendFn) removeClient(sendFn)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
