import Header from "../header";
import Ingredients from "./ingredients";

export const metadata = { title: "Items · Thea" };

export default function IngredientsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header active="ingredients" />
      <Ingredients />
    </main>
  );
}
