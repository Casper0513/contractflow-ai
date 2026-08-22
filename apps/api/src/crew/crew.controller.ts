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
import { CrewService } from './crew.service';
import { CreateCrewMemberDto } from './dto/create-crew-member.dto';
import { UpdateCrewMemberDto } from './dto/update-crew-member.dto';

@Controller('crew')
@UseGuards(ClerkAuthGuard)
export class CrewController {
  constructor(private readonly crewService: CrewService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.crewService.listForUser(authUser.clerkUserId);
  }

  @Get(':crewMemberId')
  getOne(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.getForUser(authUser.clerkUserId, crewMemberId);
  }

  @Post()
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateCrewMemberDto,
  ) {
    return this.crewService.createForUser(authUser.clerkUserId, input);
  }

  @Patch(':crewMemberId')
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
    );
  }

  @Patch(':crewMemberId/deactivate')
  deactivate(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.deactivateForUser(
      authUser.clerkUserId,
      crewMemberId,
    );
  }

  @Patch(':crewMemberId/activate')
  activate(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.crewService.activateForUser(authUser.clerkUserId, crewMemberId);
  }
}
