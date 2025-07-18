import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({
  name: 'agents',
  synchronize: true
})
export class AgentEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, unique: true })
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  namespace: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  tools: string[];

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 64, nullable: false })
  createdBy: string;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}