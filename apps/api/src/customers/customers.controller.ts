import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/authenticated-user";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Controller("customers")
@UseGuards(ClerkAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
  ) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
  ) {
    return this.customersService.listForUser(
      authUser.clerkUserId,
    );
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateCustomerDto,
  ) {
    return this.customersService.createForUser(
      authUser.clerkUserId,
      input,
    );
  }
}
