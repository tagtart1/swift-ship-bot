import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService, type TelegramIdentity } from './accounts.service';

describe('AccountsService', () => {
  const identity: TelegramIdentity = {
    telegramUserId: '123456789',
    username: 'swift_shipper',
    firstName: 'Swift',
    lastName: 'Shipper',
    languageCode: 'en',
  };

  const accountRecord = {
    username: identity.username,
    firstName: identity.firstName,
    lastName: identity.lastName,
    languageCode: identity.languageCode,
    user: {
      id: '89dffb8c-95fe-4abd-8bc6-1dc824117777',
      balanceCents: 12300,
    },
  };

  const expectedAccountSelect = {
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
  } as const;

  function createService() {
    const findUnique = jest.fn<
      Promise<typeof accountRecord | null>,
      [Prisma.TelegramAccountFindUniqueArgs]
    >();
    const findUniqueOrThrow = jest.fn<
      Promise<typeof accountRecord>,
      [Prisma.TelegramAccountFindUniqueOrThrowArgs]
    >();
    const create = jest.fn<
      Promise<typeof accountRecord>,
      [Prisma.TelegramAccountCreateArgs]
    >();
    const update = jest.fn<
      Promise<typeof accountRecord>,
      [Prisma.TelegramAccountUpdateArgs]
    >();
    const prisma = {
      telegramAccount: { findUnique, findUniqueOrThrow, create, update },
    } as unknown as PrismaService;

    return {
      service: new AccountsService(prisma),
      findUnique,
      findUniqueOrThrow,
      create,
      update,
    };
  }

  it('returns an existing account without writing when its profile matches', async () => {
    const { service, findUnique, create, update } = createService();
    findUnique.mockResolvedValue(accountRecord);

    await expect(service.ensureTelegramAccount(identity)).resolves.toEqual({
      userId: accountRecord.user.id,
      username: identity.username,
      firstName: identity.firstName,
      lastName: identity.lastName,
      balanceCents: 12300,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { telegramUserId: '123456789' },
      select: expectedAccountSelect,
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a user and Telegram account when none exists', async () => {
    const { service, findUnique, create, update } = createService();
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(accountRecord);

    await expect(service.ensureTelegramAccount(identity)).resolves.toEqual(
      expect.objectContaining({
        userId: accountRecord.user.id,
        balanceCents: 12300,
      }),
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        ...identity,
        user: { create: {} },
      },
      select: expectedAccountSelect,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only Telegram profile fields that changed', async () => {
    const { service, findUnique, update } = createService();
    const identityWithoutOptionalFields = {
      ...identity,
      username: null,
      lastName: null,
      languageCode: null,
    };
    const updatedAccount = {
      ...accountRecord,
      username: null,
      lastName: null,
      languageCode: null,
    };
    findUnique.mockResolvedValue(accountRecord);
    update.mockResolvedValue(updatedAccount);

    await service.ensureTelegramAccount(identityWithoutOptionalFields);

    expect(update).toHaveBeenCalledWith({
      where: { telegramUserId: identity.telegramUserId },
      data: {
        username: null,
        lastName: null,
        languageCode: null,
      },
      select: expectedAccountSelect,
    });
  });

  it('recovers from a concurrent account creation', async () => {
    const { service, findUnique, findUniqueOrThrow, create, update } =
      createService();
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.8.0',
      }),
    );
    findUniqueOrThrow.mockResolvedValue({
      ...accountRecord,
      username: 'old_username',
    });
    update.mockResolvedValue(accountRecord);

    await expect(service.ensureTelegramAccount(identity)).resolves.toEqual(
      expect.objectContaining({
        userId: accountRecord.user.id,
        username: identity.username,
      }),
    );

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { telegramUserId: identity.telegramUserId },
      select: expectedAccountSelect,
    });
    expect(update).toHaveBeenCalledWith({
      where: { telegramUserId: identity.telegramUserId },
      data: { username: identity.username },
      select: expectedAccountSelect,
    });
  });

  it('does not hide non-unique-constraint creation errors', async () => {
    const { service, findUnique, findUniqueOrThrow, create, update } =
      createService();
    const error = new Error('database unavailable');
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(error);

    await expect(service.ensureTelegramAccount(identity)).rejects.toBe(error);
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
