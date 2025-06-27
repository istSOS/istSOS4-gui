export type SiteConfig = typeof siteConfig;

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
    },
    {
      label: "Locations",
      href: "/locations",
    },
        {
      label: "Datastreams",
      href: "/datastreams",
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
    {
      label: "Network",
      href: "/network",
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
