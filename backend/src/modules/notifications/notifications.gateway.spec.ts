import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('emits new support tickets to the admin room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as any;

    gateway.sendSupportTicketCreated({ id: 'ticket-id' });

    expect(to).toHaveBeenCalledWith('role_ADMIN');
    expect(emit).toHaveBeenCalledWith('supportTicketCreated', {
      id: 'ticket-id',
    });
  });

  it('emits ticket updates to admins and the requester', () => {
    const emit = jest.fn();
    const secondRoom = { emit };
    const firstRoom = { to: jest.fn().mockReturnValue(secondRoom) };
    const to = jest.fn().mockReturnValue(firstRoom);
    gateway.server = { to } as any;

    gateway.sendSupportTicketUpdated('requester-id', { id: 'ticket-id' });

    expect(to).toHaveBeenCalledWith('role_ADMIN');
    expect(firstRoom.to).toHaveBeenCalledWith('user_requester-id');
    expect(emit).toHaveBeenCalledWith('supportTicketUpdated', {
      id: 'ticket-id',
    });
  });
});
