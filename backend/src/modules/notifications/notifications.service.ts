import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationLevel, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) { }

  async createWelcomeNotification(userId: string) {
    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      level: NotificationLevel.INFO,
      title: 'Chào mừng đến với SSFM',
      message: 'Chào mừng bạn đã đến với Smart Shrimp Farm Management System.',
    };
    const notification = await this.prisma.notification.create({ data });

    // Real-time emit
    this.gateway.sendNotificationToUser(userId, notification);

    return notification;
  }

  /**
   * Gửi thông báo cho Farmer hoặc Technician khi họ xác nhận tham gia trang trại thành công
   */
  async createFarmJoinNotification(userId: string, farmId: string, farmName: string, role?: string) {
    const isTech = role === 'TECHNICIAN';
    const isFarmer = role === 'FARMER';

    let message = `Chào mừng bạn gia nhập trang trại "${farmName}".`;
    if (isTech) {
      message = `Chào mừng bạn gia nhập trang trại "${farmName}" với vai trò Kỹ Thuật Viên (Technician). Chúc bạn làm việc hiệu quả!`;
    } else if (isFarmer) {
      message = `Chào mừng bạn gia nhập trang trại "${farmName}" với vai trò Nông Dân (Farmer). Chúc bạn một vụ mùa bội thu!`;
    }

    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      level: NotificationLevel.INFO,
      title: `Gia nhập trang trại ${farmName}`,
      message,
    };
    const notification = await this.prisma.notification.create({ data });

    // Real-time emit qua WebSocket
    this.gateway.sendNotificationToUser(userId, notification);

    return notification;
  }

  async createDisasterNotification(userId: string, farmId: string, level: NotificationLevel, title: string, message: string) {
    // Để tránh trùng lặp thông báo thiên tai cùng ngày cho cùng 1 farm
    const where: Prisma.NotificationWhereInput = {
      userId,
      farmId,
      title,
      message,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    };
    const exists = await this.prisma.notification.findFirst({ where });

    if (exists) return exists;

    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      level,
      title,
      message,
    };
    const notification = await this.prisma.notification.create({ data });

    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  /**
   * Gửi thông báo cho Tech/Farmer khi được Manager mời vào trang trại (Nhánh A - đã có tài khoản)
   */
  async createFarmInviteNotification(
    userId: string,
    farmId: string,
    farmName: string,
    managerName: string,
    role?: string,
  ) {
    const isTech = role === 'TECHNICIAN';
    const isFarmer = role === 'FARMER';
    const roleLabel = isTech ? 'Kỹ Thuật Viên' : isFarmer ? 'Nông Dân' : 'nhân sự';

    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      level: NotificationLevel.INFO,
      title: `Lời mời tham gia trang trại ${farmName}`,
      message: `Quản lý ${managerName} đã mời bạn tham gia trang trại "${farmName}" với vai trò ${roleLabel}. Vui lòng xác nhận qua email hoặc đăng nhập để tham gia.`,
    };
    const notification = await this.prisma.notification.create({ data });
    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  /**
   * Gửi thông báo cho Manager khi Tech/Farmer chấp nhận lời mời tham gia trang trại
   */
  async createStaffJoinedNotification(
    managerId: string,
    farmId: string,
    staffName: string,
    staffEmail: string,
    role: string,
    farmName: string,
  ) {
    const isTech = role === 'TECHNICIAN';
    const isFarmer = role === 'FARMER';
    const roleLabel = isTech ? 'Kỹ Thuật Viên' : isFarmer ? 'Nông Dân' : role;
    const title = isTech
      ? `Kỹ thuật viên mới đã tham gia trang trại`
      : isFarmer
        ? `Nông dân mới đã tham gia trang trại`
        : `Thành viên mới đã tham gia trang trại`;

    const staffDisplayName = staffName && staffName !== staffEmail ? `${staffName} (${staffEmail})` : (staffName || staffEmail);
    const message = `${roleLabel} ${staffDisplayName} đã chấp nhận lời mời và chính thức tham gia vào trang trại "${farmName}" của bạn.`;

    const data: Prisma.NotificationUncheckedCreateInput = {
      userId: managerId,
      farmId,
      level: NotificationLevel.INFO,
      title,
      message,
    };
    const notification = await this.prisma.notification.create({ data });
    this.gateway.sendNotificationToUser(managerId, notification);
    return notification;
  }

  /**
   * Thông báo cho Manager khi tạo thành công Trang trại
   */
  async createFarmCreatedNotification(userId: string, farmId: string, farmName: string) {
    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      level: NotificationLevel.INFO,
      title: 'Tạo trang trại thành công',
      message: `Trang trại "${farmName}" đã được tạo thành công trên hệ thống.`,
    };
    const notification = await this.prisma.notification.create({ data });
    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  /**
   * Thông báo cho Manager khi tạo thành công Ao nuôi
   */
  async createPondCreatedNotification(
    userId: string,
    pondId: string,
    pondName: string,
    farmId: string,
    farmName: string,
  ) {
    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      pondId,
      level: NotificationLevel.INFO,
      title: 'Tạo ao nuôi thành công',
      message: `Ao nuôi "${pondName}" thuộc trang trại "${farmName}" đã được tạo thành công.`,
    };
    const notification = await this.prisma.notification.create({ data });
    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  /**
   * Thông báo cho Manager khi tạo thành công Vụ nuôi
   */
  async createCropCreatedNotification(
    userId: string,
    pondId: string,
    pondName: string,
    farmId: string,
    farmName: string,
  ) {
    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      farmId,
      pondId,
      level: NotificationLevel.INFO,
      title: 'Tạo vụ nuôi thành công',
      message: `Vụ nuôi mới tại ao "${pondName}" (${farmName}) đã được tạo thành công.`,
    };
    const notification = await this.prisma.notification.create({ data });
    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  async getUserNotifications(userId: string) {
    const where: Prisma.NotificationWhereInput = { userId };
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const where: Prisma.NotificationWhereInput = { userId, isRead: false };
    return this.prisma.notification.count({ where });
  }

  async markAsRead(userId: string, notificationId: string) {
    const where: Prisma.NotificationWhereInput = { id: notificationId, userId };
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    const where: Prisma.NotificationWhereInput = { userId, isRead: false };
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    const where: Prisma.NotificationWhereInput = { id: notificationId, userId };
    return this.prisma.notification.deleteMany({
      where,
    });
  }

  async clearAllNotifications(userId: string) {
    const where: Prisma.NotificationWhereInput = { userId };
    return this.prisma.notification.deleteMany({
      where,
    });
  }
}
