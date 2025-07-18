import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({
  name: 'sessions',
  synchronize: true
})
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, unique: true })
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  threadId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  namespace: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  agentName: string;

  @Column({ type: 'json', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date;
}