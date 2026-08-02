"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users, FolderKanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useCreateOrganization, useOrganizations } from "@/lib/hooks/use-organizations";

export default function OrganizationsPage() {
  const { data, isLoading, isError, refetch } = useOrganizations();
  const organizations = data ?? [];
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Partner organizations collaborating on shared water infrastructure projects."
        actions={<CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : organizations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Organizations you collaborate with will appear here."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New organization
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/organizations/${org.id}`}>
              <Card className="glass-panel h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Avatar className="h-11 w-11 rounded-lg border border-border">
                    <AvatarImage src={org.logo_url} alt={org.name} />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{org.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {org.primary_contact_name || org.primary_contact || "No primary contact set"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {org.project_count ?? 0} projects
                  </span>
                  {org.users ? (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {org.users.length} users
                    </span>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createOrganization = useCreateOrganization();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  function reset() {
    setName("");
    setIndustry("");
    setWebsite("");
    setAddress("");
    setPrimaryContactName("");
    setPrimaryContactEmail("");
    setPrimaryContactPhone("");
    setLogoUrl("");
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    createOrganization.mutate(
      {
        name,
        industry: industry || undefined,
        website: website || undefined,
        address: address || undefined,
        primary_contact_name: primaryContactName || undefined,
        primary_contact_email: primaryContactEmail || undefined,
        primary_contact_phone: primaryContactPhone || undefined,
        logo_url: logoUrl || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Organization created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create organization"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-org-name">Name</Label>
            <Input id="new-org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-org-industry">Industry</Label>
              <Input
                id="new-org-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-org-website">Website</Label>
              <Input
                id="new-org-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-org-address">Address</Label>
            <Textarea
              id="new-org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-org-contact-name">Primary Contact Name</Label>
              <Input
                id="new-org-contact-name"
                value={primaryContactName}
                onChange={(e) => setPrimaryContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-org-contact-phone">Primary Contact Phone</Label>
              <Input
                id="new-org-contact-phone"
                value={primaryContactPhone}
                onChange={(e) => setPrimaryContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-org-contact-email">Primary Contact Email</Label>
            <Input
              id="new-org-contact-email"
              type="email"
              value={primaryContactEmail}
              onChange={(e) => setPrimaryContactEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-org-logo">Logo URL</Label>
            <Input
              id="new-org-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createOrganization.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
