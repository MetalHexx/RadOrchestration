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

export default function RepoRegistryPage() {
  const { store, isLoading, upsertRepo, removeRepo } = useRegistryStore();
  const [selected, setSelected] = useState<RailSelection | null>(null);
  const [drawer, setDrawer] = useState<'add-repo' | 'add-group' | null>(null);

  const sections = buildRailSections(store.repos, store.repoGroups);
  const isEmpty = store.repos.length === 0 && store.repoGroups.length === 0;

  function handleSelect(kind: 'repo' | 'group', slug: string) {
    setSelected({ kind, slug });
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
                  onDeselect={() => setSelected(null)}
                />
              ) : <NothingSelectedState />;
            })() : (
              /* group selection — Phase 7 placeholder, leave as-is */
              <p className="text-sm text-muted-foreground">{`Group: ${selected.slug}`}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
