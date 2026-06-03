"use client";
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetScrollBody,
} from '@/components/ui/sheet';
import type { RepoGroupRead, RepoRead, ApiError } from './types';
import { classifyError, buildGroupCreateBody } from './registry-requests';
import { MembershipPicker } from './membership-picker';
import { FieldError } from './field-error';
import { FormErrorNotice } from './form-error-notice';
import { isGroupCreateValid } from './create-validation';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupCreateForm {
  slug: string;
  description: string;
}

const EMPTY_FORM: GroupCreateForm = {
  slug: '',
  description: '',
};

interface Props {
  open: boolean;
  repos: RepoRead[];
  onClose: () => void;
  onCreated: (group: RepoGroupRead) => void;
  onSelect: (kind: 'repo' | 'group', slug: string) => void;
}

export function AddGroupDrawer({ open, repos, onClose, onCreated, onSelect }: Props) {
  const [form, setForm] = useState<GroupCreateForm>(EMPTY_FORM);
  const [checkedMembers, setCheckedMembers] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const resetState = useCallback(() => {
    setForm(EMPTY_FORM);
    setCheckedMembers(new Set());
    setFieldErrors({});
    setFormError(undefined);
    setSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const toggleMember = useCallback((slug: string) => {
    setCheckedMembers(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    setFieldErrors({});
    setFormError(undefined);

    if (!isGroupCreateValid(form)) return;

    setSaving(true);
    try {
      const body = buildGroupCreateBody({
        slug: form.slug,
        description: form.description,
        members: [...checkedMembers],
      });

      const res = await fetch('/api/repo-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const created = (await res.json()) as RepoGroupRead;
        onCreated(created);
        onSelect('group', created.slug);
        handleClose();
      } else {
        const errBody = await res.json();
        const classified = classifyError((errBody as { error: ApiError }).error);
        if (classified.kind === 'field') {
          setFieldErrors({ [classified.field]: classified.message });
        } else {
          setFormError(classified.message);
        }
      }
    } finally {
      setSaving(false);
    }
  }, [form, checkedMembers, onCreated, onSelect, handleClose]);

  const repoOptions = repos.map(r => ({
    slug: r.slug,
    description: r.description,
    bindState: r.bind.state,
  }));
  const valid = isGroupCreateValid(form);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent style={{ width: 'var(--drawer-width)' }} side="right" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>New Repo Group</SheetTitle>
        </SheetHeader>

        <SheetScrollBody>
          <ScrollArea className="h-full">
            <div className="space-y-4 px-4 pb-4 pt-2">
              <FormErrorNotice message={formError} />

              {/* Slug field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-group-slug">
                  Slug
                </label>
                <Input
                  id="create-group-slug"
                  className="font-mono"
                  value={form.slug}
                  placeholder="my-group"
                  aria-invalid={!!fieldErrors.slug}
                  aria-describedby="err-create-group-slug"
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  lowercase-kebab · immutable · unique across repos and groups
                </p>
                <FieldError id="err-create-group-slug" message={fieldErrors.slug} />
              </div>

              {/* Description field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-group-description">
                  Description
                </label>
                <Textarea
                  id="create-group-description"
                  value={form.description}
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby="err-create-group-description"
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <FieldError id="err-create-group-description" message={fieldErrors.description} />
              </div>

              {/* Member Repos membership picker */}
              {repos.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Member Repos
                  </label>
                  <MembershipPicker
                    entityType="repos"
                    options={repoOptions}
                    saved={[]}
                    checked={checkedMembers}
                    mode="create"
                    onToggle={toggleMember}
                    ariaLabel="Member repo membership"
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetScrollBody>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!valid || saving}
          >
            {saving ? 'Creating…' : 'Create group'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
