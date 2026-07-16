import { useState } from "react";
import { useAuth } from "../AuthContext";
import { T } from "../theme";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: T.canvas, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: T.panel, border: `1px solid ${T.line}` }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: T.amber, color: "#3A2600", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            B
          </div>
          <div
            className="text-lg font-semibold leading-tight"
            style={{ color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Book<span style={{ color: T.amber }}>My</span>Seat
          </div>
        </div>

        <label className="block mb-3">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>
            Work email
          </span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full mt-1 text-sm rounded-lg px-3 py-2.5"
            style={{ border: `1px solid ${T.line}`, color: T.ink }}
          />
        </label>

        <label className="block mb-5">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>
            Password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full mt-1 text-sm rounded-lg px-3 py-2.5"
            style={{ border: `1px solid ${T.line}`, color: T.ink }}
          />
        </label>

        {error && (
          <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: T.redSoft, color: T.red }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-transform active:scale-95"
          style={{
            background: loading ? T.line : T.amber,
            color: loading ? T.inkSoft : "#3A2600",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
