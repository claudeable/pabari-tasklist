"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/page-header";
import { Button } from "@/components/ui/button";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard";
import { DEFAULT_WIDGET_ORDER, WIDGET_REGISTRY } from "./widgets";

const STORAGE_KEY = "jcp:dashboard-widget-order";

export default function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboardSummary();
  const [order, setOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        const known = parsed.filter((id) => DEFAULT_WIDGET_ORDER.includes(id));
        const missing = DEFAULT_WIDGET_ORDER.filter((id) => !known.includes(id));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration on mount
        setOrder([...known, ...missing]);
      }
    } catch {
      // ignore corrupt localStorage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    }
  }, [order, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function resetLayout() {
    setOrder(DEFAULT_WIDGET_ORDER);
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A shared overview of everything happening across both organizations. Drag widgets to rearrange."
        actions={
          <Button variant="outline" size="sm" onClick={resetLayout} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset layout
          </Button>
        }
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {order.map((id) => {
              const entry = WIDGET_REGISTRY[id];
              if (!entry) return null;
              const { Component } = entry;
              return (
                <Component
                  key={id}
                  summary={data}
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={() => refetch()}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {isFetching && !isLoading ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">Refreshing…</p>
      ) : null}
    </div>
  );
}
