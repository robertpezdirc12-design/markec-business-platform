import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PlusIcon,
  PencilIcon,
  CalendarIcon,
  ArrowLeftIcon,
  UsersIcon,
  ClockIcon,
  TrendingUpIcon,
} from "@/components/icons"
import { getAdminStaffMembers, getAdminStaffStats } from "@/app/actions/staff"
import { getServerI18n } from "@/lib/i18n/server"
import { StaffSearch } from "@/components/dashboard/staff-search"
import { DeleteStaffButton } from "@/components/dashboard/delete-staff-button"
import { requirePagePermission } from "@/lib/auth/guards"
import { TeamSchedule } from "@/components/dashboard/team-schedule"
import { StaffPerformanceDashboard } from "@/components/dashboard/staff-performance-dashboard"

interface StaffPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  // Custom roles (G8): server-side page guard
  await requirePagePermission("staff.manage")
  const { search } = await searchParams
  const [{ t }, staffMembers, stats] = await Promise.all([
    getServerI18n(),
    getAdminStaffMembers(search),
    getAdminStaffStats(),
  ])
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.staff.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.staff.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {t.staff.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 2D-11: varni povratek v WYSIWYG urejevalnik. */}
          <Link href="/dashboard/settings?tab=website">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon size={16} className="mr-1" /> Urejevalnik
            </Button>
          </Link>
          <Link href="/dashboard/staff/new">
            <Button>
              <PlusIcon size={16} className="mr-2" />
              {t.staff.addStaffMember}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.staff.stats.totalStaff}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalStaff}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.staff.stats.active}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.activeStaff}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.staff.stats.inactive}</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{stats.inactiveStaff}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <StaffSearch />

      {/* Tabs: List / Schedule / Performance */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">
            <UsersIcon size={16} className="mr-2" />
            Seznam
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <ClockIcon size={16} className="mr-2" />
            Urnik
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUpIcon size={16} className="mr-2" />
            Uspešnost
          </TabsTrigger>
        </TabsList>

        {/* Staff List */}
        <TabsContent value="list">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {staffMembers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">{t.staff.noStaff}</p>
            <Link href="/dashboard/staff/new" className="mt-4 inline-block">
              <Button>
                <PlusIcon size={16} className="mr-2" />
                {t.staff.addFirstStaffMember}
              </Button>
            </Link>
          </div>
        ) : (
          staffMembers.map((member) => (
            <Card key={member.id} className={!member.isActive ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  {member.image ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-full">
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        className="object-cover"
                      
              sizes="40px"/>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary-text">
                      {member.name.split(" ").map(n => n[0]).join("")}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{member.name}</CardTitle>
                      {!member.isActive && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {t.staff.inactiveBadge}
                        </span>
                      )}
                    </div>
                    <CardDescription>
                      {member.bio ? member.bio.substring(0, 50) + (member.bio.length > 50 ? "..." : "") : t.staff.noBio}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">{member.email || t.staff.noEmail}</p>
                  <p className="text-muted-foreground">{member.phone || t.staff.noPhone}</p>
                </div>

                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-2xl font-bold">{member._count.services}</p>
                    <p className="text-muted-foreground">{t.staff.servicesCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{member._count.appointments}</p>
                    <p className="text-muted-foreground">{t.staff.appointmentsCount}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/dashboard/staff/${member.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <PencilIcon size={14} className="mr-1" />
                      {t.common.actions.edit}
                    </Button>
                  </Link>
                  <Link href={`/dashboard/staff/${member.id}/schedule`}>
                    <Button variant="outline" size="sm">
                      <CalendarIcon size={14} className="mr-1" />
                      {t.staff.schedule}
                    </Button>
                  </Link>
                  <DeleteStaffButton
                    staffId={member.id}
                    staffName={member.name}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        </div>
        </TabsContent>

        {/* Team Schedule */}
        <TabsContent value="schedule">
          <TeamSchedule schedule={staffMembers.map((staff) => ({
            id: staff.id,
            name: staff.name,
            role: "Član ekipe",
            shifts: {
              monday: { isWorking: true, start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" },
              tuesday: { isWorking: true, start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" },
              wednesday: { isWorking: true, start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" },
              thursday: { isWorking: true, start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" },
              friday: { isWorking: true, start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" },
              saturday: { isWorking: true, start: "09:00", end: "14:00" },
              sunday: { isWorking: false },
            },
          }))} />
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <StaffPerformanceDashboard
            staff={staffMembers.map((staff) => ({
              id: staff.id,
              name: staff.name,
              role: "Član ekipe",
              metrics: {
                revenue: 0,
                appointments: 0,
                completedAppointments: 0,
                averageRating: 4.5,
                totalHours: 0,
                clientRetention: 85,
              },
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
