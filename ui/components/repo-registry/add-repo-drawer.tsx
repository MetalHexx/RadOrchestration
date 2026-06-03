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
import type { RepoRead, RepoGroupRead, ApiError } from './types';
import { classifyError, buildRepoCreateBody, NETWORK_ERROR_MESSAGE } from './registry-requests';
import { MembershipPicker } from './membership-picker';
import { FieldError } from './field-error';
import { FormErrorNotice } from './form-error-notice';
import { isRepoCreateValid } from './create-validation';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RepoCreateForm {
  slug: string;
  remote: string;
  defaultBranch: string;
  description: string;
  localPath: string;
}

const EMPTY_FORM: RepoCreateForm = {
  slug: '',
  remote: '',
  defaultBranch: 'main',
  description: '',
  localPath: '',
};

interface Props {
  open: boolean;
  groups: RepoGroupRead[];
  onClose: () => void;
  onCreated: (repo: RepoRead) => void;
  onSelect: (kind: 'repo' | 'group', slug: string) => void;
}

export function AddRepoDrawer({ open, groups, onClose, onCreated, onSelect }: Props) {
  const [form, setForm] = useState<RepoCreateForm>(EMPTY_FORM);
  const [checkedGroups, setCheckedGroups] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const resetState = useCallback(() => {
    setForm(EMPTY_FORM);
    setCheckedGroups(new Set());
    setFieldErrors({});
    setFormError(undefined);
    setSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const toggleGroup = useCallback((slug: string) => {
    setCheckedGroups(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    setFieldErrors({});
    setFormError(undefined);

    if (!isRepoCreateValid(form)) return;

    setSaving(true);
    try {
      const body = buildRepoCreateBody({
        slug: form.slug,
        remote: form.remote,
        defaultBranch: form.defaultBranch,
        description: form.description,
        localPath: form.localPath,
        groups: [...checkedGroups],
      });

      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const created = (await res.json()) as RepoRead;
        onCreated(created);
        onSelect('repo', created.slug);
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
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }, [form, checkedGroups, onCreated, onSelect, handleClose]);

  const groupOptions = groups.map(g => ({ slug: g.slug, description: g.description }));
  const valid = isRepoCreateValid(form);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent style={{ width: 'var(--drawer-width)' }} side="right" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Add repository</SheetTitle>
        </SheetHeader>

        <SheetScrollBody>
          <ScrollArea className="h-full">
            <div className="space-y-4 px-4 pb-4 pt-2">
              <FormErrorNotice message={formError} />

              {/* Slug field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-repo-slug">
                  Slug
                </label>
                <Input
                  id="create-repo-slug"
                  className="font-mono"
                  value={form.slug}
                  placeholder="my-repo"
                  aria-invalid={!!fieldErrors.slug}
                  aria-describedby="err-create-repo-slug"
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  lowercase-kebab · immutable · unique across repos and groups
                </p>
                <FieldError id="err-create-repo-slug" message={fieldErrors.slug} />
              </div>

              {/* Remote field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-repo-remote">
                  Remote
                </label>
                <Input
                  id="create-repo-remote"
                  className="font-mono"
                  value={form.remote}
                  placeholder="https://github.com/org/repo"
                  aria-invalid={!!fieldErrors.remote}
                  aria-describedby="err-create-repo-remote"
                  onChange={e => setForm(prev => ({ ...prev, remote: e.target.value }))}
                />
                <FieldError id="err-create-repo-remote" message={fieldErrors.remote} />
              </div>

              {/* Default branch field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-repo-default-branch">
                  Default branch
                </label>
                <Input
                  id="create-repo-default-branch"
                  className="font-mono"
                  value={form.defaultBranch}
                  placeholder="main"
                  aria-invalid={!!fieldErrors.defaultBranch}
                  aria-describedby="err-create-repo-default-branch"
                  onChange={e => setForm(prev => ({ ...prev, defaultBranch: e.target.value }))}
                />
                <FieldError id="err-create-repo-default-branch" message={fieldErrors.defaultBranch} />
              </div>

              {/* Description field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-repo-description">
                  Description
                </label>
                <Textarea
                  id="create-repo-description"
                  value={form.description}
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby="err-create-repo-description"
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <FieldError id="err-create-repo-description" message={fieldErrors.description} />
              </div>

              {/* Divider */}
              <hr className="border-t" />

              {/* Local path field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="create-repo-local-path">
                  Local path
                </label>
                <Input
                  id="create-repo-local-path"
                  className="font-mono"
                  value={form.localPath}
                  placeholder="Paste local folder path…"
                  readOnly
                  aria-invalid={!!fieldErrors.localPath}
                  aria-describedby="err-create-repo-local-path"
                  onPaste={e => {
                    e.preventDefault();
                    // Trim clipboard whitespace/newlines so a stray trailing
                    // char doesn't trip server-side PATH_INVALID on a valid path.
                    const pasted = e.clipboardData.getData('text').trim();
                    setForm(prev => ({ ...prev, localPath: pasted }));
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  required · must be an existing folder on this machine (checked server-side, like the CLI)
                </p>
                <FieldError id="err-create-repo-local-path" message={fieldErrors.localPath} />
              </div>

              {/* Repo Groups membership picker */}
              {groups.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Repo Groups
                  </label>
                  <MembershipPicker
                    entityType="groups"
                    options={groupOptions}
                    saved={[]}
                    checked={checkedGroups}
                    mode="create"
                    onToggle={toggleGroup}
                    ariaLabel="Repo group membership"
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
            {saving ? 'Adding…' : 'Add repository'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
