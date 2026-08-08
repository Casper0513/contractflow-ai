import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(ClerkAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  getOrganizations(@CurrentUser() authUser: AuthenticatedUser) {
    return this.organizationsService.getForUser(authUser.clerkUserId);
  }

  @Post()
  createOrganization(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateOrganizationDto,
  ) {
    return this.organizationsService.createForOwner(
      authUser.clerkUserId,
      input,
    );
  }
}
