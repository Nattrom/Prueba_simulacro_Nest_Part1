import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSolicitudDto {
  @ApiProperty({
    description: 'Nombre del cliente asociado a la solicitud',
    example: 'Comercial Andina S.A.',
  })
  @Transform(trimString)
  @IsString({ message: 'cliente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'cliente es obligatorio y no puede estar vacio' })
  cliente: string;

  @ApiProperty({
    description: 'Motivo de la solicitud comercial',
    example: 'Seguimiento de cotizacion de equipos de computo',
  })
  @Transform(trimString)
  @IsString({ message: 'descripcion debe ser una cadena de texto' })
  @IsNotEmpty({
    message: 'descripcion es obligatoria y no puede estar vacia',
  })
  descripcion: string;

  @ApiPropertyOptional({
    description:
      'Identificador del asesor responsable. Obligatorio para admin y supervisor. Un asesor solo puede registrar a su propio nombre.',
    example: 'asesor02',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'asesor debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'asesor no puede estar vacio cuando se envia' })
  asesor?: string;
}
