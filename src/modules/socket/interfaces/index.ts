import { BaseEvent } from "@ag-ui/core";


export interface AGUIEvent {
  threadId: string;
  sessionId: string;
  event: BaseEvent & any;
  metadata: Record<string, any>;
  order: number;
}
