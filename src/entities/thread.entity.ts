import { ThreadMode } from "src/shared/enum";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({
  name: 'threads',
  synchronize: true
})
export class Thread {
  @PrimaryColumn({ type: 'varchar', length: 36, unique: true })
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  namespace: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  agentName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 24, nullable: false, default: ThreadMode.MANUAL })
  mode: ThreadMode;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'int', nullable: true, default: 0 })
  numOfMessages: number;

  @Column({ type: 'boolean', nullable: false, default: false })
  isLocked: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentSessionId: string;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt: Date;
}