import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private createTransporter() {
    return nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private get fromAddress() {
    return this.configService.get<string>('SMTP_FROM') ?? 'noreply@ssfm.app';
  }

  /**
   * Gửi email thông báo cho người dùng ĐÃ CÓ tài khoản
   * rằng họ đã được thêm vào một trang trại.
   */
  async sendFarmInvitationExistingUser(params: {
    toEmail: string;
    toName: string;
    farmName: string;
    managerName: string;
    role: string;
  }) {
    const { toEmail, toName, farmName, managerName, role } = params;
    const roleLabel = role === 'FARMER' ? 'Nông Dân (Farmer)' : 'Kỹ Thuật Viên (Technician)';
    const roleColor = role === 'FARMER' ? '#16a34a' : '#0891b2';
    const roleBg = role === 'FARMER' ? '#dcfce7' : '#cffafe';

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bạn đã được thêm vào trang trại</title>
</head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:10px;">🦐</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Shrimp Farm</h1>
            <p style="margin:6px 0 0;color:#bae6fd;font-size:13px;">Hệ thống quản lý trang trại tôm thông minh</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">Xin chào, ${toName}! 👋</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
              Bạn vừa được <strong style="color:#0284c7;">${managerName}</strong> thêm vào trang trại <strong style="color:#0f172a;">"${farmName}"</strong> với vai trò:
            </p>

            <!-- Role Badge -->
            <div style="text-align:center;margin-bottom:28px;">
              <span style="display:inline-block;background:${roleBg};color:${roleColor};font-size:15px;font-weight:700;padding:10px 28px;border-radius:100px;border:2px solid ${roleColor};">
                ${roleLabel}
              </span>
            </div>

            <!-- Info Box -->
            <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;border-left:4px solid #0ea5e9;margin-bottom:28px;">
              <p style="margin:0;color:#334155;font-size:13px;line-height:1.8;">
                ✅ Tài khoản của bạn đã được kết nối với trang trại.<br/>
                📱 Đăng nhập vào hệ thống để bắt đầu làm việc.<br/>
                🔔 Bạn sẽ nhận được thông báo từ trang trại này.
              </p>
            </div>

            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;">
              Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với quản lý trang trại hoặc đội hỗ trợ SSFM.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              © 2026 Smart Shrimp Farm Management System · Email này được gửi tự động, vui lòng không reply.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.createTransporter().sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject: `🦐 [SSFM] Bạn đã được thêm vào trang trại "${farmName}"`,
        html,
      });
      this.logger.log(`Invitation email (existing user) sent to ${toEmail}`);
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${toEmail}`, err);
    }
  }

  /**
   * Gửi email mời đăng ký cho người CHƯA CÓ tài khoản,
   * kèm link chứa inviteToken để sau khi đăng ký tự động join farm.
   */
  async sendFarmInvitationNewUser(params: {
    toEmail: string;
    farmName: string;
    managerName: string;
    role: string;
    inviteLink: string;
    expiresInDays?: number;
  }) {
    const { toEmail, farmName, managerName, role, inviteLink, expiresInDays = 7 } = params;
    const roleLabel = role === 'FARMER' ? 'Nông Dân (Farmer)' : 'Kỹ Thuật Viên (Technician)';
    const roleColor = role === 'FARMER' ? '#16a34a' : '#0891b2';
    const roleBg = role === 'FARMER' ? '#dcfce7' : '#cffafe';

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Lời mời tham gia trang trại</title>
</head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:10px;">🦐</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Shrimp Farm</h1>
            <p style="margin:6px 0 0;color:#bae6fd;font-size:13px;">Hệ thống quản lý trang trại tôm thông minh</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">Bạn nhận được lời mời! 🎉</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
              <strong style="color:#0284c7;">${managerName}</strong> đang mời bạn tham gia trang trại <strong style="color:#0f172a;">"${farmName}"</strong> với vai trò:
            </p>

            <!-- Role Badge -->
            <div style="text-align:center;margin-bottom:28px;">
              <span style="display:inline-block;background:${roleBg};color:${roleColor};font-size:15px;font-weight:700;padding:10px 28px;border-radius:100px;border:2px solid ${roleColor};">
                ${roleLabel}
              </span>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${inviteLink}" 
                 style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(14,165,233,0.4);">
                ✅ Chấp nhận lời mời & Đăng ký
              </a>
            </div>

            <!-- Info Box -->
            <div style="background:#fefce8;border-radius:12px;padding:20px 24px;border-left:4px solid #eab308;margin-bottom:24px;">
              <p style="margin:0;color:#713f12;font-size:13px;line-height:1.8;font-weight:600;">
                ⚠️ Lưu ý quan trọng:
              </p>
              <ul style="margin:8px 0 0;padding-left:18px;color:#78350f;font-size:12px;line-height:1.9;">
                <li>Link này có hiệu lực trong <strong>${expiresInDays} ngày</strong>.</li>
                <li>Email đăng ký phải là <strong>${toEmail}</strong>.</li>
                <li>Sau khi đăng ký, bạn sẽ tự động được thêm vào trang trại.</li>
              </ul>
            </div>

            <!-- Fallback link -->
            <p style="margin:0;color:#94a3b8;font-size:11px;word-break:break-all;">
              Không nhấn được nút? Copy link: <span style="color:#0284c7;">${inviteLink}</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              © 2026 Smart Shrimp Farm Management System · Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.createTransporter().sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject: `🦐 [SSFM] Lời mời tham gia trang trại "${farmName}"`,
        html,
      });
      this.logger.log(`Invitation email (new user) sent to ${toEmail}`);
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${toEmail}`, err);
    }
  }
}
