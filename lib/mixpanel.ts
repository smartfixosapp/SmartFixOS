//@ts-nocheck
//@ts-ignore
import mixpanel from "mixpanel-browser";

const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
};


const test = getEnvVar("VITE_MIXPANEL_KEY");
const live = getEnvVar("VITE_MIXPANEL_KEY");
let token = "";

if (import.meta.env.NODE_ENV === "development") {
  token = test;
} else {
  token = live;
}

mixpanel.init(token, {
    autocapture: {
      pageview: "full-url",
      click: false,
      input: false,
      scroll: false,
      submit: false,
      capture_text_content: false,
    },
    autotrack:true,
    debug: true,
    track_pageview: true,
    persistence: "localStorage",
});


export function trackPageView(pageName, properties = {}) {
  try {
    mixpanel.track("Page Viewed", {
      page: pageName,
      ...properties,
    });
  } catch (e) {
    if (import.meta.env?.DEV) console.warn("[tracking] Page view failed:", e);
  }
}

export function track(eventName, properties = {}) {
  try {
    mixpanel.track(eventName, properties);
  } catch (e) {
    if (import.meta.env?.DEV) console.warn("[tracking] Event failed:", e);
  }
}

export default mixpanel;
