import {
  Body,
  Controller,
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
import { CrewService } from './crew.service';
import { CreateCrewMemberDto } from './dto/create-crew-member.dto';
import { UpdateCrewCapacityDto } from './dto/update-crew-capacity.dto';
import { UpdateCrewMemberDto } from './dto/update-crew-member.dto';

@Controller('crew')
@UseGuards(ClerkAuthGuard, RolesGuard, BillingEntitlementGuard)
@RequiresBillingEntitlement(BillingEntitlement.CORE_OPERATIONS)
export class CrewController {
  constructor(private readonly crewService: CrewService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.crewService.listForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }

  @Get(':crewMemberId')
  getOne(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.getForUser(
      authUser.clerkUserId,
      crewMemberId,
      authUser.activeOrganizationId,
    );
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateCrewMemberDto,
  ) {
    return this.crewService.createForUser(
      authUser.clerkUserId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':crewMemberId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  update(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
    @Body()
    input: UpdateCrewMemberDto,
  ) {
    return this.crewService.updateForUser(
      authUser.clerkUserId,
      crewMemberId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':crewMemberId/capacity')
  @UseGuards(BillingEntitlementGuard)
  @RequiresBillingEntitlement(BillingEntitlement.CAPACITY_PLANNING)
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  updateCapacity(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
    @Body()
    input: UpdateCrewCapacityDto,
  ) {
    return this.crewService.updateCapacityForUser(
      authUser.clerkUserId,
      crewMemberId,
      input.dailyCapacityMinutes ?? null,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':crewMemberId/deactivate')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  deactivate(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.deactivateForUser(
      authUser.clerkUserId,
      crewMemberId,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':crewMemberId/activate')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  activate(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.activateForUser(
      authUser.clerkUserId,
      crewMemberId,
      authUser.activeOrganizationId,
    );
  }
}
