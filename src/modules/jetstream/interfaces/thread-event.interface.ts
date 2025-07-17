export enum ThreadEventType {
  RUN_STARTED = 'RUN_STARTED',
  RUN_PROGRESS = 'RUN_PROGRESS',
  RUN_COMPLETED = 'RUN_COMPLETED',
  RUN_FAILED = 'RUN_FAILED',
  RUN_CANCELLED = 'RUN_CANCELLED',
}

export interface BaseThreadEvent {
  type: ThreadEventType;
  threadId: string;
  runId: string;
  timestamp: number;
  sequenceId?: number;
}

export interface RunStartedEvent extends BaseThreadEvent {
  type: ThreadEventType.RUN_STARTED;
  payload: {
    userId: string;
    agentId: string;
    inputData: any;
  };
}

export interface RunProgressEvent extends BaseThreadEvent {
  type: ThreadEventType.RUN_PROGRESS;
  payload: {
    progress: number;
    message: string;
    data?: any;
  };
}

export interface RunCompletedEvent extends BaseThreadEvent {
  type: ThreadEventType.RUN_COMPLETED;
  payload: {
    result: any;
    executionTime: number;
  };
}

export interface RunFailedEvent extends BaseThreadEvent {
  type: ThreadEventType.RUN_FAILED;
  payload: {
    error: string;
    stackTrace?: string;
  };
}

export interface RunCancelledEvent extends BaseThreadEvent {
  type: ThreadEventType.RUN_CANCELLED;
  payload: {
    reason: string;
  };
}

export type ThreadEvent = 
  | RunStartedEvent 
  | RunProgressEvent 
  | RunCompletedEvent 
  | RunFailedEvent 
  | RunCancelledEvent;