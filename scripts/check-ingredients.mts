// Quick self-check for ingredient matching and units: npx tsx scripts/check-ingredients.mts
import { matchCatalog } from "../src/lib/ingredients/match";
import { toStandard } from "../src/lib/ingredients/units";

const names: [string, string | null][] = [
  ["scallions", "green onion"], ["Green Onions", "green onion"], ["spring onion", "green onion"],
  ["cherry tomatoes", "cherry tomato"], ["tomatoes", "tomato"], ["roma tomatoes", "tomato"],
  ["EVOO", "olive oil"], ["extra-virgin olive oil", "olive oil"], ["garlic cloves", "garlic"],
  ["fresh basil leaves", "basil"], ["Parmigiano-Reggiano", "parmesan"], ["kosher salt", "salt"],
  ["freshly ground black pepper", "black pepper"], ["boneless skinless chicken thighs", "chicken thigh"],
  ["ground beef", "ground beef"], ["ground cumin", "cumin"], ["smoked paprika", "smoked paprika"],
  ["bay leaves", "bay leaf"], ["anchovies", "anchovy"], ["potatoes", "potato"], ["radishes", "radish"],
  ["baby spinach", "spinach"], ["coriander leaves", "cilantro"], ["ground coriander", "coriander"],
  ["heavy whipping cream", "heavy cream"], ["large eggs", "egg"], ["rigatoni", "short pasta"],
  ["red pepper flakes", "red pepper flake"], ["frozen peas", "frozen peas"], ["dried shiitake", "dried shiitake"],
  ["fresh mozzarella", "fresh mozzarella"], ["shredded mozzarella", "mozzarella"], ["gochujang", "gochujang"],
  ["chili crisp", "chili crisp"], ["dragon fruit", null], ["yuzu kosho", null],
];
let bad = 0;
for (const [n, want] of names) {
  const got = matchCatalog(n)?.name ?? null;
  if (got !== want) { bad++; console.log(`✗ ${n} -> ${got} (want ${want})`); }
}
const units: [number | null, string | null, number | null, string][] = [
  [2, "tbsp", 29.6, "ml"], [1, "cup", 236.6, "ml"], [3, "tsp", 14.8, "ml"], [1, "lb", 453.6, "g"],
  [8, "ounces", 226.8, "g"], [500, "grams", 500, "g"], [3, "cloves", 3, "clove"], [2, null, 2, "each"],
  [1, "can", 1, "can"], [null, "pinch", null, "pinch"], [1, "T", 14.8, "ml"], [1, "t", 4.93, "ml"],
];
for (const [q, u, wantAmt, wantUnit] of units) {
  const s = toStandard(q, u);
  if (s.amount !== wantAmt || s.unit !== wantUnit) { bad++; console.log(`✗ ${q} ${u} -> ${s.amount} ${s.unit}`); }
}
console.log(bad ? `${bad} problems` : `all ${names.length + units.length} checks pass`);
process.exit(bad ? 1 : 0);
