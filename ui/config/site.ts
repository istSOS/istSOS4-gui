export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "istSOS4 admin ui",
  main_color: "#008374",
  secondary_color: "#007668",
  items: [
    {
      label: "Home",
      href: "/",
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
  navMenuItems: [
      {
      label: "Home",
      href: "/",
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
