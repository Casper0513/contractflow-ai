import {
  Controller,
  Get,
  Param,
  Patch,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { PublicEstimatesService } from './public-estimates.service';

@UseGuards(ThrottlerGuard)
@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(
    private readonly publicEstimatesService: PublicEstimatesService,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token/pdf')
  async downloadPdf(
    @Param('token')
    token: string,
  ) {
    const result = await this.publicEstimatesService.getPdfByToken(token);

    return new StreamableFile(result.buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${result.filename}"`,
      length: result.buffer.length,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch(':token/approve')
  approve(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.approveByToken(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch(':token/decline')
  decline(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.declineByToken(token);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.getByToken(token);
  }
}
