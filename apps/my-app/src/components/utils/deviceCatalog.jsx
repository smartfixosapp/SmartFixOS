import { CATEGORY_ICONS, BRAND_ICONS, norm } from "./iconsMap";

// AMPLIADO: teléfonos, tablets, computadoras, relojes, consolas
export const DEVICE_CATALOG = {
  brands: [
    {
      id: "apple",
      name: "Apple",
      label: "Apple",
      icon: BRAND_ICONS.apple,
      icon_url: BRAND_ICONS.apple,
      active: true,
      families: [
        {
          id: "iphone",
          name: "iPhone",
          label: "iPhone",
          type: "phone",
          icon: CATEGORY_ICONS.phone,
          series: [
            {
              id: "iphone-17",
              label: "17",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "iphone-17-pro-max", label: "Pro Max", release_date: "2025-09-15" },
                { id: "iphone-17-pro", label: "Pro", release_date: "2025-09-15" },
                { id: "iphone-17-plus", label: "Plus", release_date: "2025-09-15" },
                { id: "iphone-17", label: "Standard", release_date: "2025-09-15" }
              ]
            },
            {
              id: "iphone-16",
              label: "16",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "iphone-16-pro-max", label: "Pro Max", release_date: "2024-09-20" },
                { id: "iphone-16-pro", label: "Pro", release_date: "2024-09-20" },
                { id: "iphone-16-plus", label: "Plus", release_date: "2024-09-20" },
                { id: "iphone-16", label: "Standard", release_date: "2024-09-20" }
              ]
            },
            {
              id: "iphone-15",
              label: "15",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "iphone-15-pro-max", label: "Pro Max", release_date: "2023-09-22" },
                { id: "iphone-15-pro", label: "Pro", release_date: "2023-09-22" },
                { id: "iphone-15-plus", label: "Plus", release_date: "2023-09-22" },
                { id: "iphone-15", label: "Standard", release_date: "2023-09-22" }
              ]
            },
            {
              id: "iphone-14",
              label: "14",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "iphone-14-pro-max", label: "Pro Max", release_date: "2022-09-16" },
                { id: "iphone-14-pro", label: "Pro", release_date: "2022-09-16" },
                { id: "iphone-14-plus", label: "Plus", release_date: "2022-09-16" },
                { id: "iphone-14", label: "Standard", release_date: "2022-09-16" }
              ]
            },
            {
              id: "iphone-13",
              label: "13",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "iphone-13-pro-max", label: "Pro Max", release_date: "2021-09-24" },
                { id: "iphone-13-pro", label: "Pro", release_date: "2021-09-24" },
                { id: "iphone-13-mini", label: "Mini", release_date: "2021-09-24" },
                { id: "iphone-13", label: "Standard", release_date: "2021-09-24" }
              ]
            }
          ]
        },
        {
          id: "ipad",
          name: "iPad",
          label: "iPad",
          type: "tablet",
          icon: CATEGORY_ICONS.tablet,
          series: [
            {
              id: "ipad-pro",
              label: "Pro",
              icon_url: CATEGORY_ICONS.tablet,
              models: [
                { id: "ipad-pro-13-m4", label: "13\" M4", release_date: "2024-05-15" },
                { id: "ipad-pro-11-m4", label: "11\" M4", release_date: "2024-05-15" }
              ]
            },
            {
              id: "ipad-air",
              label: "Air",
              icon_url: CATEGORY_ICONS.tablet,
              models: [
                { id: "ipad-air-13-m2", label: "13\" M2", release_date: "2024-05-15" },
                { id: "ipad-air-11-m2", label: "11\" M2", release_date: "2024-05-15" }
              ]
            }
          ]
        },
        {
          id: "macbook",
          name: "MacBook",
          label: "MacBook",
          type: "laptop",
          icon: CATEGORY_ICONS.laptop,
          series: [
            {
              id: "macbook-pro",
              label: "Pro",
              icon_url: CATEGORY_ICONS.laptop,
              models: [
                { id: "macbook-pro-16-m3", label: "16\" M3 Max", release_date: "2023-11-07" },
                { id: "macbook-pro-14-m3", label: "14\" M3 Pro", release_date: "2023-11-07" }
              ]
            },
            {
              id: "macbook-air",
              label: "Air",
              icon_url: CATEGORY_ICONS.laptop,
              models: [
                { id: "macbook-air-15-m3", label: "15\" M3", release_date: "2024-03-04" },
                { id: "macbook-air-13-m3", label: "13\" M3", release_date: "2024-03-04" }
              ]
            }
          ]
        },
        {
          id: "apple-watch",
          name: "Apple Watch",
          label: "Apple Watch",
          type: "watch",
          icon: CATEGORY_ICONS.watch,
          series: [
            {
              id: "watch-series-10",
              label: "Series 10",
              icon_url: CATEGORY_ICONS.watch,
              models: [
                { id: "watch-10-46mm", label: "46mm", release_date: "2024-09-20" },
                { id: "watch-10-42mm", label: "42mm", release_date: "2024-09-20" }
              ]
            },
            {
              id: "watch-ultra",
              label: "Ultra",
              icon_url: CATEGORY_ICONS.watch,
              models: [
                { id: "watch-ultra-2", label: "Ultra 2", release_date: "2023-09-22" }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "samsung",
      name: "Samsung",
      label: "Samsung",
      icon: BRAND_ICONS.samsung,
      icon_url: BRAND_ICONS.samsung,
      active: true,
      families: [
        {
          id: "galaxy-s",
          name: "Galaxy S",
          label: "Galaxy S",
          type: "phone",
          icon: CATEGORY_ICONS.phone,
          series: [
            {
              id: "galaxy-s24",
              label: "S24",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "s24-ultra", label: "Ultra", release_date: "2024-01-24" },
                { id: "s24-plus", label: "Plus", release_date: "2024-01-24" },
                { id: "s24", label: "Standard", release_date: "2024-01-24" }
              ]
            },
            {
              id: "galaxy-s23",
              label: "S23",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "s23-ultra", label: "Ultra", release_date: "2023-02-17" },
                { id: "s23-plus", label: "Plus", release_date: "2023-02-17" },
                { id: "s23", label: "Standard", release_date: "2023-02-17" }
              ]
            }
          ]
        },
        {
          id: "galaxy-z",
          name: "Galaxy Z",
          label: "Galaxy Z (Plegable)",
          type: "phone",
          icon: CATEGORY_ICONS.phone,
          series: [
            {
              id: "galaxy-z-fold",
              label: "Z Fold",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "z-fold-6", label: "6", release_date: "2024-07-26" },
                { id: "z-fold-5", label: "5", release_date: "2023-08-11" }
              ]
            },
            {
              id: "galaxy-z-flip",
              label: "Z Flip",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "z-flip-6", label: "6", release_date: "2024-07-26" },
                { id: "z-flip-5", label: "5", release_date: "2023-08-11" }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "motorola",
      name: "Motorola",
      label: "Motorola",
      icon: BRAND_ICONS.motorola,
      icon_url: BRAND_ICONS.motorola,
      active: true,
      families: [
        {
          id: "moto-g",
          name: "Moto G",
          label: "Moto G",
          type: "phone",
          icon: CATEGORY_ICONS.phone,
          series: [
            {
              id: "moto-g-2024",
              label: "G (2024)",
              icon_url: CATEGORY_ICONS.phone,
              models: [
                { id: "moto-g-power-2024", label: "Power", release_date: "2024-03-01" },
                { id: "moto-g-stylus-2024", label: "Stylus", release_date: "2024-05-01" }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Función de búsqueda
export function searchDeviceCatalog(query) {
  const q = query.toLowerCase().trim();
  const results = [];

  DEVICE_CATALOG.brands.forEach(brand => {
    brand.families?.forEach(family => {
      family.series?.forEach(series => {
        series.models?.forEach(model => {
          const fullName = `${brand.label} ${family.label} ${series.label} ${model.label}`.toLowerCase();
          if (fullName.includes(q)) {
            results.push({
              brand,
              family,
              series,
              model
            });
          }
        });
      });
    });
  });

  return results;
}
