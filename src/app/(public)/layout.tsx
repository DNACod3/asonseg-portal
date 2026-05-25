// Route group (public): conteúdo público com ISR.
// CLAUDE.md / ADR-0013: ISR ~10min + on-demand revalidation (revalidateTag/revalidatePath).
export const revalidate = 600;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
