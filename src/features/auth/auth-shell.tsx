import type { ReactNode } from "react";

export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-ms flex justify-center py-12 md:py-20">
      <div className="w-full max-w-md">
        <p className="eyebrow mb-3 text-center text-olive">MAISON SURGE</p>
        <h1 className="mb-3 text-center text-3xl md:text-4xl">{title}</h1>
        {intro ? <div className="mb-8 text-center text-sm leading-relaxed text-muted">{intro}</div> : <div className="mb-8" />}
        <div className="border border-line bg-paper p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
