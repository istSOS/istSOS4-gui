"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../config/site";

import fetchData from "../server/fetchData";
import fetchLogin from "../server/fetchLogin";

export const mainColor = siteConfig.main_color;


export default function Sensors() {
  const router = useRouter();

  React.useEffect(() => {
    async function getData() {
      const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login");
        const sensorData = await fetchData(
        "http://api:5000/istsos4/v1.1/Sensors",
        login.access_token
      );
      console.log(sensorData);
    }

    getData();
  }, []);

  return (
    //display sensors in a table
    <div></div>


  );
}
