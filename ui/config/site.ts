import Sensors from "../app/sensors/page";

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
      description: "A collection of Observations and the Observations in a Datastream measure the same ObservedProperty and are produced by the same Sensor.",
      weight: 1,
    },

    {
      label: "Things",
      href: "/things",
      root: API_ROOT + "Things",
      description: "An object of the physical world (physical things) or the information world (virtual things) that is capable of being identified and integrated into communication networks.",
      weight: 2,
    },
    {
      label: "Locations",
      href: "/locations",
      root: API_ROOT + "Locations",
      description: "The Location entity locates the Thing or the Things it associated with. A Thing’s Location entity is defined as the last known location of the Thing.",
      weight: 3,
    },
    {
      label: "HistoricalLocations",
      href: "/historical-locations",
      root: API_ROOT + "HistoricalLocations",
      description: "A Thing’s HistoricalLocation entity set provides the times of the current (i.e., last known) and previous locations of the Thing.",
      weight: 4,
    },

    {
      label: "Sensors",
      href: "/sensors",
      root: API_ROOT + "Sensors",
      description: "A Sensor is an instrument that observes a property or phenomenon with the goal of producing an estimate of the value of the property.",
      weight: 2,
    },
    {
      label: "ObservedProperties",
      href: "/observed-properties",
      root: API_ROOT + "ObservedProperties",
      description: "An ObservedProperty specifies the phenomenon of an Observation.",
      weight: 2,
    },

    {
      label: "Observations",
      href: "/observations",
      root: API_ROOT + "Observations",
      description: "An Observation is the act of measuring or otherwise determining the value of a property.",
      weight: 2,
    },
    {
      label: "FeaturesOfInterest",
      href: "/features-of-interest",
      root: API_ROOT + "FeaturesOfInterest",
      description: "An Observation assigns a value to a phenomenon, which is a property of the FeatureOfInterest (FOI). In IoT, the FOI is often the Location of the Thing (e.g., a thermostat’s location is the living room). In remote sensing, the FOI can be the geographic area or volume being observed.",
      weight: 3,
    },

  ],

  links: {
    github: "https://github.com/LucaBTE/istSOS4-gui",
    istSOS: "https://istsos.org",
    OSGeo: "https://www.osgeo.org/",
  },
};
