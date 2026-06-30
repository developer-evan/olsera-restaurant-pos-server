import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import { StoreMemberRole } from '../../organizations/enums/organization.enum';

const invitableRoles = [
  StoreMemberRole.MANAGER,
  StoreMemberRole.CASHIER,
  StoreMemberRole.KITCHEN,
];

export class CreateStoreInviteDto {
  @ApiProperty({ example: 'cashier@coffee.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: invitableRoles, example: StoreMemberRole.CASHIER })
  @IsIn(invitableRoles)
  role: StoreMemberRole;
}
