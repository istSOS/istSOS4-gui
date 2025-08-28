
import { useTranslation } from "react-i18next";

export type SiteConfig = typeof siteConfig;


export const API_ROOT = "http://api:5000/istsos4/v1.1/";

export const MAP_TILE_LAYER = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",


  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
};

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
    },
    {
      label: "test",
    }
  ],

  items: [

    {
      label: "Datastreams",
      href: "/datastreams",
      root: API_ROOT + "Datastreams",
      nested: ["Thing", "Sensor", "ObservedProperty", "Network"],
      weight: 1,
    },

    {
      label: "Things",
      href: "/things",
      root: API_ROOT + "Things",
      nested: ["Locations", "Datastream"],
      weight: 2,
    },

    {
      label: "Sensors",
      href: "/sensors",
      root: API_ROOT + "Sensors",
      nested: ["Datastream"],
      weight: 2,
    },

    {
      label: "Observations",
      href: "/observations",
      nested: ["Datastream", "FeatureOfInterest"],
      root: API_ROOT + "Observations",
      weight: 2,
    },

    {
      label: "Locations",
      href: "/locations",
      root: API_ROOT + "Locations",
      nested: ["Things"],
      weight: 3,
    },
    {
      label: "HistoricalLocations",
      href: "/historical-locations",
      root: API_ROOT + "HistoricalLocations",
      weight: 3,
    },


    {
      label: "ObservedProperties",
      href: "/observed-properties",
      root: API_ROOT + "ObservedProperties",
      weight: 3,
    },

    {
      label: "FeaturesOfInterest",
      href: "/features-of-interest",
      root: API_ROOT + "FeaturesOfInterest",
      weight: 3,
    },

    {
      label: "Networks",
      href: "/networks",
      root: API_ROOT + "Networks",
      weight: 3,
    },

  ],

  links: {
    github: "https://github.com/LucaBTE/istSOS4-gui",
    istSOS: "https://istsos.org",
    OSGeo: "https://www.osgeo.org/",
  },
};