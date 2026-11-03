/** Shown when a menu link is dead: expired, or never existed. */
export default function Expired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">This menu link has expired</h1>
      <p className="mt-3 text-neutral-600">
        Tap your phone on the tag on your table, or scan its QR code, to open the menu again.
      </p>
    </main>
  );
}
