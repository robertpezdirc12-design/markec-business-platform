"use client"

// ============================================================
// PAY RUNS (Fresha-inspired 2026-11-15)
// Payroll management: calculate and track staff payments.
// Commissions, tips, bonuses, deductions.
// Like Fresha's "Pay runs" — monthly payroll processing.
// ============================================================

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  CurrencyDollarIcon,
  UsersIcon,
  CalendarIcon,
  
  DownloadIcon,
  TrendingUpIcon,
  
} from "@/components/icons"
import { format } from "date-fns"
import { sl } from "date-fns/locale"

interface StaffPayroll {
  staffId: string
  staffName: string
  role: string
  // Earnings
  baseSalary: number
  commission: number
  tips: number
  bonuses: number
  // Deductions
  tax: number
  insurance: number
  other: number
  // Totals
  grossPay: number
  netPay: number
  // Stats
  appointmentsCount: number
  hoursWorked: number
}

interface PayRun {
  id: string
  period: string // "2026-11"
  status: "draft" | "processing" | "completed" | "paid"
  totalGross: number
  totalNet: number
  staffCount: number
  createdAt: string
  paidAt?: string | null
}

interface PayRunsProps {
  initialPayrolls?: StaffPayroll[]
  initialPayRuns?: PayRun[]
}

// Sample data for demonstration
const samplePayrolls: StaffPayroll[] = [
  {
    staffId: "1",
    staffName: "Ana Novak",
    role: "Frizerka",
    baseSalary: 1200,
    commission: 350,
    tips: 120,
    bonuses: 100,
    tax: 280,
    insurance: 180,
    other: 0,
    grossPay: 1770,
    netPay: 1310,
    appointmentsCount: 85,
    hoursWorked: 160,
  },
  {
    staffId: "2",
    staffName: "Maja Kovač",
    role: "Kozmetičarka",
    baseSalary: 1100,
    commission: 280,
    tips: 95,
    bonuses: 50,
    tax: 245,
    insurance: 165,
    other: 0,
    grossPay: 1525,
    netPay: 1115,
    appointmentsCount: 62,
    hoursWorked: 152,
  },
  {
    staffId: "3",
    staffName: "Sara Horvat",
    role: "Manikerka",
    baseSalary: 1000,
    commission: 220,
    tips: 80,
    bonuses: 0,
    tax: 215,
    insurance: 150,
    other: 0,
    grossPay: 1300,
    netPay: 935,
    appointmentsCount: 48,
    hoursWorked: 140,
  },
]

const samplePayRuns: PayRun[] = [
  {
    id: "pr-1",
    period: "2026-11",
    status: "draft",
    totalGross: 4595,
    totalNet: 3360,
    staffCount: 3,
    createdAt: "2026-11-15",
  },
  {
    id: "pr-2",
    period: "2026-10",
    status: "paid",
    totalGross: 4280,
    totalNet: 3125,
    staffCount: 3,
    createdAt: "2026-10-28",
    paidAt: "2026-10-31",
  },
  {
    id: "pr-3",
    period: "2026-09",
    status: "paid",
    totalGross: 4150,
    totalNet: 3030,
    staffCount: 3,
    createdAt: "2026-09-28",
    paidAt: "2026-09-30",
  },
]

const statusConfig = {
  draft: { label: "Osnutek", color: "bg-gray-500 text-white" },
  processing: { label: "Obdelava", color: "bg-blue-500 text-white" },
  completed: { label: "Končano", color: "bg-green-500 text-white" },
  paid: { label: "Izplačano", color: "bg-green-600 text-white" },
}

