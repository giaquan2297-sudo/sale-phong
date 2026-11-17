// Cloudflare Pages Function: Proxy /api/* to Render backend with auto-retry & cold-start resilience
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://sale-tro-hanoi.onrender.com');

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const forwardHeaders = new Headers();
  for (const [key, value] of context.request.headers.entries()) {
    const k = key.toLowerCase();
    if (!k.startsWith('cf-') && k !== 'host' && k !== 'content-length') {
      forwardHeaders.set(key, value);
    }
  }
  forwardHeaders.set('host', 'sale-tro-hanoi.onrender.com');

  const hasBody = !['GET', 'HEAD'].includes(context.request.method);
  const body = hasBody ? await context.request.arrayBuffer() : undefined;

  // Try request with 1 automatic retry if cold start occurs
  let response = null;
  let lastErr = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(targetUrl.toString(), {
        method: context.request.method,
        headers: forwardHeaders,
        body,
        redirect: 'follow',
      });
      if (response && response.status !== 502 && response.status !== 503) {
        break; // Successful response
      }
    } catch (err) {
      lastErr = err;
    }
    if (attempt === 0) {
      // Pause 1.5s before retry to allow backend spinup
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (response) {
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      error: 'Máy chủ đang khởi động lại sau thời gian nghỉ. Vui lòng bấm thử lại sau 15 giây!',
      details: lastErr?.message || 'Cold start timeout',
    }),
    {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
