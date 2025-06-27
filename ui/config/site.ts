export type SiteConfig = typeof siteConfig;

const api_root = "http://api:5000/istsos4/v1.1/";

export const siteConfig = {
  name: "istSOS4 admin ui",
  main_color: "#008374",
  secondary_color: "#007668",
  

  //HARDCODED PLACEHOLDER NETWORKS
  networks: [
    {
      label: "Network 1",
      href: "network",
    },
    {
      label: "Network 2",
      href: "network",
    }
  ],

  items: [

    {
      label: "Users",
      href: "/users",
      fetch: api_root + "Users",
    },
    {
      label: "Locations",
      href: "/locations",
      fetch: api_root + "Locations",
    },
        {
      label: "Datastreams",
      href: "/datastreams",
      fetch: api_root + "Datastreams",
    },
    {
      label: "Things",
      href: "/things",
      fetch: api_root + "Things",
    },
    {
      label: "Sensors",
      href: "/sensors",
      fetch: api_root + "Sensors",
    },
    {
      label: "Observations",
      href: "/observations",
      fetch: api_root + "Observations",
    },

  ],
  navMenuItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Users",
      href: "/users",
    },
    {
      label: "Locations",
      href: "/locations",
    },
    {
      label: "Things",
      href: "/things",
    },
    {
      label: "Sensors",
      href: "/sensors",
    },
    {
      label: "Observations",
      href: "/observations",
    },
  ],
  links: {
    github: "https://github.com/LucaBTE/istSOS4-gui",
    istSOS: "https://istsos.org",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
