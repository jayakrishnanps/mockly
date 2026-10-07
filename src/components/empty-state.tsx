export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-y border-line py-10 sm:py-12">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}
