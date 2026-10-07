import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found.</h1>
      <p className="mt-4 text-sm leading-6 text-muted">Return to Mockly to continue as JK or HE.</p>
      <Link href="/" className="mx-auto mt-7 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90">Back to Mockly</Link>
    </main>
  );
}
