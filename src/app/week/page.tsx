import Header from "../header";
import Week from "./week";

export const metadata = { title: "This week · Thea" };

export default function WeekPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header active="week" />
      <Week />
    </main>
  );
}
