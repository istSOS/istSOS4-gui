import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import fetchLogin from "../server/fetchLogin";

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { setToken } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login", username, password);
        console.log("Risposta login:", login);
        if (login?.access_token) {
            setToken(login.access_token);
            onClose();
        } else {
            setError("Login failed");
        }
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 32, borderRadius: 8, minWidth: 300 }}>
                <h2>Login</h2>
                <input
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={{ display: "block", marginBottom: 8, width: "100%" }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ display: "block", marginBottom: 8, width: "100%" }}
                />
                <button type="submit" style={{ width: "100%" }}>Login</button>
                {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
                <button type="button" onClick={onClose} style={{ marginTop: 8, width: "100%" }}>Chiudi</button>
            </form>
        </div>
    );
}