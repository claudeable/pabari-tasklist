"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  Phone,
  Shield,
  Users2,
  Layers,
  FolderKanban,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ConfirmDeleteDialog } from "@/components/ui-custom/confirm-delete-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useDeleteOrganization,
  useOrganization,
  useUpdateOrganization,
} from "@/lib/hooks/use-organizations";
import { ApiError } from "@/lib/api-client";
import type { Organization } from "@/lib/types";

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: org, isLoading, isError, refetch } = useOrganization(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteOrganization = useDeleteOrganization();

  function handleDelete() {
    deleteOrganization.mutate(id, {
      onSuccess: () => {
        toast.success("Organization deleted");
        router.push("/organizations");
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : "Failed to delete organization",
        ),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!org) {
    return (
      <EmptyState icon={Building2} title="Organization not found" />
    );
  }

  return (
    <div>
      <PageHeader
        title={org.name}
        description={org.description || "Organization profile and collaboration details."}
        actions={
          <div className="flex items-center gap-2">
            <EditOrganizationDialog org={org} open={editOpen} onOpenChange={setEditOpen} />
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete organization
            </Button>
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this organization?"
              description="This can't be undone. All associated data may be removed."
              isPending={deleteOrganization.isPending}
              onConfirm={handleDelete}
            />
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4">
        <Avatar className="h-14 w-14 rounded-lg border border-border">
          <AvatarImage src={org.logo_url} alt={org.name} />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Projects" value={org.project_count ?? org.projects?.length ?? 0} />
          <Metric label="Users" value={org.users?.length ?? 0} />
          <Metric label="Departments" value={org.departments?.length ?? 0} />
          <Metric label="Contacts" value={org.contacts?.length ?? 0} />
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="contacts">Contact Directory</TabsTrigger>
          <TabsTrigger value="projects">Projects Involved</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="glass-panel">
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={org.name} />
              <Field
                label="Primary Contact"
                value={org.primary_contact_name || org.primary_contact}
              />
              <Field label="Primary Contact Email" value={org.primary_contact_email} />
              <Field label="Primary Contact Phone" value={org.primary_contact_phone} />
              <Field label="Industry" value={org.industry} />
              <Field label="Website" value={org.website} />
              <Field label="Address" value={org.address} />
              <Field label="Description" value={org.description} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          {org.departments && org.departments.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {org.departments.map((dept) => (
                <Card key={dept.id} className="glass-panel">
                  <CardContent className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{dept.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dept.head ? `Head: ${dept.head}` : ""}{" "}
                        {dept.member_count !== undefined
                          ? `· ${dept.member_count} members`
                          : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Layers} title="No departments listed" />
          )}
        </TabsContent>

        <TabsContent value="users">
          {org.users && org.users.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              {org.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url} alt={u.name} />
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {u.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.role ? <Badge variant="secondary">{u.role}</Badge> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users2} title="No users listed" />
          )}
        </TabsContent>

        <TabsContent value="roles">
          {org.roles && org.roles.length > 0 ? (
            <div className="space-y-3">
              {org.roles.map((role) => (
                <Card key={role.id} className="glass-panel">
                  <CardContent className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{role.role}</p>
                      {role.description ? (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      ) : null}
                      {role.permissions ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {role.permissions.map((p) => (
                            <Badge key={p} variant="outline" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Shield} title="No roles configured" />
          )}
        </TabsContent>

        <TabsContent value="contacts">
          {org.contacts && org.contacts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {org.contacts.map((c) => (
                <Card key={c.id} className="glass-panel">
                  <CardContent>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {c.title ? (
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                    ) : null}
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {c.email ? (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {c.email}
                        </p>
                      ) : null}
                      {c.phone ? (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users2} title="No contacts listed" />
          )}
        </TabsContent>

        <TabsContent value="projects">
          {org.projects && org.projects.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              {org.projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 p-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    {p.name}
                  </span>
                  {p.status ? <StatusPill status={p.status} /> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FolderKanban} title="No projects linked yet" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditOrganizationDialog({
  org,
  open,
  onOpenChange,
}: {
  org: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateOrganization = useUpdateOrganization();
  const [name, setName] = useState(org.name ?? "");
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [website, setWebsite] = useState(org.website ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [primaryContactName, setPrimaryContactName] = useState(org.primary_contact_name ?? "");
  const [primaryContactEmail, setPrimaryContactEmail] = useState(org.primary_contact_email ?? "");
  const [primaryContactPhone, setPrimaryContactPhone] = useState(org.primary_contact_phone ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");

  useEffect(() => {
    if (!open) return;
    setName(org.name ?? "");
    setIndustry(org.industry ?? "");
    setWebsite(org.website ?? "");
    setAddress(org.address ?? "");
    setPrimaryContactName(org.primary_contact_name ?? "");
    setPrimaryContactEmail(org.primary_contact_email ?? "");
    setPrimaryContactPhone(org.primary_contact_phone ?? "");
    setLogoUrl(org.logo_url ?? "");
  }, [open, org]);

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateOrganization.mutate(
      {
        id: org.id,
        payload: {
          name,
          industry: industry || undefined,
          website: website || undefined,
          address: address || undefined,
          primary_contact_name: primaryContactName || undefined,
          primary_contact_email: primaryContactEmail || undefined,
          primary_contact_phone: primaryContactPhone || undefined,
          logo_url: logoUrl || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Organization updated");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to update organization"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-industry">Industry</Label>
              <Input
                id="org-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-address">Address</Label>
            <Textarea
              id="org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-contact-name">Primary Contact Name</Label>
              <Input
                id="org-contact-name"
                value={primaryContactName}
                onChange={(e) => setPrimaryContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-contact-phone">Primary Contact Phone</Label>
              <Input
                id="org-contact-phone"
                value={primaryContactPhone}
                onChange={(e) => setPrimaryContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-contact-email">Primary Contact Email</Label>
            <Input
              id="org-contact-email"
              type="email"
              value={primaryContactEmail}
              onChange={(e) => setPrimaryContactEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-logo">Logo URL</Label>
            <Input id="org-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={updateOrganization.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
