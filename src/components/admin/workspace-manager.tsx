"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createWorkspace,
  updateWorkspace,
  archiveWorkspace,
  activateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  listInvitations,
  setDefaultWorkspace,
  type WorkspaceBasic,
  type WorkspaceMember,
} from "@/app/actions/workspace-management"
import { switchActiveOrganization } from "@/app/actions/organization-switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  PlusIcon,
  SpinnerIcon,
  StorefrontIcon,
  TrashIcon,
  PencilIcon,
  PackageIcon,
  UsersIcon,
  CheckCircleIcon,
  CopyIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"

interface ProfileOption {
  id: string
  label: string
}

const ROLE_LABEL: Record<string, string> = { ADMIN: "Skrbnik", STAFF: "Osebje" }
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktiven",
  SUSPENDED: "Arhiviran",
}
const INVITE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Čaka odziv",
  ACCEPTED: "Sprejeto",
  REJECTED: "Zavrnjeno",
  REVOKED: "Preklicano",
}

interface InvitationRow {
  email: string
  role: string
  status: string
  createdAt: Date
}

export function WorkspaceManager({
  workspaces,
  profiles,
}: {
  workspaces: WorkspaceBasic[]
  profiles: ProfileOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string | null>(null)

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [newVertical, setNewVertical] = useState<string>("beauty")

  async function run<T>(fn: () => Promise<T>) {
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Napaka.")
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    const slug =
      newSlug.trim() ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)
    const res = await createWorkspace({ name, slug, vertical: newVertical })
    if (!res.success) return toast.error(res.error ?? "Napaka.")
    toast.success("Poslovni prostor ustvarjen.")
    setCreateOpen(false)
    setNewName("")
    setNewSlug("")
    router.refresh()
  }

  async function handleEnter(orgId: string) {
    await run(async () => {
      const res = await switchActiveOrganization(orgId)
      if (!res.success) return toast.error(res.error ?? "Napaka.")
      router.push(res.organizationName ? "/dashboard" : "/dashboard")
      router.refresh()
    })
  }

  async function handleSetDefault(orgId: string) {
    await run(async () => {
      const res = await setDefaultWorkspace(orgId)
      if (!res.success) return toast.error(res.error ?? "Napaka.")
      toast.success("Privzeti poslovni prostor nastavljen.")
      router.refresh()
    })
  }

  async function handleArchive(orgId: string) {
    await run(async () => {
      const res = await archiveWorkspace(orgId)
      if (!res.success) return toast.error(res.error ?? "Napaka.")
      toast.success("Poslovni prostor arhiviran.")
      router.refresh()
    })
  }

  async function handleActivate(orgId: string) {
    await run(async () => {
      const res = await activateWorkspace(orgId)
      if (!res.success) return toast.error(res.error ?? "Napaka.")
      toast.success("Poslovni prostor aktiviran.")
      router.refresh()
    })
  }

  async function handleRename(orgId: string, name: string) {
    const res = await updateWorkspace({ organizationId: orgId, name })
    if (!res.success) return toast.error(res.error ?? "Napaka.")
    toast.success("Ime posodobljeno.")
    router.refresh()
  }

  async function handleDelete(orgId: string) {
    await run(async () => {
      const res = await deleteWorkspace({
        organizationId: orgId,
        confirm: true,
      })
      if (!res.success) return toast.error(res.error ?? "Napaka.")
      toast.success("Poslovni prostor izbrisan.")
      if (selected === orgId) setSelected(null)
      router.refresh()
    })
  }

  const selectedWs = workspaces.find((w) => w.id === selected) ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left — workspaces list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Poslovni prostori</CardTitle>
              <CardDescription>
                Vsak ima svojo dejavnost, člane in podatke.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default">
                  <PlusIcon size={16} className="mr-1" /> Novi
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nov poslovni prostor</DialogTitle>
                  <DialogDescription>
                    Ustvari novo podjetje/dejavnost pod tem računom.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Ime podjetja</Label>
                    <Input
                      id="ws-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="npr. Šiviljstvo Ana"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-slug">URL naslov</Label>
                    <Input
                      id="ws-slug"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="siviljstvo-ana"
                    />
                    <p className="text-muted-foreground text-xs">
                      Prazno → samodejno iz imena.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Dejavnost</Label>
                    <Select value={newVertical} onValueChange={setNewVertical}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Izberi dejavnost" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>
                      {isPending && (
                        <SpinnerIcon size={16} className="mr-2 animate-spin" />
                      )}
                      Ustvari poslovni prostor
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspaces.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Na računu ni poslovnih prostorov.
            </p>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.id}
                role="group"
                aria-label={ws.name}
                className={cn(
                  "hover:bg-muted/50 cursor-pointer rounded-lg border p-4 transition-colors",
                  selected === ws.id && "border-primary"
                )}
                onClick={() => setSelected(ws.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <StorefrontIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ws.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {ws.verticalLabel ?? "Poslovni prostor"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {ws.isDefault && <Badge variant="outline">Privzeti</Badge>}
                    {ws.status === "SUSPENDED" && (
                      <Badge variant="secondary">Arhiviran</Badge>
                    )}
                    <Badge variant="muted">
                      {ROLE_LABEL[ws.role] ?? ws.role}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Right — selected workspace detail */}
      {selectedWs ? (
        <WorkspaceDetail
          ws={selectedWs}
          isPending={isPending}
          onEnter={() => handleEnter(selectedWs.id)}
          onSetDefault={() => handleSetDefault(selectedWs.id)}
          onRename={(name) => handleRename(selectedWs.id, name)}
          onArchive={() => handleArchive(selectedWs.id)}
          onActivate={() => handleActivate(selectedWs.id)}
          onDelete={() => handleDelete(selectedWs.id)}
        />
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground flex h-full min-h-[300px] items-center justify-center p-10 text-center text-sm">
            Izberi poslovni prostor na levi, da vidiš člane, povabila in
            nastavitve.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function WorkspaceDetail({
  ws,
  isPending,
  onEnter,
  onSetDefault,
  onRename,
  onArchive,
  onActivate,
  onDelete,
}: {
  ws: WorkspaceBasic
  isPending: boolean
  onEnter: () => void
  onSetDefault: () => void
  onRename: (name: string) => void
  onArchive: () => void
  onActivate: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const isAdmin = ws.role === "ADMIN"
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF")
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(ws.name)
  const [delOpen, setDelOpen] = useState(false)
  const [delConfirm, setDelConfirm] = useState("")

  function refresh() {
    router.refresh()
    setMembers(null)
    setInvitations([])
  }

  async function loadDetail() {
    if (members === null) {
      const m = await listWorkspaceMembers(ws.id)
      if (!("error" in m)) setMembers(m)
      if (isAdmin) {
        const inv = await listInvitations(ws.id)
        if (!("error" in inv)) setInvitations(inv as InvitationRow[])
      }
    }
  }

  // Load on first open.
  const [loaded, setLoaded] = useState(false)
  if (!loaded) {
    setLoaded(true)
    ;(async () => loadDetail())()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const res = await inviteMember({
      organizationId: ws.id,
      email: inviteEmail,
      role: inviteRole,
    })
    if (!res.success) return toast.error(res.error ?? "Napaka.")
    // Token se prikaže SAMO ENČKAT ob ustvarjanju (F2.2.1) — zgradimo URL in
    // ga pokažemo v dialogu s kopiranjem. Seznam povabil tokena ne vrača.
    if (res.token) {
      setCreatedLink(`${window.location.origin}/invite/${res.token}`)
      setCopied(false)
      setInviteOpen(false)
    } else {
      toast.success("Povabilo ustvarjeno.")
      setInviteOpen(false)
    }
    setInviteEmail("")
    refresh()
  }

  async function copyLink() {
    if (!createdLink) return
    try {
      await navigator.clipboard.writeText(createdLink)
      setCopied(true)
      toast.success("Povabilna povezava je kopirana.")
    } catch {
      toast.error("Kopiranje ni uspelo — povezavo izberi ročno.")
    }
  }

  async function handleRoleChange(userId: string, role: "ADMIN" | "STAFF") {
    const res = await updateMemberRole({ organizationId: ws.id, userId, role })
    if (!res.success) return toast.error(res.error ?? "Napaka.")
    toast.success("Vloga posodobljena.")
    refresh()
  }

  async function handleRemove(userId: string, name: string) {
    if (!window.confirm(`Odstraniti ${name} iz poslovnega prostora?`)) return
    const res = await removeMember({ organizationId: ws.id, userId })
    if (!res.success) return toast.error(res.error ?? "Napaka.")
    toast.success("Član odstranjen.")
    refresh()
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = editName.trim()
    if (trimmed.length < 2) return toast.error("Ime mora imeti vsaj 2 znaka.")
    await onRename(trimmed)
    setEditOpen(false)
  }

  return (
    <Card onMouseEnter={() => loadDetail()}>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="truncate">{ws.name}</span>
            {isAdmin && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title="Preimenuj"
                  >
                    <PencilIcon size={14} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Preimenuj poslovni prostor</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRenameSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rename">Ime podjetja</Label>
                      <Input
                        id="rename"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Shrani</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
          <CardDescription>
            Status: {STATUS_LABEL[ws.status] ?? ws.status} · vloga:{" "}
            {ROLE_LABEL[ws.role] ?? ws.role}
          </CardDescription>
        </div>
        {ws.status !== "ACTIVE" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Arhiviran poslovni prostor — samo za branje.</strong> Nova
            povabila, urejanje in poslovne spremembe niso dovoljene. Za
            nadaljevanje aktivirajte prostor.
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={onEnter} disabled={isPending}>
            Odpri nadzorno ploščo
          </Button>
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onSetDefault}
                disabled={isPending || ws.isDefault}
              >
                <CheckCircleIcon size={16} className="mr-1" /> Nastavi privzeti
              </Button>
              {ws.status === "ACTIVE" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onArchive}
                  disabled={isPending}
                >
                  <PackageIcon size={16} className="mr-1" /> Arhiviraj
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onActivate}
                  disabled={isPending}
                >
                  Aktiviraj
                </Button>
              )}
              <Dialog
                open={delOpen}
                onOpenChange={(v) => {
                  setDelOpen(v)
                  if (!v) setDelConfirm("")
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={isPending}>
                    <TrashIcon size={16} className="mr-1" /> Izbriši
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-destructive">
                      Izbrisati poslovni prostor?
                    </DialogTitle>
                    <DialogDescription>
                      Ta ukrep je neobnovljiv. Poslovni prostor{" "}
                      <strong>{ws.name}</strong> in njegovo članstvo bosta
                      trajno izbrisana. Vpiši ime prostora za potrditev.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="del-confirm">
                      Vpiši ime: <strong>{ws.name}</strong>
                    </Label>
                    <Input
                      id="del-confirm"
                      value={delConfirm}
                      onChange={(e) => setDelConfirm(e.target.value)}
                      placeholder={ws.name}
                      autoComplete="off"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDelOpen(false)
                        setDelConfirm("")
                      }}
                      disabled={isPending}
                    >
                      Prekliči
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={delConfirm.trim() !== ws.name || isPending}
                      onClick={() => {
                        setDelOpen(false)
                        setDelConfirm("")
                        onDelete()
                      }}
                    >
                      {isPending && (
                        <SpinnerIcon size={16} className="mr-2 animate-spin" />
                      )}
                      Trajno izbriši
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Separator />

        {/* Members */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Člani</h3>
            {isAdmin && (
              <>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UsersIcon size={16} className="mr-1" /> Povabi
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Povabi člana</DialogTitle>
                      <DialogDescription>
                        Povabilo je vezano na e-poštni naslov. Sprejme ga lahko
                        obstoječ ali nov račun.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">E-poštni naslov</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="ime@primer.si"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vloga</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(v) =>
                            setInviteRole(v as "ADMIN" | "STAFF")
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="STAFF">Osebje</SelectItem>
                            <SelectItem value="ADMIN">Skrbnik</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="submit">Pošlji povabilo</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={createdLink !== null}
                  onOpenChange={(v) => {
                    if (!v) setCreatedLink(null)
                  }}
                >
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Povabilo ustvarjeno</DialogTitle>
                      <DialogDescription>
                        Povezavo pošlji povabljeni osebi.{" "}
                        <strong>Prikaže se samo enkrat</strong> — če jo izgubiš,
                        ustvari novo povabilo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={createdLink ?? ""}
                          className="flex-1 font-mono text-xs"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button
                          type="button"
                          variant={copied ? "default" : "outline"}
                          onClick={copyLink}
                          disabled={!createdLink}
                        >
                          {copied ? (
                            <>
                              <CheckCircleIcon size={16} className="mr-1" />
                              Kopirano
                            </>
                          ) : (
                            <>
                              <CopyIcon size={16} className="mr-1" /> Kopiraj
                            </>
                          )}
                        </Button>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setCreatedLink(null)}
                        >
                          Zapri
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          {members === null ? (
            <p className="text-muted-foreground text-sm">Nalagam člane…</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ni članov.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="hover:bg-muted/40 flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name ?? "Neimenovan"}
                      {m.isSelf && (
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          (ti)
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {m.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.isDefault && <Badge variant="outline">Privzeti</Badge>}
                    <Badge variant="muted">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </Badge>
                    {isAdmin && !m.isSelf && m.role !== "ADMIN" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRoleChange(m.userId, "ADMIN")}
                        disabled={isPending}
                        title="Povišaj v skrbnika"
                      >
                        Povišaj
                      </Button>
                    )}
                    {isAdmin && !m.isSelf && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          handleRemove(m.userId, m.name ?? m.email)
                        }
                        disabled={isPending}
                        title="Odstrani"
                      >
                        <TrashIcon size={14} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Invitations */}
        {isAdmin && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Povabila</h3>
            {invitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ni povabil.</p>
            ) : (
              <ul className="space-y-2">
                {invitations.map((inv) => (
                  <li
                    key={inv.email}
                    className="hover:bg-muted/40 flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{inv.email}</p>
                      <p className="text-muted-foreground text-xs">
                        {ROLE_LABEL[inv.role] ?? inv.role} ·{" "}
                        {INVITE_STATUS_LABEL[inv.status] ?? inv.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
