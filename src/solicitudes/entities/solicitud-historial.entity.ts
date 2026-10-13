import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from '../enums/tipo-evento-historial.enum.js';
import { Solicitud } from './solicitud.entity.js';

@Entity('solicitud_historial')
@Index(['solicitudId', 'fechaEvento'])
export class SolicitudHistorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'solicitud_id', type: 'varchar', length: 36 })
  solicitudId: string;

  @ManyToOne(() => Solicitud, (solicitud) => solicitud.historial, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: Solicitud;

  @Column({ name: 'tipo_evento', type: 'simple-enum', enum: TipoEventoHistorial })
  tipoEvento: TipoEventoHistorial;

  @Column({
    name: 'estado_anterior',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  estadoAnterior: EstadoSolicitud | null;

  @Column({
    name: 'estado_nuevo',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  estadoNuevo: EstadoSolicitud | null;

  @Column({
    name: 'asesor_anterior',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  asesorAnterior: string | null;

  @Column({
    name: 'asesor_nuevo',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  asesorNuevo: string | null;

  @Column({ type: 'varchar', length: 60 })
  usuario: string;

  @Column({ type: 'text', nullable: true })
  detalle: string | null;

  @Column({ name: 'fecha_evento', type: 'datetime' })
  fechaEvento: Date;
}
