import React, { createContext, useContext, useState } from "react";

const TimezoneContext = createContext({
  timezone: "UTC",
  setTimezone: (tz: string) => {},
});

export const TimezoneProvider = ({ children }) => {
  const [timezone, setTimezone] = useState("UTC");
  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => useContext(TimezoneContext);