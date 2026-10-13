import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { normalizeText } from '../../common/utils/normalize-text.js';

export class AsignarSolicitudDto {
  @ApiProperty({
    description:
      'Identificador del asesor al que se asigna la solicitud. Debe existir en el catalogo con rol asesor.',
    example: 'asesor02',
  })
  @Transform(normalizeText)
  @IsString({ message: 'asesor debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'asesor es obligatorio y no puede estar vacio' })
  asesor: string;
}
