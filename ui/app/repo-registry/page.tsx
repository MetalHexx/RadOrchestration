"use client";

import { useState } from 'react';
import { useRegistryStore } from '@/components/repo-registry/use-registry-store';
import { buildRailSections } from '@/components/repo-registry/rail-grouping';
import { RegistryRail, type RailSelection } from '@/components/repo-registry/registry-rail';
import {
  EmptyRegistryState,
  NothingSelectedState,
  RegistryErrorState,
} from '@/components/repo-registry/registry-empty-states';
import { RepoDetailPane } from '@/components/repo-registry/repo-detail-pane';
import { GroupDetailPane } from '@/components/repo-registry/group-detail-pane';
import { AddRepoDrawer } from '@/components/repo-registry/add-repo-drawer';
import { AddGroupDrawer } from '@/components/repo-registry/add-group-drawer';
import { useRegistryLive } from '@/components/repo-registry/use-registry-live';
import { useNavGuard, UnsavedChangesDialog } from '@/components/repo-registry/use-nav-guard';

export default function RepoRegistryPage() {
  const { store, isLoading, error, refetch, upsertRepo, removeRepo, upsertGroup, removeGroup } = useRegistryStore();
  const [selected, setSelected] = useState<RailSelection | null>(null);
  const [drawer, setDrawer] = useState<'add-repo' | 'add-group' | null>(null);
  const [paneDirty, setPaneDirty] = useState(false);
  const { open, guard, onConfirm, onCancel } = useNavGuard();

  useRegistryLive({ dirty: paneDirty, onRefetch: refetch });

  const sections = buildRailSections(store.repos, store.repoGroups);
  const isEmpty = store.repos.length === 0 && store.repoGroups.length === 0;

  function handleSelect(kind: 'repo' | 'group', slug: string) {
    guard(paneDirty, () => { setSelected({ kind, slug }); setPaneDirty(false); });
  }

  function handleAddRepo() {
    guard(paneDirty, () => setDrawer('add-repo'));
  }

  function handleAddGroup() {
    guard(paneDirty, () => setDrawer('add-group'));
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <RegistryRail
        sections={sections}
        selected={selected}
        onSelect={handleSelect}
        onAddRepo={handleAddRepo}
        onAddGroup={handleAddGroup}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {isLoading ? null : error && isEmpty ? (
          <RegistryErrorState message={error} onRetry={refetch} />
        ) : isEmpty ? (
          <EmptyRegistryState onAddRepo={handleAddRepo} />
        ) : selected === null ? (
          <NothingSelectedState />
        ) : (
          <div className="flex flex-1 flex-col">
            {selected.kind === 'repo' ? (() => {
              const repo = store.repos.find(r => r.slug === selected.slug);
              return repo ? (
                <RepoDetailPane
                  key={`repo:${repo.slug}`}
                  repo={repo}
                  groups={store.repoGroups}
                  upsertRepo={upsertRepo}
                  removeRepo={removeRepo}
                  onDeselect={() => { setSelected(null); setPaneDirty(false); }}
                  onDirtyChange={setPaneDirty}
                />
              ) : <NothingSelectedState />;
            })() : selected.kind === 'group' ? (() => {
              const group = store.repoGroups.find(g => g.slug === selected.slug);
              return group ? (
                <GroupDetailPane
                  key={`group:${group.slug}`}
                  group={group}
                  repos={store.repos}
                  upsertGroup={upsertGroup}
                  removeGroup={removeGroup}
                  onDeselect={() => { setSelected(null); setPaneDirty(false); }}
                  onDirtyChange={setPaneDirty}
                />
              ) : <NothingSelectedState />;
            })() : (
              <NothingSelectedState />
            )}
          </div>
        )}
      </main>
      <AddRepoDrawer
        open={drawer === 'add-repo'}
        groups={store.repoGroups}
        onClose={() => setDrawer(null)}
        onCreated={upsertRepo}
        onSelect={handleSelect}
      />
      <AddGroupDrawer
        open={drawer === 'add-group'}
        repos={store.repos}
        onClose={() => setDrawer(null)}
        onCreated={upsertGroup}
        onSelect={handleSelect}
      />
      <UnsavedChangesDialog open={open} onConfirm={onConfirm} onCancel={onCancel} />
    </div>
  );
}
