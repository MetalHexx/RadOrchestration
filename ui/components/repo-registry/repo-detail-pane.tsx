"use client";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { classifyError, buildRepoSaveBody, NETWORK_ERROR_MESSAGE } from './registry-requests';
import { useDirtyBatch } from './use-dirty-batch';
import { EntityHeader } from './entity-header';
import { EditableCard } from './editable-card';
import { FieldError } from './field-error';
import { FormErrorNotice } from './form-error-notice';
import { LocalPathCard } from './local-path-card';
import { MembershipPicker } from './membership-picker';
import { SaveBar } from './save-bar';
import { repoDraftFrom, validateRepoDraft, type RepoDraft } from './repo-save-flow';
import type { RepoRead, RepoGroupRead, ApiError } from './types';

interface Props {
  repo: RepoRead;
  groups: RepoGroupRead[];
  upsertRepo: (r: RepoRead) => void;
  removeRepo: (slug: string) => void;
  onDeselect: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function RepoDetailPane({ repo, groups, upsertRepo, removeRepo, onDeselect, onDirtyChange }: Props) {
  const baseline = useMemo(() => repoDraftFrom(repo), [repo]);
  const { draft, setDraft, reset, dirty } = useDirtyBatch<RepoDraft>(baseline);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(undefined);
  }, []);

  const handleSave = useCallback(async () => {
    clearErrors();
    const errs = validateRepoDraft(draft);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/repos/${repo.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRepoSaveBody(draft)),
      });

      if (res.ok) {
        const saved = (await res.json()) as RepoRead;
        upsertRepo(saved);
        // Rebaseline the draft to the saved state
        const newBaseline = repoDraftFrom(saved);
        setDraft(newBaseline);
      } else {
        const errBody = await res.json();
        const classified = classifyError((errBody as { error: ApiError }).error);
        if (classified.kind === 'field') {
          setFieldErrors({ [classified.field]: classified.message });
        } else {
          setFormError(classified.message);
        }
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }, [draft, repo.slug, upsertRepo, clearErrors, setDraft]);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/repos/${repo.slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        removeRepo(repo.slug);
        onDeselect();
      } else {
        const errBody = await res.json();
        const classified = classifyError((errBody as { error: ApiError }).error);
        setFormError(classified.message);
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    } finally {
      setRemoving(false);
      setConfirmOpen(false);
    }
  }, [repo.slug, removeRepo, onDeselect]);

  const groupOptions = groups.map(g => ({ slug: g.slug, description: g.description }));
  const checkedGroups = new Set(draft.groups);

  const toggleGroup = useCallback((slug: string) => {
    setDraft(prev => {
      const next = new Set(prev.groups);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { ...prev, groups: [...next] };
    });
  }, [setDraft]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <EntityHeader kind="repo" slug={repo.slug} bindState={repo.bind.state} />

        <FormErrorNotice message={formError} />

        {/* Details Card */}
        <EditableCard title="Details">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="repo-remote">
                Remote
              </label>
              <Input
                id="repo-remote"
                className="font-mono"
                value={draft.remote}
                aria-invalid={!!fieldErrors.remote}
                aria-describedby="err-remote"
                onChange={e => setDraft(prev => ({ ...prev, remote: e.target.value }))}
              />
              <FieldError id="err-remote" message={fieldErrors.remote} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="repo-default-branch">
                Default branch
              </label>
              <Input
                id="repo-default-branch"
                className="font-mono"
                value={draft.defaultBranch}
                aria-invalid={!!fieldErrors.defaultBranch}
                aria-describedby="err-defaultBranch"
                onChange={e => setDraft(prev => ({ ...prev, defaultBranch: e.target.value }))}
              />
              <FieldError id="err-defaultBranch" message={fieldErrors.defaultBranch} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="repo-description">
                Description
              </label>
              <Textarea
                id="repo-description"
                value={draft.description}
                aria-invalid={!!fieldErrors.description}
                aria-describedby="err-description"
                onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
              />
              <FieldError id="err-description" message={fieldErrors.description} />
            </div>
          </div>
        </EditableCard>

        {/* Local Path Card */}
        <LocalPathCard
          state={repo.bind.state}
          value={draft.localPath}
          onChange={v => setDraft(prev => ({ ...prev, localPath: v }))}
          serverError={fieldErrors.localPath}
        />

        {/* Repo Groups Card */}
        <EditableCard title="Repo Groups">
          <MembershipPicker
            entityType="groups"
            options={groupOptions}
            saved={repo.groups}
            checked={checkedGroups}
            mode="detail"
            onToggle={toggleGroup}
            ariaLabel="Repo group membership"
          />
        </EditableCard>

        {/* Remove action */}
        <div className="mt-6 border-t pt-4">
          <Button
            variant="ghost"
            className="btn-danger-ghost text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Remove repository
          </Button>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={reset}
        onSave={handleSave}
      />

      {/* Remove confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Remove repository</DialogTitle>
          <DialogDescription>
            This repo is dropped from every group and its local binding is removed.
            This action cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose>
              <Button variant="ghost" disabled={removing}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={handleRemove}
            >
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
