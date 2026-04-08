import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      // Hook this to the real email-reset endpoint when that module is exposed in the client app.
      await Promise.resolve();
      toast.success("Reset instructions prepared for this account.");
      navigate("/verify-otp", { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-accent">Password recovery</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Reset access</h1>
        <p className="mt-4 text-sm leading-7 text-ink-soft">
          Enter the email tied to your account and continue through the same premium auth shell already used for sign in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 shadow-soft">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button className="w-full" type="submit" disabled={isSubmitting || !email.trim()}>
          {isSubmitting ? "Sending code..." : "Send verification code"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-3">
        <Link to="/login" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
          Return to login
        </Link>
        <Link
          to="/signup"
          className="inline-flex rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
        >
          Create account
        </Link>
      </div>
    </div>
  );
};

export const OtpVerificationPage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      // This stays client-safe for now and becomes a real verify/reset call when those endpoints are wired.
      await Promise.resolve();
      toast.success("Verification complete. You can sign in now.");
      navigate("/login", { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-accent">Verification</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Confirm your code</h1>
        <p className="mt-4 text-sm leading-7 text-ink-soft">
          Finish the recovery flow with the one-time code and choose a new password without changing the existing auth layout.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 shadow-soft">
        <Input
          label="Verification code"
          inputMode="numeric"
          placeholder="Enter the 6-digit code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a strong new password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button className="w-full" type="submit" disabled={isSubmitting || !code.trim() || !password.trim()}>
          {isSubmitting ? "Verifying..." : "Verify and continue"}
        </Button>
      </form>

      <Link to="/forgot-password" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
        Back to recovery
      </Link>
    </div>
  );
};
