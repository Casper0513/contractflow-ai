import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddEstimateMaterialsDto } from './dto/add-estimate-materials.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { SendEstimateDto } from './dto/send-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { EstimateDeliveryService } from './estimate-delivery.service';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
@UseGuards(ClerkAuthGuard)
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
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateEstimateDto,
  ) {
    return this.estimatesService.createForUser(authUser.clerkUserId, input);
  }

  @Post(':id/materials')
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
  view(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    estimateId: string,
  ) {
    return this.estimatesService.viewForUser(authUser.clerkUserId, estimateId);
  }

  @Patch(':id/approve')
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
