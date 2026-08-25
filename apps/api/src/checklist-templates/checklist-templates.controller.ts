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

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChecklistTemplatesService } from './checklist-templates.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { UpdateChecklistTemplateDto } from './dto/update-checklist-template.dto';

@Controller('checklist-templates')
@UseGuards(ClerkAuthGuard)
export class ChecklistTemplatesController {
  constructor(
    private readonly checklistTemplatesService: ChecklistTemplatesService,
  ) {}

  @Get()
  list(@CurrentUser() authUser: AuthenticatedUser) {
    return this.checklistTemplatesService.listForUser(authUser.clerkUserId);
  }

  @Get(':templateId')
  getOne(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('templateId') templateId: string,
  ) {
    return this.checklistTemplatesService.getForUser(
      authUser.clerkUserId,
      templateId,
    );
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateChecklistTemplateDto,
  ) {
    return this.checklistTemplatesService.createForUser(
      authUser.clerkUserId,
      input,
    );
  }

  @Patch(':templateId')
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body() input: UpdateChecklistTemplateDto,
  ) {
    return this.checklistTemplatesService.updateForUser(
      authUser.clerkUserId,
      templateId,
      input,
    );
  }

  @Patch(':templateId/activate')
  activate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('templateId') templateId: string,
  ) {
    return this.checklistTemplatesService.activateForUser(
      authUser.clerkUserId,
      templateId,
    );
  }

  @Patch(':templateId/deactivate')
  deactivate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('templateId') templateId: string,
  ) {
    return this.checklistTemplatesService.deactivateForUser(
      authUser.clerkUserId,
      templateId,
    );
  }

  @Delete(':templateId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('templateId') templateId: string,
  ) {
    return this.checklistTemplatesService.deleteForUser(
      authUser.clerkUserId,
      templateId,
    );
  }
}
