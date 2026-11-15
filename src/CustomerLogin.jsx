
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function CustomerLogin({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Valid 10 digit mobile number enter karein");
      return;
    }

    if (password.length < 6) {
      setError("Password kam se kam 6 characters ka ho");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Apna naam enter karein");
      return;
    }

    setLoading(true);

    // Mobile number ko Firebase ke liye email format dete hain.
    const email = `${mobile}@pds-customer.com`;

    try {
      let user;

      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        user = result.user;

        await setDoc(doc(db, "customers", user.uid), {
          name: name.trim(),
          mobile: mobile,
          createdAt: serverTimestamp()
        });

        onLogin({ name: name.trim(), mobile });
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        user = result.user;

        const profile = await getDoc(
          doc(db, "customers", user.uid)
        );

        if (!profile.exists()) {
          setError("Customer profile nahi mila. Support se contact karein.");
          return;
        }

        const data = profile.data();

        onLogin({
          name: data.name,
          mobile: data.mobile
        });
      }
    } catch (err) {
      console.error("Firebase Login Error:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("Account pehle se bana hua hai. Login karein.");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Mobile number ya password galat hai.");
      } else if (err.code === "auth/weak-password") {
        setError("Password kam se kam 6 characters ka rakhein.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Internet connection check karein.");
      } else if (err.code === "permission-denied") {
        setError("Firestore Rules mein permission check karein.");
      } else {
        setError(err.message || "Login nahi ho paya. Dobara try karein.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#080d1c",
      padding: 20,
      color: "white"
    }}>
      <form onSubmit={submit} style={{
        width: "100%",
        maxWidth: 390,
        padding: 28,
        borderRadius: 22,
        background: "#151e33",
        boxShadow: "0 15px 50px #0008"
      }}>
        <h1 style={{ color: "#e8bd65", textAlign: "center" }}>
          PATEL DIGITAL STUDIO
        </h1>

        <h2 style={{ textAlign: "center" }}>
          {mode === "login" ? "Customer Login" : "Create Account"}
        </h2>

        {mode === "signup" && (
          <input
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={field}
          />
        )}

        <input
          placeholder="10 Digit Mobile Number"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={e => setMobile(e.target.value.replace(/\D/g, ""))}
          required
          style={field}
        />

        <input
          type="password"
          placeholder="Password (Minimum 6 Characters)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={field}
        />

        {error && <p style={{ color: "#ff7777" }}>{error}</p>}

        <button type="submit" disabled={loading} style={btn}>
          {loading
            ? "PLEASE WAIT..."
            : mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20 }}>
          {mode === "login"
            ? "New Customer? "
            : "Already have an account? "}
          <span
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            style={{ color: "#e8bd65", cursor: "pointer" }}
          >
            {mode === "login" ? "Sign Up" : "Login"}
          </span>
        </p>
      </form>
    </div>
  );
}

const field = {
  width: "100%",
  padding: 14,
  margin: "10px 0",
  boxSizing: "border-box",
  borderRadius: 9,
  border: "1px solid #40506c",
  background: "#0b1428",
  color: "white"
};

const btn = {
  width: "100%",
  padding: 15,
  marginTop: 15,
  border: 0,
  borderRadius: 10,
  background: "#d8ad55",
  color: "#101827",
  fontWeight: "bold",
  cursor: "pointer"
};
}                       
