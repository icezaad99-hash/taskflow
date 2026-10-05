const phaseItems = [
  "Next.js 16 app scaffold with Tailwind CSS",
  "Supabase client setup and environment template",
  "TaskFlow database schema with roles, tasks, comments, attachments, and notifications",
  "Dark/Light theme foundation for the product UI",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-20">
      <div className="w-full rounded-3xl border border-border bg-card/80 p-8 shadow-[0_20px_80px_rgba(37,99,235,0.08)] backdrop-blur-sm md:p-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            TaskFlow
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Phase 3 complete
          </span>
        </div>

        <div className="grid gap-8 md:grid-cols-[1.3fr_0.7fr]">
          <section>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
              Project foundation
            </p>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Base app and database structure are ready.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              The workspace now includes the Next.js foundation, Tailwind styling, dark/light theme support,
              and a Supabase-ready schema for the team task management system.
            </p>

            <div className="mt-8 space-y-3">
              {phaseItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-3"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    ✓
                  </span>
                  <span className="text-sm text-foreground/90">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-background/70 p-5">
            <h2 className="text-lg font-semibold">Next step</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>1. Create a Supabase project.</li>
              <li>2. Add your keys into .env.local.</li>
              <li>3. Run the SQL schema in the Supabase SQL editor.</li>
              <li>4. Continue to phase 4: auth and role system.</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
