/**
 * Thea's built-in grocery dictionary.
 *
 * Every ingredient a recipe mentions gets matched to one item here, so "scallions",
 * "spring onions" and "green onions" all become the same thing ("green onion") and the
 * weekly planner can see that two recipes share it.
 *
 * Each item also says how fast it goes off once bought (its freshness tier). The planner
 * uses that to cook recipes with delicate produce early in the week.
 *
 * Ingredients that aren't listed here are classified once by Claude and remembered in the
 * database (see normalize.ts), so this list only needs the common ones.
 * To add an item: add a line to the right section below. Plurals are handled automatically.
 */

import { TIERS, type Tier } from "./tiers";

export { TIERS, type Tier };

export type Category =
  | "produce"
  | "herbs"
  | "meat_seafood"
  | "dairy_eggs"
  | "bakery"
  | "pantry"
  | "spices"
  | "frozen"
  | "other";

export type CatalogItem = {
  name: string;
  category: Category;
  tier: Tier;
  shelfDays: number;
  staple: boolean;
  aliases: string[];
};

type Row = [name: string, aliases?: string[], opts?: { days?: number; staple?: boolean; category?: Category }];

function section(category: Category, tier: Tier, rows: Row[]): CatalogItem[] {
  return rows.map(([name, aliases = [], opts = {}]) => ({
    name,
    category: opts.category ?? category,
    tier,
    shelfDays: opts.days ?? TIERS[tier].shelfDays,
    staple: opts.staple ?? false,
    aliases,
  }));
}

