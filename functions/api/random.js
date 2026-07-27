// functions/api/random.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  try {
    const host = url.origin;
    const jsonUrl = `${host}/data/wallpapers.json`;

    const fetchResp = await fetch(new Request(jsonUrl, request));
    if (!fetchResp.ok) {
      return new Response('Failed to load wallpapers.json', { status: 502 });
    }

    const wallpapers = await fetchResp.json();
    if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
      return new Response('No wallpapers found', { status: 404 });
    }

    const validWallpapers = wallpapers.filter(item => item.jpg || item.webp);
    const randomItem = validWallpapers[Math.floor(Math.random() * validWallpapers.length)];
    const redirect = url.searchParams.get('redirect') === 'true';

    const imagePath = randomItem.webp || randomItem.jpg;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (redirect) {
        return Response.redirect(imagePath, 302);
      }
      const resp = await fetch(imagePath);
      return new Response(resp.body, {
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=10800',
        },
      });
    }

    const imageUrl = new URL(imagePath, request.url);
    if (redirect) {
      return Response.redirect(imageUrl.toString(), 302);
    }

    const resp = await fetch(new Request(imageUrl.toString(), request));
    if (!resp.ok) {
      return new Response('Failed to fetch image', { status: 502 });
    }

    return new Response(resp.body, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/webp',
        'Cache-Control': 'public, max-age=10800',
      },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
