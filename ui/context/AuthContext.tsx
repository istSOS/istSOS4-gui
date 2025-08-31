/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import fetchRefresh from "../server/fetchRefresh";

type AuthContextType = {
  token: string | null;
  setToken: (token: string | null) => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  loading: true,
});

//create the auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  //function to decode jwt token
  const decodeToken = (jwt: string) => {
    try {
      //split the jwt token and decode the payload
      return JSON.parse(atob(jwt.split(".")[1]));
    } catch {
      return null;
    }
  };

  //check token expiration and refresh if necessary
  useEffect(() => {
    if (!token) return;
    const payload = decodeToken(token);
    if (!payload?.exp) return;

    //set now to current time in seconds
    const now = Math.floor(Date.now() / 1000);

    const timeLeft = payload.exp - now;

    //if the token is about to expire in less than 2 minutes, refresh it
    if (timeLeft < 120) {
      fetchRefresh(token).then(newToken => {
        //if the refresh was successful, set the new token
        if (newToken) setToken(newToken);
        //if the refresh failed, clear the token
        else setToken(null);
      });
    }
  }, [token]);

  //initialize token from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      //take the token from local storage if it exists
      const storedToken = localStorage.getItem("token");
      if (storedToken) setTokenState(storedToken);
      setLoading(false);
    }
  }, []);

  //set token in state and local storage
  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("token", newToken);
    } else {
      localStorage.removeItem("token");
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

//custom hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}
