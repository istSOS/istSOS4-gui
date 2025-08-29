import React, { createContext, useContext, useState, useEffect } from "react";
import { setGlobalTimeShift } from "../components/hooks/formatDateWithTimezone";

const TimezoneContext = createContext({
  timezone: "UTC",
  setTimezone: (_tz: string) => {},
  timeShiftHours: 0,
  setTimeShiftHours: (_h: number) => {}
});

export const TimezoneProvider = ({ children }) => {
  const [timezone, setTimezone] = useState("UTC");
  const [timeShiftHours, setTimeShiftHours] = useState<number>(0);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, timeShiftHours, setTimeShiftHours }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => useContext(TimezoneContext);