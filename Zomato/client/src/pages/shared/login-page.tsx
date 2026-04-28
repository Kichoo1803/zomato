import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/auth";
import {
  getDefaultRedirectPath,
  getApiErrorMessage,
  getLoginErrorMessage,
  loginWithPassword,
  logoutFromServer,
  registerWithPassword,
} from "@/lib/auth";
import { optionalIndianPhoneSchema } from "@/lib/phone";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: optionalIndianPhoneSchema().or(z.literal("")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  address: z.string().trim().max(240).optional().or(z.literal("")),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

type AuthVariant = "customer" | "partner" | "owner" | "delivery" | "ops" | "admin";

const getOwnerAliasPath = (pathname: string) => {
  if (pathname === "/partner" || pathname === "/partner/") {
    return "/owner/dashboard";
  }

  if (pathname.startsWith("/partner/menu")) {
    return "/owner/menu";
  }

  if (pathname.startsWith("/partner/orders")) {
    return "/owner/orders";
  }

  if (pathname.startsWith("/partner/reviews")) {
    return "/owner/reviews";
  }

  if (pathname.startsWith("/partner/earnings")) {
    return "/owner/analytics";
  }

  if (pathname.startsWith("/partner/settings")) {
    return "/owner/profile";
  }

  return "/owner/dashboard";
};

const getAuthVariant = (pathname: string): AuthVariant => {
  if (pathname.startsWith("/owner")) {
    return "owner";
  }

  if (pathname.startsWith("/partner")) {
    return "partner";
  }

  if (pathname.startsWith("/delivery")) {
    return "delivery";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  if (pathname.startsWith("/ops")) {
    return "ops";
  }

  return "customer";
};

const authCopy: Record<
  AuthVariant,
  {
    eyebrow: string;
    title: string;
    description: string;
    credentials?: string[];
    applicationPath?: string;
    applicationLabel?: string;
  }
> = {
  customer: {
    eyebrow: "Welcome back",
    title: "Sign in",
    description: "Sign in to continue with your account.",
  },
  partner: {
    eyebrow: "Partner access",
    title: "Sign in",
    description: "Sign in to continue with your restaurant partner account.",
    applicationPath: "/register/restaurant-owner",
    applicationLabel: "Apply as restaurant owner",
  },
  owner: {
    eyebrow: "Owner access",
    title: "Sign in",
    description: "Sign in to continue to your restaurant owner dashboard.",
    applicationPath: "/register/restaurant-owner",
    applicationLabel: "Apply as restaurant owner",
  },
  delivery: {
    eyebrow: "Delivery access",
    title: "Sign in",
    description: "Sign in to continue with your delivery partner account.",
    applicationPath: "/register/delivery-partner",
    applicationLabel: "Apply as delivery partner",
  },
  ops: {
    eyebrow: "Operations access",
    title: "Sign in",
    description: "Sign in to continue with your regional manager account.",
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
  const requestedSearch = state?.from?.search ?? "";
  const requestedHash = state?.from?.hash ?? "";
  const requestedLocation = requestedPath ? `${requestedPath}${requestedSearch}${requestedHash}` : null;

  if (
    !requestedPath ||
    requestedPath === "/login" ||
    requestedPath === "/signup" ||
    requestedPath.startsWith("/register") ||
    requestedPath === "/owner/register" ||
    requestedPath === "/delivery/register"
  ) {
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

  if (requestedPath.startsWith("/partner")) {
    if (role === "RESTAURANT_OWNER") {
      return getOwnerAliasPath(requestedPath);
    }

    return fallbackPath;
  }

  if (requestedPath.startsWith("/owner") && role !== "RESTAURANT_OWNER") {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/ops") && !["REGIONAL_MANAGER"].includes(role)) {
    return fallbackPath;
  }

  if (requestedPath.startsWith("/delivery") && !["ADMIN", "DELIVERY_PARTNER"].includes(role)) {
    return fallbackPath;
  }

  if (
    [
      "/cart",
      "/checkout",
      "/payment",
      "/order-success",
      "/favorites",
      "/track-order",
      "/orders",
      "/notifications",
      "/profile",
      "/addresses",
      "/wallet",
    ].some((path) => requestedPath === path || requestedPath.startsWith(`${path}/`)) &&
    role !== "CUSTOMER"
  ) {
    return fallbackPath;
  }

  return requestedLocation ?? fallbackPath;
};

const LoginForm = ({ registerPath = "/register" }: { registerPath?: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
      setSubmitError(getLoginErrorMessage(error));
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
        type={isPasswordVisible ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Enter your password"
        error={form.formState.errors.password?.message}
        trailingContent={
          <button
            type="button"
            onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-accent/5 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            aria-pressed={isPasswordVisible}
          >
            {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
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
        <Link to={registerPath} className="font-semibold text-accent">
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
      confirmPassword: "",
      address: "",
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
      <IndianPhoneInput
        label="Phone"
        autoComplete="tel"
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
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        error={form.formState.errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Textarea
        label="Address (optional)"
        placeholder="You can add detailed delivery addresses later from your account."
        error={form.formState.errors.address?.message}
        {...form.register("address")}
      />
      <p className="text-xs leading-6 text-ink-muted">
        This optional note helps at signup, while structured delivery addresses are still managed safely
        from your saved addresses page after account creation.
      </p>
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
  const isUserRegistrationRoute = location.pathname === "/register/user";
  const isSignup = location.pathname === "/signup" || isUserRegistrationRoute;
  const authVariant = getAuthVariant(location.pathname);
  const copy = authCopy[authVariant];
  const registerPath =
    authVariant === "owner" || authVariant === "partner"
      ? "/register/restaurant-owner"
      : authVariant === "delivery"
        ? "/register/delivery-partner"
        : authVariant === "customer"
          ? "/register/user"
          : "/register";

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
            ? isUserRegistrationRoute
              ? "Create your customer account with the live backend while keeping the existing premium auth flow and login behavior intact."
              : "Create a customer account with the live backend while keeping the current premium auth layout intact."
            : copy.description}
        </p>
      </div>
      {isSignup ? <SignupForm /> : <LoginForm registerPath={registerPath} />}
      {!isSignup && authVariant === "admin" && copy.credentials?.length ? (
        <div className="rounded-[2rem] border border-accent/10 bg-cream-soft/80 p-6 text-sm text-ink-soft shadow-soft">
          Admin helper credentials:
          <div className="mt-4 space-y-2 font-medium text-ink">
            {copy.credentials.map((credential) => (
              <p key={credential}>`{credential}`</p>
            ))}
          </div>
        </div>
      ) : null}
      {!isSignup && copy.applicationPath && copy.applicationLabel ? (
        <div className="rounded-[2rem] border border-accent/10 bg-white/80 p-6 text-sm text-ink-soft shadow-soft">
          Need onboarding approval first?
          <div className="mt-4">
            <Link to={copy.applicationPath} className="font-semibold text-accent">
              {copy.applicationLabel}
            </Link>
          </div>
        </div>
      ) : null}
      <Link to="/" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
        Return home
      </Link>
    </div>
  );
};
