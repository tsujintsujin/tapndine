export const metadata = { robots: { index: false } };

export default function UnknownTag() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">This tag isn&apos;t set up yet</h1>
      <p className="mt-3 text-neutral-600">Please ask the staff for the menu.</p>
    </main>
  );
}
