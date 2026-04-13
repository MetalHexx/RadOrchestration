'use client';

import { useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseTemplateToGraph } from '@/lib/template-serializer';
import { computeTemplateLayout } from '@/lib/template-layout';
import { TemplateGraphNode } from './template-graph-node';
import { TemplateGroupNode } from './template-group-node';
import type {
  TemplateGraphNode as TemplateGraphNodeType,
  TemplateGraphEdge,
} from '@/types/template';

const nodeTypes: NodeTypes = {
  templateNode: TemplateGraphNode,
  templateGroup: TemplateGroupNode,
};

interface ReadOnlyCanvasProps {
  templateId: string;
}

export function ReadOnlyCanvas({ templateId }: ReadOnlyCanvasProps) {
  const [nodes, setNodes] = useState<TemplateGraphNodeType[]>([]);
  const [edges, setEdges] = useState<TemplateGraphEdge[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let aborted = false;

    async function load() {
      setStatus('loading');

      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) {
          if (!aborted) {
            setErrorMessage('Failed to load template.');
            setStatus('error');
          }
          return;
        }

        const json = await res.json();
        const graph = parseTemplateToGraph(json.rawYaml);
        const laid = computeTemplateLayout(graph.nodes, graph.edges);

        if (!aborted) {
          setNodes(laid.nodes);
          setEdges(laid.edges);
          setStatus('loaded');
        }
      } catch {
        if (!aborted) {
          setErrorMessage('Failed to load template.');
          setStatus('error');
        }
      }
    }

    load();

    return () => {
      aborted = true;
    };
  }, [templateId]);

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
        <svg
          className="animate-spin h-5 w-5 mr-2 text-[var(--muted-foreground)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span>Loading template…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center" role="alert">
        <span className="text-[var(--destructive)]">{errorMessage}</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 w-full overflow-hidden"
      role="img"
      aria-label="Pipeline template graph — read only"
    >
      <ReactFlow
        nodes={nodes as unknown as Node[]}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView={true}
        elementsSelectable={false}
        nodesConnectable={false}
        nodesDraggable={false}
        edgesFocusable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        defaultEdgeOptions={{
          style: { stroke: 'var(--canvas-edge-stroke)', strokeWidth: 1.5 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <MiniMap aria-hidden="true" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
