import { useState, type FormEvent } from "react";
import { api, auth } from "../api";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; expiresAt: number }>("/admin/login", { method: "POST", body: { password } });
      auth.save(res.token, res.expiresAt);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <img src="./logo.png" alt="PicPac" className="login-logo" />
        <h1>Вход в админку</h1>
        <label className="field">
          <span>Пароль</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" disabled={busy || !password}>{busy ? "Входим…" : "Войти"}</button>
        <p className="muted small">Пароль задаётся переменной ADMIN_PASSWORD в server/.env</p>
      </form>
    </div>
  );
}
