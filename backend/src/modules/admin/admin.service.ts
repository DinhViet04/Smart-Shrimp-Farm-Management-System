import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    // 1. Stat cards
    const totalUsers = await this.prisma.user.count();
    const totalFarms = await this.prisma.farm.count();
    const activePonds = await this.prisma.pond.count({
      where: {
        crops: {
          some: { status: 'ACTIVE' },
        },
      },
    });
    const activeCrops = await this.prisma.crop.count({
      where: { status: 'ACTIVE' },
    });

    // 2. Growth Data (Last 7 days users count)
    const growthData: number[] = [];
    const growthLabels: string[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));

      const count = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      growthData.push(count);

      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      growthLabels.push(dayNames[d.getDay()]);
    }

    // 3. Role Distribution
    const roleGroup = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });
    const colors: Record<string, string> = {
      ADMIN: '#ef4444',
      FARM_MANAGER: '#10b981',
      TECHNICIAN: '#f59e0b',
      FARMER: '#6366f1',
    };
    const labels: Record<string, string> = {
      ADMIN: 'Admin',
      FARM_MANAGER: 'Farm Manager',
      TECHNICIAN: 'Technician',
      FARMER: 'Farmer',
    };
    const roleDistrib = roleGroup.map((item) => ({
      value: item._count,
      color: colors[item.role] || '#ccc',
      label: labels[item.role] || item.role,
    }));

    // 4. Recent Activity
    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentFarms = await this.prisma.farm.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const activities = [
      ...recentUsers.map((u) => ({
        type: 'user',
        text: `Người dùng mới đăng ký: ${u.fullName}`,
        date: u.createdAt,
        color: 'bg-indigo-500',
      })),
      ...recentFarms.map((f) => ({
        type: 'farm',
        text: `Trang trại "${f.name}" được tạo`,
        date: f.createdAt,
        color: 'bg-emerald-500',
      })),
    ];

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    const formattedActivity = activities.slice(0, 5).map((act) => {
      const diffMs = today.getTime() - act.date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);
      let sub = 'Vừa xong';
      if (diffDays > 0) sub = `${diffDays} ngày trước`;
      else if (diffHrs > 0) sub = `${diffHrs} giờ trước`;
      else if (diffMins > 0) sub = `${diffMins} phút trước`;

      return {
        text: act.text,
        sub,
        color: act.color,
      };
    });

    return {
      statCards: [
        {
          label: 'Tổng Người dùng',
          value: totalUsers.toString(),
          change: 'Thực tế',
          up: true,
          color: '#6366f1',
        },
        {
          label: 'Tổng Trang trại',
          value: totalFarms.toString(),
          change: 'Thực tế',
          up: true,
          color: '#10b981',
        },
        {
          label: 'Ao đang hoạt động',
          value: activePonds.toString(),
          change: 'Thực tế',
          up: true,
          color: '#f59e0b',
        },
        {
          label: 'Vụ Nuôi đang chạy',
          value: activeCrops.toString(),
          change: 'Thực tế',
          up: true,
          color: '#3b82f6',
        },
      ],
      growthData,
      growthLabels,
      roleDistrib,
      recentActivity: formattedActivity,
    };
  }
}
