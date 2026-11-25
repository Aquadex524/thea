import { Suspense } from "react";
import Header from "./header";
import Importer from "./importer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header active="add" />
      <Suspense>
        <Importer />
      </Suspense>
    </main>
  );
}
