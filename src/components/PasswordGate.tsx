import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkSession, clearLegacyToken, setUnauthorizedHandler, verifyPassword } from "@/lib/api";

// Each admin route mounts its own gate, so remember a confirmed session
// across navigations instead of asking the API again every time.
let sessionConfirmed = false;

export function PasswordGate({ children }: { children: React.ReactNode }) {
  // null while the session check is in flight
  const [authenticated, setAuthenticatedState] = useState<boolean | null>(sessionConfirmed ? true : null);
  const setAuthenticated = (value: boolean) => {
    sessionConfirmed = value;
    setAuthenticatedState(value);
  };
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clearLegacyToken();
    if (!sessionConfirmed) {
      checkSession().then((ok) => {
        if (!cancelled) setAuthenticated(ok);
      });
    }
    // The session expired or was revoked mid-use: show the login form again.
    setUnauthorizedHandler(() => setAuthenticated(false));
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  if (authenticated === null) return null;
  if (authenticated) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await verifyPassword(password);
    if (ok) {
      setPassword("");
      setAuthenticated(true);
    } else {
      setError(true);
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Pinpoint Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="*:not-first:mt-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Enter admin password"
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-destructive">Incorrect password. Try again.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking..." : "Enter"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
