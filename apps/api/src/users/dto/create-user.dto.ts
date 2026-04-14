import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  /** Slug роли в организации: owner, director, manager, accountant, builder_admin */
  @IsString()
  roleSlug!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
