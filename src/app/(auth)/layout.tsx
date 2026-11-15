import { PublicI18nProvider } from "@/components/providers/public-i18n-provider"

export const dynamic = "force-dynamic"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-sans-headings">
      {/* T9: javna podmnožica slovarjev (auth+common+public) — admin slovarji
          ostanejo izven client bundleja. Locale bere wrapper iz cookieja. */}
      <PublicI18nProvider>
        {children}
      </PublicI18nProvider>
    </div>
  )
}
