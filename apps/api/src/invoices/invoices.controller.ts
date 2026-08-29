import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { SendInvoiceFollowUpDto } from './dto/send-invoice-follow-up.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ImportInvoiceMaterialsDto } from './dto/import-invoice-materials.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Query('q')
    query?: string,
    @Query('status')
    status?: string,
    @Query('sort')
    sort?: string,
  ) {
    return this.invoicesService.listForUser(authUser.clerkUserId, {
      query,
      status,
      sort,
    });
  }

  @Get('summary')
  summary(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.invoicesService.getSummaryForUser(authUser.clerkUserId);
  }

  @Get('job/:jobId')
  listForJob(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.invoicesService.listForJobForUser(authUser.clerkUserId, jobId);
  }

  @Get('customer/:customerId')
  listForCustomer(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('customerId')
    customerId: string,
  ) {
    return this.invoicesService.listForCustomerForUser(
      authUser.clerkUserId,
      customerId,
    );
  }

  @Get(':id')
  getById(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
  ) {
    return this.invoicesService.getByIdForUser(authUser.clerkUserId, invoiceId);
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
    input: CreateInvoiceDto,
  ) {
    return this.invoicesService.createForUser(authUser.clerkUserId, input);
  }

  @Post('from-estimate/:estimateId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  createFromEstimate(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('estimateId')
    estimateId: string,
  ) {
    return this.invoicesService.createFromEstimateForUser(
      authUser.clerkUserId,
      estimateId,
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
    invoiceId: string,
    @Body()
    input: UpdateInvoiceDto,
  ) {
    return this.invoicesService.updateForUser(
      authUser.clerkUserId,
      invoiceId,
      input,
    );
  }

  @Post(':id/materials')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  importMaterials(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
    @Body()
    input: ImportInvoiceMaterialsDto,
  ) {
    return this.invoicesService.importMaterialsForUser(
      authUser.clerkUserId,
      invoiceId,
      input.materialIds,
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
    invoiceId: string,
  ) {
    return this.invoicesService.sendForUser(authUser.clerkUserId, invoiceId);
  }

  @Post(':id/follow-up')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  sendFollowUp(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
    @Body()
    input: SendInvoiceFollowUpDto,
  ) {
    return this.invoicesService.sendManualFollowUpForUser(
      authUser.clerkUserId,
      invoiceId,
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
    invoiceId: string,
  ) {
    return this.invoicesService.viewForUser(authUser.clerkUserId, invoiceId);
  }

  @Patch(':id/overdue')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  markOverdue(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
  ) {
    return this.invoicesService.markOverdueForUser(
      authUser.clerkUserId,
      invoiceId,
    );
  }

  @Patch(':id/void')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  voidInvoice(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
  ) {
    return this.invoicesService.voidForUser(authUser.clerkUserId, invoiceId);
  }

  @Post(':id/payments')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  recordPayment(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
    @Body()
    input: RecordPaymentDto,
  ) {
    return this.invoicesService.recordPaymentForUser(
      authUser.clerkUserId,
      invoiceId,
      input,
    );
  }

  @Patch(':id/payments/:paymentId/void')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  voidPayment(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id')
    invoiceId: string,
    @Param('paymentId')
    paymentId: string,
  ) {
    return this.invoicesService.voidPaymentForUser(
      authUser.clerkUserId,
      invoiceId,
      paymentId,
    );
  }
}
