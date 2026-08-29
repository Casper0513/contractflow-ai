import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService } from './ai.service';
import { AskAiDto } from './dto/ask-ai.dto';

@Controller('ai')
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  ask(@CurrentUser() authUser: AuthenticatedUser, @Body() input: AskAiDto) {
    return this.aiService.askForUser(
      authUser.clerkUserId,
      input.message,
      input.history ?? [],
    );
  }

  @Post('jobs/:jobId/task-suggestion')
  suggestJobTask(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.suggestJobTaskForUser(authUser.clerkUserId, jobId);
  }

  @Post('jobs/:jobId/summary')
  summarizeJob(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.summarizeJobForUser(authUser.clerkUserId, jobId);
  }

  @Post('customers/:customerId/summary')
  summarizeCustomer(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.aiService.summarizeCustomerForUser(
      authUser.clerkUserId,
      customerId,
    );
  }

  @Post('customers/:customerId/follow-up-suggestion')
  suggestCustomerFollowUp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.aiService.suggestCustomerFollowUpForUser(
      authUser.clerkUserId,
      customerId,
    );
  }

  @Post('estimates/:estimateId/intelligence')
  analyzeEstimate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('estimateId') estimateId: string,
  ) {
    return this.aiService.analyzeEstimateForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Post('estimates/:estimateId/send-draft')
  draftEstimateSend(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('estimateId') estimateId: string,
  ) {
    return this.aiService.draftEstimateSendForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Post('invoices/:invoiceId/intelligence')
  analyzeInvoice(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.aiService.analyzeInvoiceForUser(
      authUser.clerkUserId,
      invoiceId,
    );
  }

  @Post('invoices/:invoiceId/follow-up-draft')
  draftInvoiceFollowUp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.aiService.draftInvoiceFollowUpForUser(
      authUser.clerkUserId,
      invoiceId,
    );
  }
}
