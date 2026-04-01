"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OrchestrationConfig } from "@/types/config";

interface UseConfigDrawerReturn {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  config: OrchestrationConfig | null;
  open: () => void;
  close: () => void;
}

export function useConfigDrawer(): UseConfigDrawerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OrchestrationConfig | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setConfig(null);
    setError(null);
    setLoading(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !loading) {
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetch("/api/config", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ error: "Failed to load config" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ config: OrchestrationConfig; rawYaml: string }>;
      })
      .then((json) => {
        if (!controller.signal.aborted) {
          setConfig(json.config);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load config"
        );
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, loading]);

  return {
    isOpen,
    loading,
    error,
    config,
    open,
    close,
  };
}
