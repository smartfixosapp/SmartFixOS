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
  }, []);

  return null;
}
