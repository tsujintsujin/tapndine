// The tapndine homepage is a later phase. This page only exists so the
// prototype has a root that says what it is.
export default function Home() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">tapndine</h1>
      <p className="mt-2 text-neutral-600">Tap the tag on your table to see the menu.</p>
    </main>
  );
}
