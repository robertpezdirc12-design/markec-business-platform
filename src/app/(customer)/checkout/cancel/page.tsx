import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingCartIcon, StorefrontIcon } from "@/components/icons"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"
import { getLocaleFromCookies } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleFromCookies()
  const en = locale === "en"
  return {
    title: en ? "Checkout cancelled" : "Nakup preklican",
    description: en ? "Your checkout was cancelled." : "Vaš nakup je bil preklican.",
  }
}

export default async function CheckoutCancelPage() {
  const [org, locale] = await Promise.all([getPublicOrg(), getLocaleFromCookies()])
  const en = locale === "en"

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <ShoppingCartIcon
              className="text-muted-foreground h-8 w-8"
              weight="regular"
            />
          </div>
          <h1 className="mb-2 text-2xl font-bold">
            {en ? "Checkout cancelled" : "Nakup preklican"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {en
              ? "Your purchase was not completed. The items are still in your cart."
              : "Vaš nakup ni bil zaključen. Izdelki so še vedno v vaši košarici."}
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href={orgPath(org?.slug, "/cart")}>
                <ShoppingCartIcon className="mr-2 h-4 w-4" />
                {en ? "Back to cart" : "Nazaj v košarico"}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={orgPath(org?.slug, "/shop")}>
                <StorefrontIcon className="mr-2 h-4 w-4" />
                {en ? "Continue shopping" : "Nadaljuj z nakupovanjem"}
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-6 text-sm">
            {en ? "Have questions? " : "Imate vprašanja? "}
            <Link
              href={`${orgPath(org?.slug, "/")}#contact`}
              className="text-primary-text hover:underline"
            >
              {en ? "Contact us" : "Kontaktirajte nas"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
