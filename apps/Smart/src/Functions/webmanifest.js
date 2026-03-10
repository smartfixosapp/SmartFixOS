export default function manifest(req) {
  const manifest = {
    name: "SmartFixOS",
    short_name: "SmartFixOS",
    description: "Sistema de gestión para taller de reparaciones",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/572f84138_IMG_0296.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/572f84138_IMG_0296.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
