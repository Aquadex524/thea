import Link from "next/link";

export default function Header({ active }: { active: "add" | "library" | "week" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${on ? "bg-card text-ink shadow-sm" : "text-muted"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-6 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
      <div className="flex-1">
        <h1 className="text-xl font-bold tracking-tight">Thea</h1>
        <p className="hidden text-xs text-muted sm:block">Recipe videos in, groceries out</p>
      </div>
      <nav className="flex gap-1 rounded-full border border-line bg-bg p-1">
        {tab("/", "Add", active === "add")}
        {tab("/library", "Library", active === "library")}
        {tab("/week", "Week", active === "week")}
      </nav>
    </header>
  );
}
