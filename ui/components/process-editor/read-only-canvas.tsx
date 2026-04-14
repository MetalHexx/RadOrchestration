'use client';

import { useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
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
  TemplateGraphEdge,
  TemplateGraphNodeData,
} from '@/types/template';

const nodeTypes: NodeTypes = {
  templateNode: TemplateGraphNode,
  templateGroup: TemplateGroupNode,
};

const defaultEdgeOptions = {
  style: { stroke: 'var(--canvas-edge-stroke)', strokeWidth: 1.5 },
};

interface ReadOnlyCanvasProps {
  templateId: string;
}

export function ReadOnlyCanvas({ templateId }: ReadOnlyCanvasProps) {
  const [nodes, setNodes] = useState<Node<TemplateGraphNodeData>[]>([]);
  const [edges, setEdges] = useState<TemplateGraphEdge[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let aborted = false;

    async function load() {
      setStatus('loading');

      try {
        const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}`);
        if (!res.ok) {
          let msg = 'Failed to load template.';
          try {
            const body = await res.json();
            if (body.error) msg = body.error;
          } catch {
            // fallback to generic message
          }
          throw new Error(msg);
        }

        const json = await res.json();
        const graph = parseTemplateToGraph(json.rawYaml);
        const laid = computeTemplateLayout(graph.nodes, graph.edges);

        if (!aborted) {
          setNodes(laid.nodes);
          setEdges(laid.edges);
          setStatus('loaded');
        }
      } catch (err) {
        if (!aborted) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load template.');
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
      role="region"
      aria-label="Pipeline template graph — read only"
    >
      <ReactFlow
        nodes={nodes}
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
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
