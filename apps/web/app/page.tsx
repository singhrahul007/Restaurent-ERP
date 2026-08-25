export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-stone-500">Niva</p>
      <h1 className="text-4xl font-semibold text-stone-900">Restaurant operating system</h1>
      <p className="max-w-xl text-stone-600">
        Foundation shell. Authentication, tenants, and role workspaces are implemented in
        later phases.
      </p>
    </main>
  );
}
