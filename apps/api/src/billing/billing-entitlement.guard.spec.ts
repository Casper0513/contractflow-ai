import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '../auth/authenticated-user';

jest.mock('../auth/organization-membership.service', () => ({
  OrganizationMembershipService: class OrganizationMembershipService {},
}));

jest.mock('./billing-entitlement.service', () => ({
  BillingEntitlementService: class BillingEntitlementService {},
}));

import { BillingEntitlementGuard } from './billing-entitlement.guard';
import { BillingEntitlement } from './billing-entitlement.policy';
import { BillingEntitlementService } from './billing-entitlement.service';

describe('BillingEntitlementGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const organizationMemberships = {
    resolveForUser: jest.fn(),
  };

  const billingEntitlements = {
    hasEntitlementForOrganization: jest.fn(),
  };

  let guard: BillingEntitlementGuard;

  const authUser: AuthenticatedUser = {
    clerkUserId: 'user_1',
    sessionId: 'session_1',
    activeOrganizationId: 'org_1',
  };

  function makeContext(
    request: { authUser?: AuthenticatedUser } = { authUser },
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new BillingEntitlementGuard(
      reflector as unknown as Reflector,
      organizationMemberships,
      billingEntitlements as unknown as BillingEntitlementService,
    );
  });

  it('allows routes without billing entitlement metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);

    expect(organizationMemberships.resolveForUser).not.toHaveBeenCalled();

    expect(
      billingEntitlements.hasEntitlementForOrganization,
    ).not.toHaveBeenCalled();
  });

  it('requires an authenticated user when entitlement metadata exists', async () => {
    reflector.getAllAndOverride.mockReturnValue(BillingEntitlement.AI_FEATURES);

    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed when no organization membership exists', async () => {
    reflector.getAllAndOverride.mockReturnValue(BillingEntitlement.AI_FEATURES);

    organizationMemberships.resolveForUser.mockRejectedValue(
      new NotFoundException('No organization membership found'),
    );

    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('preserves membership resolver authorization failures', async () => {
    reflector.getAllAndOverride.mockReturnValue(BillingEntitlement.AI_FEATURES);

    const error = new ForbiddenException(
      'You do not belong to the selected organization',
    );

    organizationMemberships.resolveForUser.mockRejectedValue(error);

    await expect(guard.canActivate(makeContext())).rejects.toBe(error);
  });

  it('denies the request when the organization lacks the entitlement', async () => {
    reflector.getAllAndOverride.mockReturnValue(BillingEntitlement.AI_FEATURES);

    organizationMemberships.resolveForUser.mockResolvedValue({
      id: 'membership_1',
      userId: 'db_user_1',
      organizationId: 'org_1',
      role: 'OWNER',
    });

    billingEntitlements.hasEntitlementForOrganization.mockResolvedValue(false);

    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      'Your ContractFlow subscription does not include this feature',
    );

    expect(
      billingEntitlements.hasEntitlementForOrganization,
    ).toHaveBeenCalledWith('org_1', BillingEntitlement.AI_FEATURES);
  });

  it('allows the request when the organization has the entitlement', async () => {
    reflector.getAllAndOverride.mockReturnValue(BillingEntitlement.AI_FEATURES);

    organizationMemberships.resolveForUser.mockResolvedValue({
      id: 'membership_1',
      userId: 'db_user_1',
      organizationId: 'org_1',
      role: 'OWNER',
    });

    billingEntitlements.hasEntitlementForOrganization.mockResolvedValue(true);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);

    expect(organizationMemberships.resolveForUser).toHaveBeenCalledWith(
      'user_1',
      'org_1',
    );

    expect(
      billingEntitlements.hasEntitlementForOrganization,
    ).toHaveBeenCalledWith('org_1', BillingEntitlement.AI_FEATURES);
  });
});
