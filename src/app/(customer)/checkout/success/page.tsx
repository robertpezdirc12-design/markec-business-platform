"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckCircleIcon, PackageIcon, HouseIcon } from "@/components/icons"
import { useCartStore } from "@/store/cart-store"
import { useLocale, pick } from "@/lib/i18n/client-locale"

export default function CheckoutSuccessPage() {
  const locale = useLocale()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const rawType = searchParams.get("type")
  // Frontend whitelist — never echo an arbitrary `type` value into the UI
  // (reflected-content / phishing risk).
  const type = rawType === "products" ? rawType : "subscription"
  const orgSlug = searchParams.get("org")
  const orgPrefix = orgSlug ? `/s/${orgSlug}` : ""
  const { clearCart } = useCartStore()

  useEffect(() => {
    // Clear cart if this was a product purchase
    if (type === "products") {
      clearCart()
    }
  }, [type, clearCart])

  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card className="text-center">
        <CardHeader>
          <div className="bg-success/15 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircleIcon
              size={32}
              weight="fill"
              className="text-success-text"
            />
          </div>
          <CardTitle className="text-2xl"
                        role="status"
                        aria-live="polite"
                      >
                        {pick(locale, "Plačilo uspešno!", "Payment successful!")}
                      </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {pick(
              locale,
              "Hvala za vaše naročilo. Vaše plačilo je bilo uspešno obdelano.",
              "Thank you for your order. Your payment was processed successfully."
            )}
          </p>
          {sessionId && (
            <p className="text-muted-foreground mt-2 font-mono text-xs">
              {pick(locale, "Referenca", "Reference")}: {sessionId.slice(0, 20)}...
            </p>
          )}

          <div className="space-y-3 pt-4 text-left">
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <PackageIcon className="text-primary h-5 w-5" />
              <div>
                <h3 className="font-semibold">
                  {pick(locale, "Potrditev po e-pošti", "Email confirmation")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {pick(
                    locale,
                    "Prejeli boste e-pošto s podrobnostmi naročila",
                    "You'll receive an email with your order details"
                  )}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <PackageIcon className="text-primary h-5 w-5" />
              <div>
                <h3 className="font-semibold">
                  {pick(locale, "Dostava", "Delivery")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {type === "products"
                    ? pick(
                        locale,
                        "Vaše naročilo bo obdelano v 1-2 delovnih dneh",
                        "Your order will be processed within 1-2 business days"
                      )
                    : pick(
                        locale,
                        "Vaša naročnina je aktivna",
                        "Your subscription is active"
                      )}
                </p>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground pt-4 text-sm">
            <p>
              {pick(locale, "Imate vprašanja?", "Have questions?")}{" "}
              <Link
                href={`${orgPrefix || ""}/#contact`}
                className="text-primary-text hover:underline"
              >
                {pick(locale, "Kontaktirajte nas", "Contact us")}
              </Link>
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          <Button asChild variant="outline">
            {/* The order list lives in the authenticated (customer) segment, not
                on the public shop — respect the org prefix. */}
            <Link href={`${orgPrefix || ""}/my-orders`}>
              <PackageIcon className="mr-2 h-4 w-4" />
              {pick(locale, "Ogled naročil", "View orders")}
            </Link>
          </Button>
          <Button asChild>
            {/* Go back to the tenant's home, not the platform root on bare routes */}
            <Link href={orgPrefix || "/"}>
              <HouseIcon className="mr-2 h-4 w-4" />
              {pick(locale, "Nazaj domov", "Back home")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
