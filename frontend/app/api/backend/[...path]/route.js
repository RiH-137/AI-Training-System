function resolveBackendBaseUrl() {
  const explicit = String(
    process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''
  ).trim()
  if (explicit) {
    return explicit
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5000'
  }

  throw new Error(
    'Missing backend URL. Set BACKEND_API_BASE_URL (preferred) or NEXT_PUBLIC_API_BASE_URL in frontend environment.'
  )
}

function buildBackendUrl(pathSegments, searchParams) {
  const baseUrl = resolveBackendBaseUrl()

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const path = pathSegments.join('/')
  const target = new URL(path, normalizedBase)

  if (searchParams) {
    target.search = searchParams
  }

  return target.toString()
}

async function forwardRequest(request, context) {
  try {
    const targetUrl = buildBackendUrl(context.params.path || [], new URL(request.url).search)
    const contentType = request.headers.get('content-type') || ''

    const headers = {
      Accept: 'application/json',
    }

    let body
    const method = request.method.toUpperCase()

    if (method !== 'GET' && method !== 'HEAD') {
      if (contentType.includes('application/json')) {
        headers['Content-Type'] = 'application/json'
        body = await request.text()
      } else if (contentType.includes('multipart/form-data')) {
        body = await request.formData()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = await request.text()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      } else {
        body = await request.arrayBuffer()
      }
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    })

    const responseHeaders = new Headers()
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) {
      responseHeaders.set('Content-Type', upstreamContentType)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error?.message || 'Failed to reach backend service.',
      },
      { status: 502 }
    )
  }
}

export async function GET(request, context) {
  return forwardRequest(request, context)
}

export async function POST(request, context) {
  return forwardRequest(request, context)
}

export async function PUT(request, context) {
  return forwardRequest(request, context)
}

export async function PATCH(request, context) {
  return forwardRequest(request, context)
}

export async function DELETE(request, context) {
  return forwardRequest(request, context)
}

export async function OPTIONS(request, context) {
  return forwardRequest(request, context)
}
