import { IsNotEmpty, IsString, IsArray, ArrayMinSize, ArrayUnique, IsEnum } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class AssignRolesDto {
  @IsString()
  @IsNotEmpty()
  firebaseUid: string; // The Firebase UID of the user to assign roles to

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Role, { each: true }) // Ensure each item in the array is a valid Role enum value
  roles: Role[]; // Array of roles to assign
}