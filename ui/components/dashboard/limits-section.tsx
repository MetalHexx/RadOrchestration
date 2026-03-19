"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface LimitsSectionProps {
  maxPhases: number;
  maxTasksPerPhase: number;
  maxRetriesPerTask: number;
}

export function LimitsSection({ maxPhases, maxTasksPerPhase, maxRetriesPerTask }: LimitsSectionProps) {
  return (
    <Card>
      <CardContent className="py-0">
        <Accordion defaultValue={[]}>
          <AccordionItem>
            <AccordionTrigger>Pipeline Limits</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Max Phases</span>
                  <span className="font-mono">{maxPhases}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Tasks per Phase</span>
                  <span className="font-mono">{maxTasksPerPhase}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Retries per Task</span>
                  <span className="font-mono">{maxRetriesPerTask}</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
