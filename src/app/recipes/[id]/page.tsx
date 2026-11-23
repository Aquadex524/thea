import Header from "../../header";
import SavedRecipe from "./saved-recipe";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header active="library" />
      <SavedRecipe id={id} />
    </main>
  );
}
