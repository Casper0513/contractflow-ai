import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiService } from './ai.service';
import { AnalyzeJobDispatchDto } from './dto/analyze-job-dispatch.dto';
import { AskAiDto } from './dto/ask-ai.dto';

@Controller('ai')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  ask(@CurrentUser() authUser: AuthenticatedUser, @Body() input: AskAiDto) {
    return this.aiService.askForUser(
      authUser.clerkUserId,
      input.message,
      input.history ?? [],
      authUser.activeOrganizationId,
    );
  }

  @Post('jobs/:jobId/dispatch-analysis')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  analyzeJobDispatch(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: AnalyzeJobDispatchDto,
  ) {
    return this.aiService.analyzeJobDispatchForUser(
      authUser.clerkUserId,
      jobId,
      input.candidates,
      authUser.activeOrganizationId,
    );
  }

  @Post('jobs/:jobId/schedule-suggestion')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  suggestJobSchedule(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.suggestJobScheduleForUser(
      authUser.clerkUserId,
      jobId,
      authUser.activeOrganizationId,
    );
  }

  @Post('jobs/:jobId/task-suggestion')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  suggestJobTask(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.suggestJobTaskForUser(
      authUser.clerkUserId,
      jobId,
      authUser.activeOrganizationId,
    );
  }

  @Post('jobs/:jobId/summary')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  summarizeJob(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.summarizeJobForUser(
      authUser.clerkUserId,
      jobId,
      authUser.activeOrganizationId,
    );
  }

  @Post('customers/:customerId/summary')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  summarizeCustomer(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.aiService.summarizeCustomerForUser(
      authUser.clerkUserId,
      customerId,
      authUser.activeOrganizationId,
    );
  }

  @Post('customers/:customerId/follow-up-suggestion')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  suggestCustomerFollowUp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.aiService.suggestCustomerFollowUpForUser(
      authUser.clerkUserId,
      customerId,
      authUser.activeOrganizationId,
    );
  }

  @Post('estimates/:estimateId/intelligence')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  analyzeEstimate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('estimateId') estimateId: string,
  ) {
    return this.aiService.analyzeEstimateForUser(
      authUser.clerkUserId,
      estimateId,
      authUser.activeOrganizationId,
    );
  }

  @Post('estimates/:estimateId/send-draft')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  draftEstimateSend(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('estimateId') estimateId: string,
  ) {
    return this.aiService.draftEstimateSendForUser(
      authUser.clerkUserId,
      estimateId,
      authUser.activeOrganizationId,
    );
  }

  @Post('invoices/:invoiceId/intelligence')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  analyzeInvoice(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.aiService.analyzeInvoiceForUser(
      authUser.clerkUserId,
      invoiceId,
      authUser.activeOrganizationId,
    );
  }

  @Post('invoices/:invoiceId/follow-up-draft')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  draftInvoiceFollowUp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.aiService.draftInvoiceFollowUpForUser(
      authUser.clerkUserId,
      invoiceId,
      authUser.activeOrganizationId,
    );
  }
}
