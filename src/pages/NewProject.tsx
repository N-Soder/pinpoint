import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";

const NewProject = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        // The project ID doubles as the widget's access key, so it must be unguessable.
        id: crypto.randomUUID(),
        name: name.trim(),
        site_url: siteUrl.trim(),
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project created" });
      navigate(`/admin/project/${project.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !siteUrl.trim()) return;
    mutation.mutate();
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold mb-6">New Project</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Website"
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Site URL</Label>
            <Input
              id="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
              required
              disabled={mutation.isPending}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
};

export default NewProject;