export function PayRuns({
  initialPayrolls = samplePayrolls,
  initialPayRuns = samplePayRuns,
}: PayRunsProps) {
  const [payrolls, setPayrolls] = useState<StaffPayroll[]>(initialPayrolls)
  const [payRuns, setPayRuns] = useState<PayRun[]>(initialPayRuns)
  const [selectedRun, setSelectedRun] = useState<PayRun | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [period, setPeriod] = useState("2026-11")

  const totalGross = useMemo(() =>
    payrolls.reduce((sum, p) => sum + p.grossPay, 0),
    [payrolls]
  )

  const totalNet = useMemo(() =>
    payrolls.reduce((sum, p) => sum + p.netPay, 0),
    [payrolls]
  )

  const totalCommission = useMemo(() =>
    payrolls.reduce((sum, p) => sum + p.commission, 0),
    [payrolls]
  )

  const totalTips = useMemo(() =>
    payrolls.reduce((sum, p) => sum + p.tips, 0),
    [payrolls]
  )

  const handleCreatePayRun = () => {
    const newRun: PayRun = {
      id: `pr-${Date.now()}`,
      period,
      status: "draft",
      totalGross,
      totalNet,
      staffCount: payrolls.length,
      createdAt: new Date().toISOString().split("T")[0],
    }

    setPayRuns((prev) => [newRun, ...prev])
    toast.success(`Obračun za ${period} ustvarjen`)
  }

  const handleProcessPayRun = (runId: string) => {
    setPayRuns((prev) =>
      prev.map((r) => (r.id === runId ? { ...r, status: "completed" as const } : r))
    )
    toast.success("Obračun končan")
  }

  const handleMarkPaid = (runId: string) => {
    setPayRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? { ...r, status: "paid" as const, paidAt: new Date().toISOString().split("T")[0] }
          : r
      )
    )
    toast.success("Izplačilo označeno")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Obračun plač</h2>
          <p className="text-muted-foreground">
            Upravljanje plač, provizij in izplačil zaposlenih.
          </p>
        </div>
        <Button onClick={handleCreatePayRun}>
          <CurrencyDollarIcon size={16} className="mr-2" />
          Nov obračun
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <CurrencyDollarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skupaj bruto</p>
                <p className="text-2xl font-bold">{totalGross.toLocaleString()} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500 p-3 text-white">
                <CurrencyDollarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skupaj neto</p>
                <p className="text-2xl font-bold">{totalNet.toLocaleString()} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <TrendingUpIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Provizije</p>
                <p className="text-2xl font-bold">{totalCommission.toLocaleString()} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-500 p-3 text-white">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Napitnine</p>
                <p className="text-2xl font-bold">{totalTips.toLocaleString()} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pay Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon size={20} />
            Zgodovina obračunov
          </CardTitle>
          <CardDescription>
            Pregled preteklih in trenutnih obračunov plač.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Obdobje</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Zaposlenih</th>
                  <th className="pb-3 font-medium">Bruto</th>
                  <th className="pb-3 font-medium">Neto</th>
                  <th className="pb-3 font-medium">Izplačano</th>
                  <th className="pb-3 font-medium">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {payRuns.map((run) => (
                  <tr key={run.id} className="border-b">
                    <td className="py-3">
                      <p className="font-medium">{run.period}</p>
                    </td>
                    <td className="py-3">
                      <Badge className={statusConfig[run.status].color}>
                        {statusConfig[run.status].label}
                      </Badge>
                    </td>
                    <td className="py-3">{run.staffCount}</td>
                    <td className="py-3 font-medium">{run.totalGross.toLocaleString()} €</td>
                    <td className="py-3 font-medium">{run.totalNet.toLocaleString()} €</td>
                    <td className="py-3 text-muted-foreground">
                      {run.paidAt || "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRun(run)
                            setShowDetails(true)
                          }}
                        >
                          Podrobnosti
                        </Button>
                        {run.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleProcessPayRun(run.id)}
                          >
                            Obdelaj
                          </Button>
                        )}
                        {run.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(run.id)}
                          >
                            Označi izplačano
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Current Period Payroll Detail */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon size={20} />
                Obračun za obdobje
              </CardTitle>
              <CardDescription>
                Podroben obračun po zaposlenih.
              </CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026-11">November 2026</SelectItem>
                <SelectItem value="2026-10">Oktober 2026</SelectItem>
                <SelectItem value="2026-09">September 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payrolls.map((payroll) => (
              <div key={payroll.staffId} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold">
                      {payroll.staffName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{payroll.staffName}</p>
                      <p className="text-sm text-muted-foreground">{payroll.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {payroll.netPay.toLocaleString()} €
                    </p>
                    <p className="text-sm text-muted-foreground">
                      bruto: {payroll.grossPay.toLocaleString()} €
                    </p>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Osnovna plača</p>
                    <p className="font-medium">{payroll.baseSalary.toLocaleString()} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Provizija</p>
                    <p className="font-medium text-blue-600">+{payroll.commission} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Napitnine</p>
                    <p className="font-medium text-green-600">+{payroll.tips} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bonus</p>
                    <p className="font-medium text-amber-600">+{payroll.bonuses} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Davki</p>
                    <p className="font-medium text-red-600">-{payroll.tax} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Zavarovanja</p>
                    <p className="font-medium text-red-600">-{payroll.insurance} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Terminov</p>
                    <p className="font-medium">{payroll.appointmentsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ur</p>
                    <p className="font-medium">{payroll.hoursWorked}h</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pay Run Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Podrobnosti obračuna</DialogTitle>
            <DialogDescription>
              Obdobje: {selectedRun?.period}
            </DialogDescription>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedRun.status].color}>
                    {statusConfig[selectedRun.status].label}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">Zaposlenih</p>
                  <p className="text-lg font-bold">{selectedRun.staffCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">Skupaj bruto</p>
                  <p className="text-lg font-bold">{selectedRun.totalGross.toLocaleString()} €</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">Skupaj neto</p>
                  <p className="text-lg font-bold text-green-600">{selectedRun.totalNet.toLocaleString()} €</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ustvarjeno: {selectedRun.createdAt}
                </p>
                {selectedRun.paidAt && (
                  <p className="text-sm text-muted-foreground">
                    Izplačano: {selectedRun.paidAt}
                  </p>
                )}
              </div>

              <Button variant="outline" className="w-full">
                <DownloadIcon size={16} className="mr-2" />
                Prenesi PDF poročilo
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}