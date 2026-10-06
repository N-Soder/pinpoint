import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ExternalLink, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { fetchProjectsWithCounts } from "@/lib/api";

const Index = () => {
  const {
    isLoading,
    error,
    data: projects = [],
    refetch,
  } = useQuery({
    queryKey: ["projects", "with-counts"],
    queryFn: fetchProjectsWithCounts,
    refetchInterval: 5000,
  });

  if (error) {
    return (
      <AppLayout>
        <div className="p-8 max-w-5xl mx-auto text-center py-20">
          <p className="text-sm text-destructive mb-4">Failed to load projects.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your website feedback projects
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/admin/project/${project.id}`}
                className="group block rounded-lg border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span className="truncate">{project.site_url}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{project.open_pin_count}</span>
                    <span className="text-muted-foreground">open</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {project.created_at
                      ? new Date(project.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border rounded-lg bg-card">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first project to start collecting feedback
            </p>
            <Button asChild>
              <Link to="/admin/new">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
