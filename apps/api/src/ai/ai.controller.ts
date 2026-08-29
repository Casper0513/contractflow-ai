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

  @Post('jobs/:jobId/summary')
  summarizeJob(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.summarizeJobForUser(authUser.clerkUserId, jobId);
  }
}
