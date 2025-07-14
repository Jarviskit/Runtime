import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Thread } from "./thread.entity";

export enum ToolStatus {
  Calling = 'Calling',
  Executing = 'Executing',
  WaitingForClientResponse = 'WaitingForClientResponse',
  Completed = 'Completed'
}

@Entity({
  name: 'messages',
  synchronize: true
})
export class Message {
  @PrimaryColumn({ type: 'varchar', length: 36, unique: true })
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: false })
  @ManyToOne(() => Thread, (thread) => thread.id, { nullable: false })
  thread: string | Thread;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  role: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  toolCallId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  toolName: string;

  @Column({ type: 'json', nullable: true })
  toolInput: any;

  @Column({ type: 'json', nullable: true })
  toolResults: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  toolStatus: ToolStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sessionId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}