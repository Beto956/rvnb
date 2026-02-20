"use client";

import Link from "next/link";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

type Role = "host" | "guest";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("guest");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSignup = async () => {
    setMsg("");
    if (!email || !password) return setMsg("Enter email + password.");

    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        role,
        createdAt: serverTimestamp(),
      });

      router.push(role === "host" ? "/host" : "/listings");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Signup failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Create account</h1>

      <div style={card}>
        <label style={label}>Email</label>
        <input
          style={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label style={label}>Password</label>
        <input
          style={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ marginTop: 10, fontWeight: 900 }}>I am a:</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => setRole("guest")} style={pill(role === "guest")}>
            🙋 Guest
          </button>
          <button onClick={() => setRole("host")} style={pill(role === "host")}>
            🏕️ Host
          </button>
        </div>

        <button onClick={handleSignup} disabled={saving} style={btn}>
          {saving ? "Creating..." : "Sign up"}
        </button>

        {msg && <div style={{ marginTop: 10, fontWeight: 800 }}>{msg}</div>}

        <div style={{ marginTop: 14, opacity: 0.85 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#0b0f19",
  color: "white",
};

const card: React.CSSProperties = {
  marginTop: 14,
  maxWidth: 520,
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
};

const label: React.CSSProperties = { fontWeight: 800, marginTop: 10 };

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 6,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
};

const btn: React.CSSProperties = {
  marginTop: 14,
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.15)",
  background: active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
});
