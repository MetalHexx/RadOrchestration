"use client";

import { useState } from 'react';
import { useRegistryStore } from '@/components/repo-registry/use-registry-store';
import { buildRailSections } from '@/components/repo-registry/rail-grouping';
import { RegistryRail, type RailSelection } from '@/components/repo-registry/registry-rail';
import {
  EmptyRegistryState,
  NothingSelectedState,
} from '@/components/repo-registry/registry-empty-states';
import { RepoDetailPane } from '@/components/repo-registry/repo-detail-pane';
import { GroupDetailPane } from '@/components/repo-registry/group-detail-pane';
import { AddRepoDrawer } from '@/components/repo-registry/add-repo-drawer';
import { AddGroupDrawer } from '@/components/repo-registry/add-group-drawer';
import { useRegistryLive } from '@/components/repo-registry/use-registry-live';

export default function RepoRegistryPage() {
  const { store, isLoading, refetch, upsertRepo, removeRepo, upsertGroup, removeGroup } = useRegistryStore();
  const [selected, setSelected] = useState<RailSelection | null>(null);
  const [drawer, setDrawer] = useState<'add-repo' | 'add-group' | null>(null);
  const [paneDirty, setPaneDirty] = useState(false);

  useRegistryLive({ dirty: paneDirty, onRefetch: refetch });

  const sections = buildRailSections(store.repos, store.repoGroups);
  const isEmpty = store.repos.length === 0 && store.repoGroups.length === 0;

  function handleSelect(kind: 'repo' | 'group', slug: string) {
    setSelected({ kind, slug });
    setPaneDirty(false);
  }

  function handleAddRepo() {
    setDrawer('add-repo');
  }

  function handleAddGroup() {
    setDrawer('add-group');
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <RegistryRail
        sections={sections}
        selected={selected}
        onSelect={handleSelect}
        onAddRepo={handleAddRepo}
        onAddGroup={handleAddGroup}
      />
      <main className="flex flex-1 flex-col">
        {isLoading ? null : isEmpty ? (
          <EmptyRegistryState onAddRepo={handleAddRepo} />
        ) : selected === null ? (
          <NothingSelectedState />
        ) : (
          <div className="flex flex-1 flex-col p-6">
            {selected.kind === 'repo' ? (() => {
              const repo = store.repos.find(r => r.slug === selected.slug);
              return repo ? (
                <RepoDetailPane
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
    </div>
  );
}
