import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';
import { SolicitudHistorial } from './solicitud-historial.entity.js';

@Entity('solicitudes')
export class Solicitud {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  cliente: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Index()
  @Column({ type: 'varchar', length: 60, nullable: true })
  asesor: string | null;

  @Index()
  @Column({
    type: 'simple-enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'datetime' })
  actualizadaEn: Date;

  @OneToMany(() => SolicitudHistorial, (historial) => historial.solicitud)
  historial: SolicitudHistorial[];
}