export const CATALOG: CatalogItem[] = [
  // ---------- Herbs: 2–3 days ----------
  ...section("herbs", "days", [
    ["cilantro", ["coriander leaf", "coriander leaves", "fresh coriander", "chinese parsley"]],
    ["parsley", ["flat leaf parsley", "flat-leaf parsley", "italian parsley", "curly parsley"], { days: 4 }],
    ["basil", ["sweet basil", "basil leaf", "genovese basil"]],
    ["thai basil"],
    ["mint", ["mint leaf", "spearmint"]],
    ["dill", ["dill weed"]],
    ["chive", ["chives"]],
    ["tarragon"],
    ["chervil"],
    ["shiso", ["perilla", "perilla leaf"]],
  ]),
  // Hardier herbs last a little longer
  ...section("herbs", "week", [
    ["rosemary", ["rosemary sprig"], { days: 10 }],
    ["thyme", ["thyme sprig"], { days: 10 }],
    ["sage", ["sage leaf"]],
    ["oregano"],
    ["lemongrass", ["lemon grass"], { days: 10 }],
    ["kaffir lime leaf", ["makrut lime leaf", "lime leaf"], { days: 10 }],
    ["bay leaf", ["fresh bay leaf"], { days: 10 }],
  ]),

  // ---------- Produce: 2–3 days ----------
  ...section("produce", "days", [
    ["spinach", ["baby spinach", "spinach leaf"]],
    ["arugula", ["rocket", "baby arugula", "roquette"]],
    ["lettuce", ["romaine", "romaine lettuce", "butter lettuce", "iceberg lettuce", "little gem", "little gem lettuce", "mixed greens", "salad greens", "spring mix"]],
    ["watercress", ["cress"]],
    ["bean sprout", ["mung bean sprout", "sprouts"]],
    ["microgreen", ["microgreens"]],
    ["strawberry"],
    ["raspberry"],
    ["blackberry"],
    ["blueberry", [], { days: 5 }],
    ["mushroom", ["button mushroom", "white mushroom", "cremini", "cremini mushroom", "baby bella", "baby bella mushroom", "chestnut mushroom"], { days: 4 }],
    ["shiitake mushroom", ["shiitake", "fresh shiitake"], { days: 4 }],
    ["oyster mushroom", [], { days: 3 }],
    ["avocado", [], { days: 3 }],
    ["fresh corn", ["corn on the cob", "ear of corn", "sweet corn"], { days: 3 }],
    ["banana", [], { days: 4 }],
  ]),

  // ---------- Produce: about a week ----------
  ...section("produce", "week", [
    ["green onion", ["scallion", "spring onion", "green onions", "scallions", "salad onion"]],
    ["kale", ["lacinato kale", "tuscan kale", "dinosaur kale", "curly kale", "cavolo nero"], { days: 5 }],
    ["swiss chard", ["chard", "rainbow chard"], { days: 5 }],
    ["bok choy", ["baby bok choy", "pak choi", "pak choy", "shanghai bok choy"], { days: 5 }],
    ["napa cabbage", ["chinese cabbage", "wombok"], { days: 7 }],
    ["tomato", ["roma tomato", "plum tomato", "vine tomato", "beefsteak tomato", "heirloom tomato"], { days: 6 }],
    ["cherry tomato", ["grape tomato", "cherry tomatoes"], { days: 6 }],
    ["cucumber", ["english cucumber", "persian cucumber", "mini cucumber", "kirby cucumber"]],
    ["zucchini", ["courgette", "summer squash", "yellow squash"]],
    ["eggplant", ["aubergine", "japanese eggplant", "chinese eggplant"], { days: 5 }],
    ["bell pepper", ["red bell pepper", "green bell pepper", "yellow bell pepper", "orange bell pepper", "capsicum", "sweet pepper", "red pepper", "green pepper", "yellow pepper"]],
    ["jalapeño", ["jalapeno", "jalapeno pepper", "jalapeño pepper"]],
    ["serrano pepper", ["serrano", "serrano chile"]],
    ["thai chili", ["bird's eye chili", "birds eye chili", "thai chile", "red chili", "fresh chili", "chili pepper", "red chile"]],
    ["poblano pepper", ["poblano"]],
    ["broccoli", ["broccoli floret", "broccoli crown"]],
    ["broccolini", ["baby broccoli"], { days: 5 }],
    ["cauliflower", ["cauliflower floret"]],
    ["green bean", ["string bean", "haricot vert", "french bean"], { days: 5 }],
    ["snap pea", ["sugar snap pea", "snow pea", "mangetout"], { days: 5 }],
    ["asparagus", ["asparagus spear"], { days: 4 }],
    ["brussels sprout", ["brussel sprout", "brussels sprouts", "brussel sprouts"]],
    ["celery", ["celery stalk", "celery rib"], { days: 14 }],
    ["fennel", ["fennel bulb"], { days: 7 }],
    ["leek"],
    ["okra"],
    ["lime", [], { days: 14 }],
    ["lemon", ["meyer lemon"], { days: 14 }],
    ["peach"],
    ["mango"],
    ["pineapple"],
    ["pear"],
    ["grape"],
    ["kiwi"],
    ["plum"],
    ["fresh tofu", ["silken tofu", "soft tofu"], { category: "other" }],
    ["tofu", ["firm tofu", "extra firm tofu", "extra-firm tofu"], { category: "other", days: 7 }],
  ]),

  // ---------- Produce: 1–2 weeks or more ----------
  ...section("produce", "weeks", [
    ["yellow onion", ["onion", "brown onion", "white onion", "spanish onion", "sweet onion", "vidalia onion"], { days: 30 }],
    ["red onion", ["purple onion"], { days: 30 }],
    ["shallot", ["eschalot"], { days: 30 }],
    ["garlic", ["garlic clove", "clove of garlic", "garlic bulb", "head of garlic", "cloves garlic"], { days: 30 }],
    ["ginger", ["fresh ginger", "ginger root", "knob of ginger"], { days: 21 }],
    ["galangal"],
    ["fresh turmeric", ["turmeric root"]],
    ["potato", ["russet potato", "yukon gold potato", "yukon gold", "gold potato", "red potato", "baby potato", "new potato", "fingerling potato"], { days: 21 }],
    ["sweet potato", ["yam", "garnet yam"], { days: 21 }],
    ["carrot", ["baby carrot"], { days: 21 }],
    ["parsnip", [], { days: 21 }],
    ["beet", ["beetroot"], { days: 14 }],
    ["radish", ["daikon", "daikon radish", "red radish"], { days: 10 }],
    ["turnip", [], { days: 14 }],
    ["celery root", ["celeriac"], { days: 14 }],
    ["butternut squash", ["winter squash"], { days: 30 }],
    ["kabocha squash", ["kabocha"], { days: 30 }],
    ["acorn squash", [], { days: 30 }],
    ["spaghetti squash", [], { days: 30 }],
    ["pumpkin", [], { days: 30 }],
    ["cabbage", ["green cabbage", "white cabbage", "savoy cabbage"], { days: 14 }],
    ["red cabbage", ["purple cabbage"], { days: 14 }],
    ["apple", ["granny smith apple", "honeycrisp apple", "green apple"], { days: 21 }],
    ["orange", ["navel orange", "blood orange", "mandarin", "clementine"], { days: 14 }],
    ["grapefruit", [], { days: 14 }],
  ]),

  // ---------- Meat & seafood: 1–2 days (or freeze) ----------
  ...section("meat_seafood", "days", [
    ["chicken breast", ["boneless skinless chicken breast", "boneless chicken breast", "chicken breast fillet", "chicken cutlet"], { days: 2 }],
    ["chicken thigh", ["boneless skinless chicken thigh", "boneless chicken thigh", "bone-in chicken thigh", "skin-on chicken thigh", "chicken thigh fillet"], { days: 2 }],
    ["chicken drumstick", ["chicken leg"], { days: 2 }],
    ["chicken wing", ["chicken wingette"], { days: 2 }],
    ["whole chicken", [], { days: 2 }],
    ["ground chicken", ["chicken mince", "minced chicken"], { days: 2 }],
    ["ground turkey", ["turkey mince", "minced turkey"], { days: 2 }],
    ["ground beef", ["beef mince", "minced beef", "lean ground beef", "hamburger meat"], { days: 2 }],
    ["ground pork", ["pork mince", "minced pork"], { days: 2 }],
    ["steak", ["ribeye", "ribeye steak", "sirloin", "sirloin steak", "flank steak", "skirt steak", "new york strip", "strip steak", "beef steak", "flat iron steak"], { days: 3 }],
    ["beef chuck", ["chuck roast", "stew beef", "beef stew meat"], { days: 3 }],
    ["short rib", ["beef short rib"], { days: 3 }],
    ["pork chop", ["bone-in pork chop", "boneless pork chop"], { days: 3 }],
    ["pork tenderloin", [], { days: 3 }],
    ["pork shoulder", ["pork butt", "boston butt"], { days: 3 }],
    ["pork belly", [], { days: 3 }],
    ["lamb", ["lamb chop", "lamb shoulder", "ground lamb", "lamb mince"], { days: 3 }],
    ["salmon", ["salmon fillet", "salmon filet"], { days: 2 }],
    ["shrimp", ["prawn", "jumbo shrimp", "raw shrimp", "peeled shrimp"], { days: 2 }],
    ["white fish", ["cod", "cod fillet", "halibut", "tilapia", "sea bass", "haddock", "snapper"], { days: 2 }],
    ["tuna steak", ["ahi tuna", "sushi grade tuna"], { days: 1 }],
    ["scallop", ["sea scallop"], { days: 2 }],
    ["mussel"],
    ["clam"],
    ["sausage", ["italian sausage", "pork sausage", "chicken sausage"], { days: 3 }],
  ]),
  // Cured meats keep longer
  ...section("meat_seafood", "week", [
    ["bacon", ["streaky bacon", "thick-cut bacon", "thick cut bacon"], { days: 7 }],
    ["pancetta", [], { days: 10 }],
    ["prosciutto", [], { days: 7 }],
    ["chorizo", ["spanish chorizo", "mexican chorizo"], { days: 10 }],
    ["ham", ["deli ham"], { days: 5 }],
    ["smoked salmon", ["lox"], { days: 7 }],
  ]),

  // ---------- Dairy & eggs ----------
  ...section("dairy_eggs", "week", [
    ["milk", ["whole milk", "2% milk", "skim milk"], { days: 7 }],
    ["heavy cream", ["heavy whipping cream", "whipping cream", "double cream", "cream"], { days: 10 }],
    ["half and half", ["half-and-half"], { days: 7 }],
    ["sour cream", [], { days: 10 }],
    ["greek yogurt", ["plain greek yogurt"], { days: 10 }],
    ["yogurt", ["plain yogurt", "natural yogurt"], { days: 10 }],
    ["buttermilk", [], { days: 10 }],
    ["ricotta", ["ricotta cheese"], { days: 5 }],
    ["fresh mozzarella", ["mozzarella ball", "buffalo mozzarella", "burrata", "bocconcini"], { days: 4 }],
    ["mascarpone", [], { days: 7 }],
    ["cottage cheese", [], { days: 7 }],
    ["cream cheese", [], { days: 14 }],
    ["feta", ["feta cheese", "crumbled feta"], { days: 10 }],
    ["goat cheese", ["chèvre", "chevre"], { days: 10 }],
    ["mozzarella", ["shredded mozzarella", "low-moisture mozzarella", "mozzarella cheese"], { days: 14 }],
    ["creme fraiche", ["crème fraîche"], { days: 10 }],
  ]),
  ...section("dairy_eggs", "weeks", [
    ["egg", ["large egg", "eggs", "whole egg"], { days: 28 }],
    ["egg yolk", ["yolk"], { days: 28 }],
    ["egg white", [], { days: 28 }],
    ["butter", ["unsalted butter", "salted butter"], { days: 60, staple: true }],
    ["parmesan", ["parmigiano reggiano", "parmigiano-reggiano", "parmesan cheese", "grated parmesan", "parm"], { days: 30 }],
    ["pecorino", ["pecorino romano"], { days: 30 }],
    ["cheddar", ["cheddar cheese", "sharp cheddar", "shredded cheddar"], { days: 21 }],
    ["gruyere", ["gruyère", "swiss cheese", "emmental"], { days: 21 }],
    ["monterey jack", ["pepper jack", "jack cheese"], { days: 21 }],
    ["halloumi", [], { days: 21 }],
    ["paneer", [], { days: 10 }],
  ]),

  // ---------- Bakery ----------
  ...section("bakery", "week", [
    ["bread", ["sourdough", "sourdough bread", "crusty bread", "baguette", "ciabatta", "loaf of bread", "country bread"], { days: 4 }],
    ["sandwich bread", ["white bread", "whole wheat bread", "sliced bread"], { days: 7 }],
    ["tortilla", ["flour tortilla", "corn tortilla", "wrap"], { days: 10 }],
    ["pita", ["pita bread"], { days: 5 }],
    ["naan", ["naan bread"], { days: 5 }],
    ["bun", ["burger bun", "hamburger bun", "brioche bun", "hot dog bun", "slider bun"], { days: 5 }],
  ]),

  // ---------- Pantry (long-lived) ----------
  ...section("pantry", "pantry", [
    ["salt", ["kosher salt", "sea salt", "flaky salt", "flaky sea salt", "table salt", "maldon salt"], { staple: true, category: "spices" }],
    ["black pepper", ["pepper", "ground black pepper", "freshly ground black pepper", "cracked black pepper", "black peppercorn"], { staple: true, category: "spices" }],
    ["olive oil", ["extra virgin olive oil", "evoo", "extra-virgin olive oil"], { staple: true }],
    ["neutral oil", ["vegetable oil", "canola oil", "avocado oil", "sunflower oil", "grapeseed oil", "cooking oil", "oil", "peanut oil"], { staple: true }],
    ["sesame oil", ["toasted sesame oil"]],
    ["water", ["warm water", "cold water", "hot water", "ice water", "boiling water"], { staple: true, category: "other" }],
    ["sugar", ["granulated sugar", "white sugar", "caster sugar"], { staple: true }],
    ["brown sugar", ["light brown sugar", "dark brown sugar"]],
    ["powdered sugar", ["icing sugar", "confectioners sugar", "confectioners' sugar"]],
    ["honey"],
    ["maple syrup", ["pure maple syrup"]],
    ["all-purpose flour", ["flour", "plain flour", "ap flour"]],
    ["bread flour"],
    ["cornstarch", ["corn starch", "cornflour"]],
    ["baking powder"],
    ["baking soda", ["bicarbonate of soda", "bicarb"]],
    ["yeast", ["active dry yeast", "instant yeast"]],
    ["vanilla extract", ["vanilla", "pure vanilla extract"]],
    ["panko", ["panko breadcrumbs", "panko bread crumbs"]],
    ["breadcrumbs", ["bread crumbs", "dried breadcrumbs"]],
    ["spaghetti", ["linguine", "fettuccine", "bucatini", "angel hair", "capellini", "tagliatelle"]],
    ["short pasta", ["pasta", "penne", "rigatoni", "fusilli", "farfalle", "orecchiette", "ziti", "macaroni", "elbow macaroni", "shells", "cavatappi", "paccheri", "mezze rigatoni"]],
    ["orzo"],
    ["lasagna noodle", ["lasagna sheet", "lasagne sheet"]],
    ["ramen noodle", ["instant ramen", "ramen"]],
    ["rice noodle", ["rice vermicelli", "vermicelli", "pad thai noodle", "flat rice noodle"]],
    ["udon", ["udon noodle"]],
    ["soba", ["soba noodle"]],
    ["egg noodle", ["lo mein noodle"]],
    ["white rice", ["rice", "long grain rice", "jasmine rice", "basmati rice", "cooked rice", "day-old rice"]],
    ["sushi rice", ["short grain rice", "calrose rice"]],
    ["arborio rice", ["risotto rice"]],
    ["brown rice"],
    ["quinoa"],
    ["couscous", ["pearl couscous", "israeli couscous"]],
    ["rolled oats", ["oats", "old fashioned oats", "oatmeal"]],
    ["canned tomato", ["crushed tomato", "diced tomato", "canned diced tomato", "whole peeled tomato", "san marzano tomato", "canned crushed tomato", "tinned tomato", "passata", "tomato puree"]],
    ["tomato paste", ["tomato concentrate"]],
    ["tomato sauce", ["marinara", "marinara sauce", "pasta sauce"]],
    ["coconut milk", ["full-fat coconut milk", "canned coconut milk", "coconut cream"]],
    ["chicken broth", ["chicken stock", "chicken bouillon", "bouillon", "stock", "broth"]],
    ["beef broth", ["beef stock"]],
    ["vegetable broth", ["vegetable stock", "veggie broth", "veggie stock"]],
    ["chickpea", ["garbanzo bean", "canned chickpea"]],
    ["black bean", ["canned black bean"]],
    ["kidney bean"],
    ["white bean", ["cannellini bean", "butter bean", "great northern bean", "navy bean"]],
    ["lentil", ["red lentil", "green lentil", "brown lentil", "french lentil"]],
    ["peanut butter", ["creamy peanut butter"]],
    ["tahini", ["sesame paste"]],
    ["soy sauce", ["light soy sauce", "low sodium soy sauce", "low-sodium soy sauce", "shoyu", "tamari"]],
    ["dark soy sauce"],
    ["fish sauce"],
    ["oyster sauce"],
    ["hoisin sauce", ["hoisin"]],
    ["rice vinegar", ["rice wine vinegar", "seasoned rice vinegar"]],
    ["balsamic vinegar", ["balsamic"]],
    ["red wine vinegar"],
    ["white wine vinegar"],
    ["apple cider vinegar", ["cider vinegar", "acv"]],
    ["white vinegar", ["distilled vinegar", "vinegar"]],
    ["mirin"],
    ["shaoxing wine", ["chinese cooking wine", "shaoxing"]],
    ["sake", ["cooking sake"]],
    ["white wine", ["dry white wine"]],
    ["red wine", ["dry red wine"]],
    ["gochujang", ["korean chili paste"]],
    ["gochugaru", ["korean chili flake", "korean red pepper flake"]],
    ["chili crisp", ["chili oil", "chilli oil", "lao gan ma", "chili crunch"]],
    ["sriracha"],
    ["hot sauce", ["tabasco", "frank's red hot"]],
    ["miso", ["white miso", "miso paste", "red miso"], { days: 180 }],
    ["dijon mustard", ["dijon", "mustard", "whole grain mustard", "wholegrain mustard"]],
    ["mayonnaise", ["mayo", "kewpie mayo", "kewpie mayonnaise", "japanese mayo"]],
    ["ketchup"],
    ["worcestershire sauce", ["worcestershire"]],
    ["capers", ["caper"]],
    ["olive", ["kalamata olive", "green olive", "black olive", "castelvetrano olive"]],
    ["anchovy", ["anchovy fillet", "anchovies"]],
    ["sun-dried tomato", ["sundried tomato"]],
    ["roasted red pepper", ["jarred roasted red pepper"]],
    ["pesto", ["basil pesto"]],
    ["curry paste", ["red curry paste", "green curry paste", "yellow curry paste"]],
    ["harissa"],
    ["chipotle in adobo", ["chipotle pepper in adobo", "chipotles in adobo", "adobo sauce"]],
    ["canned tuna", ["tuna", "tinned tuna"]],
    ["nori", ["seaweed", "seaweed sheet"]],
    ["dried shiitake", ["dried shiitake mushroom", "dried mushroom", "dried porcini", "porcini"]],
    ["sesame seed", ["toasted sesame seed", "white sesame seed", "black sesame seed"]],
    ["pine nut"],
    ["walnut"],
    ["almond", ["sliced almond", "slivered almond"]],
    ["cashew"],
    ["peanut", ["roasted peanut"]],
    ["pistachio"],
    ["raisin"],
    ["chocolate chip", ["semi-sweet chocolate chip", "dark chocolate"]],
    ["cocoa powder", ["unsweetened cocoa powder"]],
    ["rice paper", ["rice paper wrapper", "spring roll wrapper"]],
    ["dumpling wrapper", ["wonton wrapper", "gyoza wrapper"], { days: 14, category: "other" }],
    ["tortilla chip", ["tortilla chips"]],
  ]),
  // Dried spices
  ...section("spices", "pantry", [
    ["garlic powder", ["granulated garlic"]],
    ["onion powder"],
    ["paprika", ["sweet paprika"]],
    ["smoked paprika", ["pimenton"]],
    ["chili powder"],
    ["cayenne", ["cayenne pepper"]],
    ["red pepper flake", ["red pepper flakes", "crushed red pepper", "chili flake", "chili flakes", "chilli flakes"]],
    ["cumin", ["ground cumin", "cumin seed"]],
    ["coriander", ["ground coriander", "coriander seed"]],
    ["turmeric", ["ground turmeric"]],
    ["curry powder"],
    ["garam masala"],
    ["cinnamon", ["ground cinnamon", "cinnamon stick"]],
    ["nutmeg", ["ground nutmeg"]],
    ["ground ginger", ["ginger powder"]],
    ["dried oregano"],
    ["dried thyme"],
    ["dried basil"],
    ["italian seasoning", ["dried italian herbs", "herbes de provence"]],
    ["dried bay leaf"],
    ["five spice", ["chinese five spice", "five-spice powder"]],
    ["star anise"],
    ["sichuan peppercorn", ["szechuan peppercorn"]],
    ["msg", ["monosodium glutamate"]],
    ["everything bagel seasoning"],
    ["taco seasoning"],
    ["cajun seasoning", ["creole seasoning"]],
    ["sumac"],
    ["za'atar", ["zaatar"]],
  ]),
  // Frozen
  ...section("frozen", "pantry", [
    ["frozen peas", ["peas", "green peas", "frozen pea"]],
    ["frozen corn", ["corn kernel", "corn kernels", "corn"]],
    ["frozen edamame", ["edamame", "shelled edamame"]],
    ["frozen spinach"],
    ["frozen dumpling", ["frozen dumplings", "potsticker", "gyoza"]],
    ["puff pastry"],
  ]),
];

export const CATALOG_BY_NAME = new Map(CATALOG.map((i) => [i.name, i]));
