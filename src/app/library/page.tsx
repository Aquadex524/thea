import Header from "../header";
import Library from "./library";

export const metadata = { title: "Library · Thea" };

export default function LibraryPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header active="library" />
      <Library />
    </main>
  );
}
