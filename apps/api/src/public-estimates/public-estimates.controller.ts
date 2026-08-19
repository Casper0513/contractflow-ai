import { Controller, Get, Param, Patch } from '@nestjs/common';

import { PublicEstimatesService } from './public-estimates.service';

@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(
    private readonly publicEstimatesService: PublicEstimatesService,
  ) {}

  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.getByToken(token);
  }

  @Patch(':token/approve')
  approve(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.approveByToken(token);
  }

  @Patch(':token/decline')
  decline(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.declineByToken(token);
  }
}
