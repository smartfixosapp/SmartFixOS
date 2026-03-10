import { useEffect } from "react";

export default function PWAMetaTags() {
  useEffect(() => {
    // Viewport para móviles
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    // Apple Web App Capable (modo standalone)
    let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCapable) {
      appleCapable = document.createElement('meta');
      appleCapable.name = 'apple-mobile-web-app-capable';
      document.head.appendChild(appleCapable);
    }
    appleCapable.content = 'yes';

    // Apple Status Bar Style
    let appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatus) {
      appleStatus = document.createElement('meta');
      appleStatus.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleStatus);
    }
    appleStatus.content = 'black-translucent';

    // Theme Color
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head.appendChild(themeColor);
    }
    themeColor.content = '#000000';

    // Mobile Web App Title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = 'SmartFixOS';

    // Application Name
    let appName = document.querySelector('meta[name="application-name"]');
    if (!appName) {
      appName = document.createElement('meta');
      appName.name = 'application-name';
      document.head.appendChild(appName);
    }
    appName.content = 'SmartFixOS';

    // Mobile optimized
    let mobileOptimized = document.querySelector('meta[name="mobile-web-app-capable"]');
    if (!mobileOptimized) {
      mobileOptimized = document.createElement('meta');
      mobileOptimized.name = 'mobile-web-app-capable';
      document.head.appendChild(mobileOptimized);
    }
    mobileOptimized.content = 'yes';

    // Link to Manifest
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    // We use the function endpoint to serve the manifest
    manifestLink.href = '/api/functions/webmanifest'; // Adjust based on how functions are called in your environment if needed
    // Typically functions are at /api/functions/functionName or similar. 
    // If running via SDK, we can't link directly easily unless there's a URL.
    // For PWA manifest, it needs a URL.
    // Assuming standard Base44 function URL structure or direct import isn't possible for <link>.
    // Fallback: Data URI if function URL is not standard static.
    
    // Better approach: Use a data URI for instant loading without external request dependency issues in layout
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
    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], {type: 'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    manifestLink.href = manifestURL;

  }, []);

  return null;
}
