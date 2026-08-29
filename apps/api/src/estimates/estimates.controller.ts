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
import { AddEstimateMaterialsDto } from './dto/add-estimate-materials.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { SendEstimateDto } from './dto/send-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { EstimateDeliveryService } from './estimate-delivery.service';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly estimateDeliveryService: EstimateDeliveryService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.estimatesService.listForUser(authUser.clerkUserId);
  }

  @Get('job/:jobId')
  listForJob(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.estimatesService.listForJobForUser(authUser.clerkUserId, jobId);
  }

  @Get('customer/:customerId')
  listForCustomer(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('customerId')
    customerId: string,
  ) {
    return this.estimatesService.listForCustomerForUser(
      authUser.clerkUserId,
      customerId,
    );
  }

  @Get(':id')
  getById(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.getByIdForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateEstimateDto,
  ) {
    return this.estimatesService.createForUser(authUser.clerkUserId, input);
  }

  @Post(':id/materials')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  addMaterials(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
    @Body()
    input: AddEstimateMaterialsDto,
  ) {
    return this.estimatesService.addMaterialsForUser(
      authUser.clerkUserId,
      estimateId,
      input,
    );
  }

  @Patch(':id')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  update(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
    @Body()
    input: UpdateEstimateDto,
  ) {
    return this.estimatesService.updateForUser(
      authUser.clerkUserId,
      estimateId,
      input,
    );
  }

  @Patch(':id/send')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  send(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
    @Body()
    input: SendEstimateDto,
  ) {
    return this.estimateDeliveryService.sendForUser(
      authUser.clerkUserId,
      estimateId,
      input,
    );
  }

  @Patch(':id/view')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  view(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.viewForUser(authUser.clerkUserId, estimateId);
  }

  @Patch(':id/approve')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  approve(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.approveForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Patch(':id/decline')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  decline(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.declineForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Patch(':id/expire')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  expire(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.expireForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }
}
