"use client"

// ============================================================
// AUTOMATION RULES (Fresha-inspired 2026-11-15)
// Automate repetitive tasks like Fresha's "Automations" feature.
// Birthday emails, follow-ups, reminders, reactivation.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClockIcon,
  EnvelopeIcon,
  StarIcon,
  CheckCircleIcon,
} from "@/components/icons"
import {
  Lightning as ZapIcon,
  Gift as GiftIcon,
  Repeat as RepeatIcon,
} from "@phosphor-icons/react/dist/ssr"

interface AutomationRule {
  id: string
  name: string
  trigger: string
  action: string
  enabled: boolean
  lastTriggered?: string | null
  triggerCount: number
}

interface AutomationRulesProps {
  initialRules?: AutomationRule[]
}

const triggerOptions = [
  { value: "booking_created", label: "Nova rezervacija" },
  { value: "booking_completed", label: "Zaključen termin" },
  { value: "booking_cancelled", label: "Preklicana rezervacija" },
  { value: "birthday", label: "Rojstni dan stranke" },
  { value: "inactivity_30d", label: "30 dni neaktivnosti" },
  { value: "inactivity_60d", label: "60 dni neaktivnosti" },
  { value: "inactivity_90d", label: "90 dni neaktivnosti" },
  { value: "first_visit", label: "Prvi obisk" },
  { value: "milestone_visit", label: "Mejnik (10. obisk)" },
]

const actionOptions = [
  { value: "send_email", label: "Pošlji e-pošto" },
  { value: "send_sms", label: "Pošlji SMS" },
  { value: "add_tag", label: "Dodaj oznako" },
  { value: "create_task", label: "Ustvari nalogo" },
  { value: "apply_discount", label: "Dodaj popust" },
]

const defaultRules: AutomationRule[] = [
  {
    id: "welcome",
    name: "Dobrodošlica novi stranki",
    trigger: "first_visit",
    action: "send_email",
    enabled: true,
    triggerCount: 24,
    lastTriggered: "2026-11-14",
  },
  {
    id: "birthday",
    name: "Čestitka ob rojstnem dnevu",
    trigger: "birthday",
    action: "send_email",
    enabled: true,
    triggerCount: 12,
    lastTriggered: "2026-11-10",
  },
  {
    id: "followup",
    name: "Sledenje po terminu",
    trigger: "booking_completed",
    action: "send_email",
    enabled: true,
    triggerCount: 89,
    lastTriggered: "2026-11-15",
  },
  {
    id: "reactivation",
    name: "Reaktivacija po 60 dneh",
    trigger: "inactivity_60d",
    action: "send_email",
    enabled: false,
    triggerCount: 0,
    lastTriggered: null,
  },
  {
    id: "loyalty",
    name: "Nagrada za zvestobo (10. obisk)",
    trigger: "milestone_visit",
    action: "apply_discount",
    enabled: true,
    triggerCount: 8,
    lastTriggered: "2026-11-08",
  },
]

function getTriggerLabel(trigger: string): string {
  return triggerOptions.find((t) => t.value === trigger)?.label || trigger
}

function getActionLabel(action: string): string {
  return actionOptions.find((a) => a.value === action)?.label || action
}

function getTriggerIcon(trigger: string) {
  switch (trigger) {
    case "birthday":
      return <GiftIcon size={16} className="text-pink-500" />
    case "first_visit":
      return <StarIcon size={16} className="text-blue-500" />
    case "booking_completed":
      return <CheckCircleIcon size={16} className="text-green-500" />
    case "inactivity_30d":
    case "inactivity_60d":
    case "inactivity_90d":
      return <ClockIcon size={16} className="text-amber-500" />
    default:
      return <ZapIcon size={16} className="text-purple-500" />
  }
}

export function AutomationRules({ initialRules = defaultRules }: AutomationRulesProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules)

  const handleToggle = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ZapIcon size={20} />
              Avtomatizacije
            </CardTitle>
            <CardDescription>
              Samodejna opravila, ki prihranijo čas in izboljšajo izkušnjo strank.
            </CardDescription>
          </div>
          <Button>
            <ZapIcon size={16} className="mr-2" />
            Novo pravilo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center justify-between rounded-lg border p-4 ${
                rule.enabled ? "bg-green-50 border-green-200" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  {getTriggerIcon(rule.trigger)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    {!rule.enabled && <Badge variant="secondary">Izklopljeno</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getTriggerIcon(rule.trigger)}
                      {getTriggerLabel(rule.trigger)}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-1">
                      <EnvelopeIcon size={14} />
                      {getActionLabel(rule.action)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RepeatIcon size={12} />
                      {rule.triggerCount} sprožitev
                    </span>
                    {rule.lastTriggered && (
                      <span>Zadnjič: {rule.lastTriggered}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => handleToggle(rule.id)}
                />
                <Button variant="outline" size="sm">
                  Uredi
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Automation Tips */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <ZapIcon size={20} className="mt-0.5 text-blue-500" />
            <div>
              <p className="font-medium text-blue-800">Nasvet za avtomatizacije</p>
              <ul className="mt-2 space-y-1 text-sm text-blue-700">
                <li>• Vklopite &quot;Sledenje po terminu&quot; za povečanje ponovnih obiskov</li>
                <li>• &quot;Čestitka ob rojstnem dnevu&quot; gradi zvestobo strank</li>
                <li>• &quot;Reaktivacija&quot; pomaga pri pridobivanju izgubljenih strank</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
