import { Controller, Get, Param, Patch, StreamableFile } from '@nestjs/common';

import { PublicEstimatesService } from './public-estimates.service';

@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(
    private readonly publicEstimatesService: PublicEstimatesService,
  ) {}

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

  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicEstimatesService.getByToken(token);
  }
}
