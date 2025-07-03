import React from "react";
import { Button, Link } from "@heroui/react";
import { useAuth } from "../../context/AuthContext";
import { withRouter } from "next/router";
import fetchUserRole from "../../server/fetchUser";
import { siteConfig } from "../../config/site";
import fetchLogout from "../../server/fetchLogout";
import { LogoIstSOS } from "../icons";

export const mainColor = siteConfig.main_color;


export default function UserBar({
    onLoginClick,
    onCreateUserClick,
}) {
    const { token, setToken } = useAuth();
    let username = "User";
    let isAdmin = false;

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            username = payload.sub || "User";
            isAdmin = payload.role === "administrator" || false;
        } catch (e) {
            console.error("Error parsing token:", e);
            username = "User";
            isAdmin = false;
        }
    }

    return (
        <div
            style={{
                width: "100%",
                background: mainColor,
                color: "#fff",
                padding: "15px 75px", // Increase the horizontal padding here
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                minHeight: 36,
            }}
        >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Link isExternal aria-label="istSOS4" href={siteConfig.links.istSOS}>
                    <div style={{ width: 150, height: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <LogoIstSOS style={{ width: "100%", height: "auto" }} />
                    </div>
                </Link>
            </div>

            {/* User */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/*
                {!token && (
                    <Button color="primary" size="sm" onClick={onLoginClick}>
                        Login
                    </Button>
                )} */}
                {token && (
                    <>
                        <span>Hi, <b>{username}</b></span>
                        {isAdmin && (
                            <Button color="secondary" size="sm" onClick={onCreateUserClick}>
                                Create User
                            </Button>
                        )}
                        <Button
                            color="danger"
                            size="sm"
                            onPress={async () => {
                                if (token) await fetchLogout(token);
                                setToken(null);
                            }}
                            style={{ marginLeft: 8 }}
                        >
                            Logout
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
