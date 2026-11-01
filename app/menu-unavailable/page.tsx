export const metadata = { title: "Menu not available", robots: { index: false } };

/** A tag whose restaurant is switched off or whose free trial has ended. Guests never see why. */
export default function MenuUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Menu not available</h1>
      <p className="mt-3 text-neutral-600">This menu isn&apos;t open right now. Please ask your waiter for the menu.</p>
    </main>
  );
}
