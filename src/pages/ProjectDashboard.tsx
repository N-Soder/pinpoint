import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, fetchPins, patchPin, deletePin, screenshotUrl, type PinList } from "@/lib/api";
import { safeHttpUrl } from "@/lib/utils";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Copy, ExternalLink, RotateCcw, MessageSquare, Trash2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const ProjectDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!id,
  });

  const {
    data: pinList,
    isLoading: pinsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pins", id],
    queryFn: () => fetchPins(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const project = projects?.find((p) => p.id === id);

  const toggleResolvedMutation = useMutation({
    mutationFn: ({ pinId, resolved }: { pinId: string; resolved: boolean }) =>
      patchPin(pinId, { resolved }),
    onMutate: async ({ pinId, resolved }) => {
      await queryClient.cancelQueries({ queryKey: ["pins", id] });
      const previous = queryClient.getQueryData<PinList>(["pins", id]);
      queryClient.setQueryData<PinList>(["pins", id], (old) =>
        old && { ...old, pins: old.pins.map((p) => (p.id === pinId ? { ...p, resolved } : p)) }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pins", id], context.previous);
      }
      toast({ title: "Error", description: "Failed to update pin.", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["pins", id] }),
  });

  const deletePinMutation = useMutation({
    mutationFn: (pinId: string) => deletePin(pinId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pins", id] }),
    onError: () =>
      toast({ title: "Error", description: "Failed to delete pin.", variant: "destructive" }),
  });

  const scriptTag = `<script src="${window.location.origin}/widget.js?project=${id}"></script>`;

  const copyScript = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (projectsLoading || pinsLoading) {
    return (
      <AppLayout>
        <div className="p-8 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-8 max-w-4xl mx-auto text-center py-20">
          <p className="text-sm text-destructive mb-4">Failed to load project data.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground">Project not found.</div>
      </AppLayout>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const allPins = [...(pinList?.pins ?? [])].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  );
  const openCount = allPins.filter((p) => !p.resolved).length;
  const resolvedCount = allPins.filter((p) => p.resolved).length;

  const filteredPins = allPins.filter((pin) => {
    if (filter === "open") return !pin.resolved;
    if (filter === "resolved") return pin.resolved;
    return true;
  });

  const grouped = filteredPins.reduce<Record<string, typeof filteredPins>>((acc, pin) => {
    const key = pin.page_url;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pin);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {safeHttpUrl(project.site_url) ? (
              <a
                href={project.site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-1"
              >
                {project.site_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-sm text-muted-foreground inline-flex items-center gap-1 mt-1">
                {project.site_url}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="default">{openCount} open</Badge>
            <Badge variant="secondary">{resolvedCount} resolved</Badge>
          </div>
        </div>

        {/* Script Tag */}
        <div className="rounded-lg border bg-card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Embed Script</span>
            <Button variant="ghost" size="sm" onClick={copyScript}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="font-mono text-xs bg-muted rounded-md p-3 overflow-x-auto text-foreground">
            {scriptTag}
          </pre>
          <p className="text-xs text-muted-foreground mt-3">
            Paste this into your site's HTML before the closing{" "}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">&lt;/body&gt;</code> tag.
            Add{" "}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">?review=1</code> to any page
            URL to activate feedback mode.
          </p>
        </div>

        {/* Pins */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({allPins.length})</TabsTrigger>
            <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolvedCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            {pinList?.hasMore && (
              <p className="text-xs text-muted-foreground mb-4">
                Showing the newest {allPins.length} pins. This project has more; delete pins you no
                longer need to see the rest.
              </p>
            )}
            {filteredPins.length === 0 ? (
              <div className="text-center py-16 border rounded-lg bg-card">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {filter === "all"
                    ? "No feedback pins yet. Add the script to your site and start reviewing."
                    : `No ${filter} pins.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([pageUrl, pagePins]) => (
                  <div key={pageUrl}>
                    {safeHttpUrl(pageUrl) ? (
                      <a
                        href={pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2"
                      >
                        {pageUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 mb-2">
                        {pageUrl}
                      </span>
                    )}
                    <div className="space-y-2">
                      {pagePins.map((pin) => (
                        <div
                          key={pin.id}
                          className={`rounded-lg border bg-card p-4 transition-opacity ${
                            pin.resolved ? "opacity-50" : ""
                          }`}
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: pin.resolved
                              ? "hsl(220 9% 46%)"
                              : "hsl(224 76% 53%)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground mb-1">
                                {pin.comment}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {pin.element_text || pin.element_selector}
                              </p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {pin.author && (
                                  <span className="text-xs text-muted-foreground">
                                    {pin.author}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {pin.created_at
                                    ? new Date(pin.created_at).toLocaleString()
                                    : ""}
                                </span>
                                {pin.browser && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {pin.browser}
                                  </Badge>
                                )}
                                {pin.viewport && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 font-mono"
                                  >
                                    {pin.viewport}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {pin.has_screenshot && (
                                <img
                                  src={screenshotUrl(pin.id)}
                                  alt="Element screenshot"
                                  loading="lazy"
                                  className="h-12 w-16 object-cover rounded border"
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={toggleResolvedMutation.isPending}
                                onClick={() =>
                                  toggleResolvedMutation.mutate({
                                    pinId: pin.id,
                                    resolved: !pin.resolved,
                                  })
                                }
                              >
                                {pin.resolved ? (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                {pin.resolved ? "Reopen" : "Resolve"}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={deletePinMutation.isPending}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete pin?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this feedback pin. This action
                                      cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePinMutation.mutate(pin.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProjectDashboard;
