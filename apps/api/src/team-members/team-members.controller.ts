import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BillingEntitlementGuard } from '../billing/billing-entitlement.guard';
import { BillingEntitlement } from '../billing/billing-entitlement.policy';
import { RequiresBillingEntitlement } from '../billing/requires-billing-entitlement.decorator';
import { InviteTeamMemberDto } from './dto/invite-team-member.dto';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto';
import { TeamMembersService } from './team-members.service';

@Controller('team-members')
@UseGuards(ClerkAuthGuard, RolesGuard, BillingEntitlementGuard)
@RequiresBillingEntitlement(BillingEntitlement.CORE_OPERATIONS)
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.teamMembersService.listForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }

  @Get('invitations')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  listInvitations(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.teamMembersService.listInvitationsForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }

  @Post('invitations')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  invite(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: InviteTeamMemberDto,
  ) {
    return this.teamMembersService.inviteForUser(
      authUser.clerkUserId,
      input.email,
      input.role,
      authUser.activeOrganizationId,
    );
  }

  @Delete('invitations/:invitationId')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  revokeInvitation(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('invitationId')
    invitationId: string,
  ) {
    return this.teamMembersService.revokeInvitationForUser(
      authUser.clerkUserId,
      invitationId,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':membershipId/role')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  updateRole(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('membershipId')
    membershipId: string,
    @Body()
    input: UpdateTeamMemberRoleDto,
  ) {
    return this.teamMembersService.updateRoleForUser(
      authUser.clerkUserId,
      membershipId,
      input.role,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':membershipId')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  remove(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('membershipId')
    membershipId: string,
  ) {
    return this.teamMembersService.removeForUser(
      authUser.clerkUserId,
      membershipId,
      authUser.activeOrganizationId,
    );
  }
}
