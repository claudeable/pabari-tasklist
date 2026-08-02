import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-custom/page-header";

interface ModuleStubProps {
  title: string;
  icon?: LucideIcon;
  description: string;
  features: string[];
}

export function ModuleStub({ title, icon: Icon, description, features }: ModuleStubProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Coming soon
          </Badge>
        }
      />
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
            Planned features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 p-3 text-sm text-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
