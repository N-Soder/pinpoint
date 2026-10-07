import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { createReviewToken, deleteReviewToken, fetchReviewToken, reviewLinkFor } from "@/lib/api";

/**
 * Lets the admin require a review link for a project, see the link again,
 * replace it, or go back to the default where the project ID is enough.
 */
export function ReviewLinkCard({ projectId, siteUrl }: { projectId: string; siteUrl: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["review-link", projectId];
  const [copied, setCopied] = useState(false);

  const { data: token, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchReviewToken(projectId),
  });

  const create = useMutation({
    mutationFn: () => createReviewToken(projectId),
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
    onError: () =>
      toast({ title: "Error", description: "Couldn't create the review link.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => deleteReviewToken(projectId),
    onSuccess: () => queryClient.setQueryData(queryKey, null),
    onError: () =>
      toast({ title: "Error", description: "Couldn't turn the review link off.", variant: "destructive" }),
  });

  const busy = create.isPending || remove.isPending;
  const link = token ? reviewLinkFor(siteUrl, token) : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Select the link and copy it by hand.", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Review link</span>
        {link && (
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : error ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-destructive">Couldn't load this project's review link setting.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : token ? (
        <>
          <pre className="font-mono text-xs bg-muted rounded-md p-3 overflow-x-auto text-foreground">
            {link ?? `?review=${token}`}
          </pre>
          <p className="text-xs text-muted-foreground mt-3">
            Only people with this link, and you, can read or add this project's feedback. To review
            another page, add the same{" "}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">?review=…</code> to its URL.
            Share the link like a password.
          </p>
          <div className="flex gap-2 mt-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  New link
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace the review link?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current link stops working straight away. Reviewers will need the new one.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => create.mutate()}>Replace link</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>
                  Turn off
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop requiring a review link?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Anyone who has this project's ID, which is in the embed script on your site, will
                    be able to read and add its feedback again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate()}>Turn off</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Off. Anyone who has this project's ID, which is in the embed script on your site, can read
            and add its feedback by adding{" "}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">?review=1</code> to a page URL.
            Require a review link to limit that to people you send the link to.
          </p>
          <Button variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => create.mutate()}>
            <Link2 className="h-3.5 w-3.5" />
            Require a review link
          </Button>
        </div>
      )}
    </div>
  );
}
