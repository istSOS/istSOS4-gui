
import { useTranslation } from "react-i18next";

export type SiteConfig = typeof siteConfig;


export const API_ROOT = "http://api:5000/istsos4/v1.1/";

export const siteConfig = {
  name: "istSOS4 admin ui",
  versioning: true,
  main_color: "#008374",
  secondary_color: "#007668",
  api_root: API_ROOT,


  //HARDCODED PLACEHOLDER NETWORKS
  networks: [
    {
      label: "acsot",
    },
    {
      label: "defmin",
    },
    {
      label: "psos",
    }
  ],

  items: [

    {
      label: "Datastreams",
      href: "/datastreams",
      root: API_ROOT + "Datastreams",
      weight: 1,
    },

    {
      label: "Things",
      href: "/things",
      root: API_ROOT + "Things",
      weight: 2,
    },
    {
      label: "Locations",
      href: "/locations",
      root: API_ROOT + "Locations",
      weight: 3,
    },
    {
      label: "HistoricalLocations",
      href: "/historical-locations",
      root: API_ROOT + "HistoricalLocations",
      weight: 4,
    },

    {
      label: "Sensors",
      href: "/sensors",
      root: API_ROOT + "Sensors",
      weight: 2,
    },
    {
      label: "ObservedProperties",
      href: "/observed-properties",
      root: API_ROOT + "ObservedProperties",
      weight: 2,
    },

    {
      label: "Observations",
      href: "/observations",
      root: API_ROOT + "Observations",
      weight: 2,
    },
    {
      label: "FeaturesOfInterest",
      href: "/features-of-interest",
      root: API_ROOT + "FeaturesOfInterest",
      weight: 3,
    },

  ],

  links: {
    github: "https://github.com/LucaBTE/istSOS4-gui",
    istSOS: "https://istsos.org",
    OSGeo: "https://www.osgeo.org/",
  },
};
