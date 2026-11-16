// Cloudflare Pages Function: Proxy /images/* to Render backend
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://sale-tro-hanoi.onrender.com');

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const newHeaders = new Headers(context.request.headers);
  newHeaders.set('host', 'sale-tro-hanoi.onrender.com');

  const forwardRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: newHeaders,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
    redirect: 'follow',
  });

  try {
    const response = await fetch(forwardRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response('Image not found or server error', {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
