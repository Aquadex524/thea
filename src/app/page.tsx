import { Suspense } from "react";
import Importer from "./importer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Thea</h1>
          <p className="text-xs text-muted">Recipe videos in, groceries out</p>
        </div>
      </header>
      <Suspense>
        <Importer />
      </Suspense>
    </main>
  );
}
