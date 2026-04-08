import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/auth";
import {
  getApiErrorMessage,
  getDefaultRedirectPath,
  loginWithPassword,
  logoutFromServer,
  registerWithPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

type LocationState = {
  from?: {
    pathname?: string;
  };
};

type AuthVariant = "customer" | "partner" | "delivery" | "admin";

const getAuthVariant = (pathname: string): AuthVariant => {
  if (pathname.startsWith("/partner")) {
    return "partner";
  }

  if (pathname.startsWith("/delivery")) {
    return "delivery";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  return "customer";
};

const authCopy: Record<
  AuthVariant,
  {
    eyebrow: string;
    title: string;
    description: string;
    credentials: string[];
  }
> = {
  customer: {
    eyebrow: "Welcome back",
    title: "Sign in",
    description: "Use your seeded backend credentials to sign in through the live API.",
    credentials: [
      "aditi.verma@zomatoluxe.dev / Password@123",
      "admin@zomatoluxe.dev / Password@123",
    ],
  },
  partner: {
    eyebrow: "Partner access",
    title: "Restaurant partner login",
    description: "Sign in with a restaurant owner account and continue into the partner dashboard flow already wired to the backend auth module.",
    credentials: ["aarav.mehta@zomatoluxe.dev / Password@123"],
  },
  delivery: {
    eyebrow: "Delivery access",
    title: "Delivery partner login",
    description: "Use a seeded delivery partner account to enter the operations dashboard without changing the current auth design.",
    credentials: ["ravi.kumar@zomatoluxe.dev / Password@123"],
  },
  admin: {
    eyebrow: "Admin access",
    title: "Admin login",
    description: "Authenticate with an admin account to enter the platform control room through the same existing auth UI.",
    credentials: ["admin@zomatoluxe.dev / Password@123"],
  },
};

const resolveNextPath = (role: UserRole, state: LocationState | null) => {
  const fallbackPath = getDefaultRedirectPath(role);
  const requestedPath = state?.from?.pathname;

  if (!requestedPath || requestedPath === "/login" || requestedPath === "/signup") {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/admin") && role !== "ADMIN") {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/analytics") && role !== "ADMIN") {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/team") && role !== "ADMIN") {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/partner") && !["ADMIN", "RESTAURANT_OWNER"].includes(role)) {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/delivery") && !["ADMIN", "DELIVERY_PARTNER"].includes(role)) {
    return fallbackPath;
  }

  return requestedPath;
};

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const session = await loginWithPassword(values);
      setSession(session);
      toast.success("Welcome back.");
      navigate(resolveNextPath(session.user.role, location.state as LocationState | null), {
        replace: true,
      });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Unable to sign in right now."));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 shadow-soft">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="aditi.verma@zomatoluxe.dev"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      {submitError ? (
        <div className="rounded-2xl border border-accent/10 bg-white px-4 py-3 text-sm text-accent-soft shadow-soft">
          {submitError}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Link to="/forgot-password" className="text-sm font-semibold text-accent">
          Forgot password?
        </Link>
      </div>
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-sm text-ink-soft">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </form>
  );
};

const SignupForm = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const session = await registerWithPassword({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
      });
      setSession(session);
      toast.success("Account created successfully.");
      navigate(getDefaultRedirectPath(session.user.role), { replace: true });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Unable to create your account right now."));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 shadow-soft">
      <Input
        label="Full name"
        autoComplete="name"
        placeholder="Aditi Verma"
        error={form.formState.errors.fullName?.message}
        {...form.register("fullName")}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <Input
        label="Phone"
        type="tel"
        autoComplete="tel"
        placeholder="+919830000301"
        error={form.formState.errors.phone?.message}
        {...form.register("phone")}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Choose a strong password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      {submitError ? (
        <div className="rounded-2xl border border-accent/10 bg-white px-4 py-3 text-sm text-accent-soft shadow-soft">
          {submitError}
        </div>
      ) : null}
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating account..." : "Create account"}
      </Button>
      <p className="text-sm text-ink-soft">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearSession } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isSignup = location.pathname === "/signup";
  const authVariant = getAuthVariant(location.pathname);
  const copy = authCopy[authVariant];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isSignup]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutFromServer();
    } catch {
      // Clear local auth state even if the refresh cookie is already absent.
    } finally {
      clearSession();
      setIsLoggingOut(false);
      toast.success("Signed out successfully.");
      navigate("/login", { replace: true });
    }
  };

  if (isAuthenticated && user) {
    const nextPath = resolveNextPath(user.role, location.state as LocationState | null);

    return (
      <div className="mx-auto max-w-md space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Session ready</p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink">You are signed in</h1>
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            Continue where you left off or sign out safely from this device.
          </p>
        </div>
        <div className="rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 text-sm text-ink-soft shadow-soft">
          <p className="font-medium text-ink">{user.fullName}</p>
          <p className="mt-1">{user.email}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.28em] text-accent">{user.role}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate(nextPath, { replace: true })}>Continue</Button>
          <Button variant="secondary" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-accent">{isSignup ? "Join the table" : copy.eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">
          {isSignup ? "Create account" : copy.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink-soft">
          {isSignup
            ? "Create a customer account with the live backend while keeping the current premium auth layout intact."
            : copy.description}
        </p>
      </div>
      {isSignup ? <SignupForm /> : <LoginForm />}
      {!isSignup ? (
        <div className="rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 text-sm text-ink-soft shadow-soft">
          Use the seeded backend users:
          <div className="mt-4 space-y-2 font-medium text-ink">
            {copy.credentials.map((credential) => (
              <p key={credential}>`{credential}`</p>
            ))}
          </div>
        </div>
      ) : null}
      <Link to="/" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
        Return home
      </Link>
    </div>
  );
};
