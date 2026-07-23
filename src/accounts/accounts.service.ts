import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface TelegramIdentity {
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
}

export interface AccountSummary {
  userId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  balanceCents: number;
}

const accountSummarySelect = {
  username: true,
  firstName: true,
  lastName: true,
  languageCode: true,
  user: {
    select: {
      id: true,
      balanceCents: true,
    },
  },
} satisfies Prisma.TelegramAccountSelect;

type AccountRecord = Prisma.TelegramAccountGetPayload<{
  select: typeof accountSummarySelect;
}>;

type TelegramProfileUpdate = {
  username?: string | null;
  firstName?: string;
  lastName?: string | null;
  languageCode?: string | null;
};

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTelegramAccount(
    identity: TelegramIdentity,
  ): Promise<AccountSummary> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { telegramUserId: identity.telegramUserId },
      select: accountSummarySelect,
    });

    if (account !== null) {
      return this.synchronizeTelegramProfile(account, identity);
    }

    try {
      const createdAccount = await this.prisma.telegramAccount.create({
        data: {
          ...identity,
          user: { create: {} },
        },
        select: accountSummarySelect,
      });

      return this.toSummary(createdAccount);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const concurrentlyCreatedAccount =
        await this.prisma.telegramAccount.findUniqueOrThrow({
          where: { telegramUserId: identity.telegramUserId },
          select: accountSummarySelect,
        });

      return this.synchronizeTelegramProfile(
        concurrentlyCreatedAccount,
        identity,
      );
    }
  }

  private async synchronizeTelegramProfile(
    account: AccountRecord,
    identity: TelegramIdentity,
  ): Promise<AccountSummary> {
    const data = this.getTelegramProfileUpdates(account, identity);
    if (Object.keys(data).length === 0) return this.toSummary(account);

    const updatedAccount = await this.prisma.telegramAccount.update({
      where: { telegramUserId: identity.telegramUserId },
      data,
      select: accountSummarySelect,
    });

    return this.toSummary(updatedAccount);
  }

  private getTelegramProfileUpdates(
    account: AccountRecord,
    identity: TelegramIdentity,
  ): TelegramProfileUpdate {
    const data: TelegramProfileUpdate = {};

    if (account.username !== identity.username) {
      data.username = identity.username;
    }
    if (account.firstName !== identity.firstName) {
      data.firstName = identity.firstName;
    }
    if (account.lastName !== identity.lastName) {
      data.lastName = identity.lastName;
    }
    if (account.languageCode !== identity.languageCode) {
      data.languageCode = identity.languageCode;
    }

    return data;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is PrismaClientKnownRequestError {
    return (
      error instanceof PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }

  private toSummary(account: AccountRecord): AccountSummary {
    return {
      userId: account.user.id,
      username: account.username,
      firstName: account.firstName,
      lastName: account.lastName,
      balanceCents: account.user.balanceCents,
    };
  }
}
