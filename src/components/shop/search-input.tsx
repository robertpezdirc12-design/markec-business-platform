"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "@/components/icons"
import { useSearchParams, useRouter } from "next/navigation"
import { useOrgPrefix } from "@/lib/org-path-hooks"
import { pick, useLocale } from "@/lib/i18n/client-locale"

interface SearchInputProps {
  placeholder?: string
  className?: string
}

export function SearchInput({
  placeholder,
  className = "",
}: SearchInputProps) {
  const locale = useLocale()
  const resolvedPlaceholder =
    placeholder ?? pick(locale, "Iskanje izdelkov …", "Search products …")
  const searchParams = useSearchParams()
  const router = useRouter()
  const prefix = useOrgPrefix()
  const query = searchParams.get("search") || ""

  const [inputValue, setInputValue] = useState(query)

  // Ko se URL spremeni od zunaj (npr. gumb »Vsi izdelki«), polje sledi URL-ju.
  // Uradni vzorec »prilagodi stanje ob spremembi propa« namesto efekta — brez
  // vmesnega izrisa s staro vrednostjo.
  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    setInputValue(query)
  }

  // Debounced URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== query) {
        if (inputValue.trim()) {
          router.push(`${prefix}/shop?search=${encodeURIComponent(inputValue.trim())}`)
        } else {
          router.push(`${prefix}/shop`)
        }
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue, query, router, prefix])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  return (
    <div className={`relative ${className}`}>
      <SearchIcon
        size={16}
        weight="regular"
        className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
      />
      <Input
        onChange={handleInputChange}
        value={inputValue}
        placeholder={resolvedPlaceholder}
        className="pl-9"
      />
    </div>
  )
}
