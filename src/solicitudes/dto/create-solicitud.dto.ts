import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { normalizeText } from '../../common/utils/normalize-text.js';

export class CreateSolicitudDto {
  @ApiProperty({
    description: 'Nombre del cliente asociado a la solicitud',
    example: 'Comercial Andina S.A.',
  })
  @Transform(normalizeText)
  @IsString({ message: 'cliente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'cliente es obligatorio y no puede estar vacio' })
  cliente: string;

  @ApiProperty({
    description: 'Motivo de la solicitud comercial',
    example: 'Seguimiento de cotizacion de equipos de computo',
  })
  @Transform(normalizeText)
  @IsString({ message: 'descripcion debe ser una cadena de texto' })
  @IsNotEmpty({
    message: 'descripcion es obligatoria y no puede estar vacia',
  })
  descripcion: string;
}
