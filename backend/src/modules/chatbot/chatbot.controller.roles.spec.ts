import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ChatbotController } from './chatbot.controller';

/**
 * Cổng role của endpoint thực thi phiếu AI phải khớp với quyền từng loại phiếu trong
 * AgentActionService: thiếu TECHNICIAN thì Kỹ thuật viên không lưu được số đo nước qua chat.
 */
describe('ChatbotController execute-action roles', () => {
  const roles = new Reflector().get<string[]>(ROLES_KEY, ChatbotController.prototype.executeAgentAction);

  it('lets FARM_MANAGER (create farm/pond/crop, import) and TECHNICIAN (water record) through', () => {
    expect(roles).toEqual(expect.arrayContaining(['FARM_MANAGER', 'TECHNICIAN']));
  });

  it('does not let roles with no executable action through', () => {
    expect(roles).not.toContain('FARMER');
    expect(roles).not.toContain('ADMIN');
  });
});
