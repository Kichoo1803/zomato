import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.34em] text-accent">404</p>
      <h1 className="font-display text-6xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-lg text-sm leading-7 text-ink-soft">
        The page you’re looking for hasn’t been mapped into the experience yet.
      </p>
      <Link to="/" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft">
        Go home
      </Link>
    </div>
  );
};
