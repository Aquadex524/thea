"use client";

import { useState } from "react";
import { saveToken } from "./token";

/** Shown when the server says the access code is missing or wrong. */
export default function AccessCode({ onSaved }: { onSaved: () => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveToken(code.trim());
        onSaved();
      }}
      className="space-y-2 rounded-2xl border border-line bg-card p-4"
    >
      <p className="text-sm text-muted">Enter your Thea access code to see your library.</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[15px] outline-none"
        />
        <button className="rounded-xl bg-navy px-4 font-semibold text-white dark:text-[#0b1218]">Save</button>
      </div>
    </form>
  );
}
