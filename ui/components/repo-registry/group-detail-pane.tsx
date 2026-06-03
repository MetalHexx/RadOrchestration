"use client";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import type { RepoGroupRead, RepoRead, ApiError } from './types';
import { classifyError, buildGroupSaveBody, NETWORK_ERROR_MESSAGE } from './registry-requests';
import { useDirtyBatch } from './use-dirty-batch';
import { EntityHeader } from './entity-header';
import { EditableCard } from './editable-card';
import { FieldError } from './field-error';
import { FormErrorNotice } from './form-error-notice';
import { MembershipPicker } from './membership-picker';
import { SaveBar } from './save-bar';
import { groupDraftFrom, validateGroupDraft, type GroupDraft } from './group-save-flow';

interface Props {
  group: RepoGroupRead;
  repos: RepoRead[];
  upsertGroup: (g: RepoGroupRead) => void;
  removeGroup: (slug: string) => void;
  onDeselect: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function GroupDetailPane({ group, repos, upsertGroup, removeGroup, onDeselect, onDirtyChange }: Props) {
  const baseline = useMemo(() => groupDraftFrom(group), [group]);
  const { draft, setDraft, reset, dirty } = useDirtyBatch<GroupDraft>(baseline);

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
    const errs = validateGroupDraft(draft);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/repo-groups/${group.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGroupSaveBody(draft)),
      });

      if (res.ok) {
        const saved = (await res.json()) as RepoGroupRead;
        upsertGroup(saved);
        // Rebaseline the draft to the saved state
        const newBaseline = groupDraftFrom(saved);
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
  }, [draft, group.slug, upsertGroup, clearErrors, setDraft]);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/repo-groups/${group.slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        removeGroup(group.slug);
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
  }, [group.slug, removeGroup, onDeselect]);

  const repoOptions = repos.map(r => ({
    slug: r.slug,
    description: r.description,
    bindState: r.bind.state,
  }));
  const checkedMembers = new Set(draft.members);

  const toggleMember = useCallback((slug: string) => {
    setDraft(prev => {
      const next = new Set(prev.members);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { ...prev, members: [...next] };
    });
  }, [setDraft]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-7 pt-6 pb-4">
        <EntityHeader kind="group" slug={group.slug} />

        <FormErrorNotice message={formError} />

        {/* Description Card */}
        <EditableCard title="Description">
          <div>
            <Textarea
              id="group-description"
              aria-label="Description"
              value={draft.description}
              aria-invalid={!!fieldErrors.description}
              aria-describedby="err-description"
              onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
            />
            <FieldError id="err-description" message={fieldErrors.description} />
          </div>
        </EditableCard>

        {/* Member Repos Card */}
        <EditableCard title="Member Repos">
          <MembershipPicker
            entityType="repos"
            options={repoOptions}
            saved={group.members}
            checked={checkedMembers}
            mode="detail"
            onToggle={toggleMember}
            ariaLabel="Member repo membership"
          />
        </EditableCard>

        {/* Delete action */}
        <div className="mt-6 border-t pt-4">
          <Button
            variant="ghost"
            className="btn-danger-ghost text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Delete Repo Group
          </Button>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={reset}
        onSave={handleSave}
      />

      {/* Delete confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Delete Repo Group</DialogTitle>
          <DialogDescription>
            The member repos themselves stay. Only the group is deleted.
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
              {removing ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
