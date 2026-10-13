import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

@Entity('solicitudes')
export class Solicitud {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  cliente: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 60 })
  asesor: string;

  @Column({
    type: 'simple-enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @CreateDateColumn({ type: 'datetime' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'datetime' })
  actualizadaEn: Date;
}
