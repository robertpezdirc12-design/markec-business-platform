"use client"

// ============================================================
// QUICK BOOKING LINK (Fresha-inspired 2026-11-15)
// Generate shareable booking links for services.
// Perfect for social media, WhatsApp, Instagram bio.
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  
  CopyIcon,
  ShareNetworkIcon,
  WhatsappLogoIcon,
  InstagramLogoIcon,
  FacebookLogoIcon,
} from "@phosphor-icons/react/dist/ssr"

interface QuickBookingLinkProps {
  serviceName: string
  serviceSlug: string
  orgSlug: string
}

export function QuickBookingLink({
  serviceName,
  serviceSlug,
  orgSlug,
}: QuickBookingLinkProps) {
  const [copied, setCopied] = useState(false)

  // Generate booking URL: /s/{orgSlug}/booking?service={serviceSlug}
  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${orgSlug}/booking?service=${serviceSlug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      toast.success("Povezava kopirana!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Kopiranje ni uspelo")
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rezerviraj: ${serviceName}`,
          text: `Rezervirajte termin za ${serviceName}`,
          url: bookingUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`Rezervirajte termin za ${serviceName}: ${bookingUrl}`)
    window.open(`https://wa.me/?text=${text}`, "_blank")
  }

  const shareToFacebook = () => {
    const url = encodeURIComponent(bookingUrl)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank")
  }

  const shareToInstagram = () => {
    // Instagram doesn't support direct URL sharing, so copy to clipboard
    handleCopy()
    toast.info("Povezava kopirana — prilepite v Instagram bio ali zgodbo")
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShareNetworkIcon size={16} className="mr-2" />
          Deli rezervacijo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Booking Link</DialogTitle>
          <DialogDescription>
            Delite povezavo za rezervacijo na družabnih omrežjih ali prek sporočil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking URL */}
          <div>
            <Label>Povezava za rezervacijo</Label>
            <div className="flex gap-2">
              <Input
                value={bookingUrl}
                readOnly
                className="flex-1"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Kopiraj povezavo"
              >
                <CopyIcon size={16} />
              </Button>
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <Label>Delite na</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={shareToWhatsApp}
                className="flex flex-col items-center gap-2 py-4"
              >
                <WhatsappLogoIcon size={24} className="text-green-600" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                onClick={shareToFacebook}
                className="flex flex-col items-center gap-2 py-4"
              >
                <FacebookLogoIcon size={24} className="text-blue-600" />
                <span className="text-xs">Facebook</span>
              </Button>
              <Button
                variant="outline"
                onClick={shareToInstagram}
                className="flex flex-col items-center gap-2 py-4"
              >
                <InstagramLogoIcon size={24} className="text-pink-600" />
                <span className="text-xs">Instagram</span>
              </Button>
            </div>
          </div>

          {/* Native share */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button onClick={handleShare} className="w-full">
              <ShareNetworkIcon size={16} className="mr-2" />
              Deli prek naprave
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
