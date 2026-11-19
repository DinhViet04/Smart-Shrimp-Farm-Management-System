import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

export interface UploadedFileDto {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ParsedFileResult {
  fileName: string;
  fileType: 'excel' | 'pdf' | 'word' | 'text' | 'unknown';
  extractedText: string;
  sheetsCount?: number;
  pagesCount?: number;
  sizeBytes: number;
}

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  /**
   * Bóc tách nội dung văn bản từ Buffer tệp tải lên (Excel, PDF, Word, Text)
   */
  async parseBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<ParsedFileResult> {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const sizeBytes = buffer.length;

    try {
      // 1. Tệp Excel (.xlsx, .xls, .csv)
      if (
        ['xlsx', 'xls', 'csv'].includes(ext) ||
        mimeType?.includes('spreadsheet') ||
        mimeType?.includes('excel')
      ) {
        return this.parseExcel(buffer, fileName, sizeBytes);
      }

      // 2. Tệp PDF (.pdf)
      if (ext === 'pdf' || mimeType?.includes('pdf')) {
        return await this.parsePdf(buffer, fileName, sizeBytes);
      }

      // 3. Tệp Word (.docx, .doc)
      if (
        ['docx', 'doc'].includes(ext) ||
        mimeType?.includes('wordprocessingml') ||
        mimeType?.includes('msword')
      ) {
        return await this.parseWord(buffer, fileName, sizeBytes);
      }

      // 4. Tệp Text / Markdown / CSV thuần
      if (['txt', 'md', 'json'].includes(ext) || mimeType?.startsWith('text/')) {
        const text = buffer.toString('utf-8');
        return {
          fileName,
          fileType: 'text',
          extractedText: text.trim(),
          sizeBytes,
        };
      }

      throw new BadRequestException(
        `Định dạng tệp .${ext} chưa được hỗ trợ. Hệ thống hỗ trợ tốt nhất tệp Excel (.xlsx, .xls), PDF (.pdf) và Word (.docx).`,
      );
    } catch (err: any) {
      this.logger.error(`Error parsing file ${fileName}: ${err?.message || err}`, err.stack);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Không thể đọc nội dung tệp "${fileName}": ${err?.message || 'Tệp bị lỗi hoặc có mật khẩu bảo vệ'}.`,
      );
    }
  }

  /**
   * Đọc tệp Excel và chuyển thành Markdown Table để LLM đọc hiểu cấu trúc dòng/cột
   */
  private parseExcel(buffer: Buffer, fileName: string, sizeBytes: number): ParsedFileResult {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames || [];
    const textParts: string[] = [];

    sheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rows || rows.length === 0) return;

      textParts.push(`\n--- BẢNG TÍNH / SHEET: "${sheetName}" ---`);

      const nonEmptyRows = rows.filter((r) =>
        r.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''),
      );
      if (nonEmptyRows.length === 0) return;

      nonEmptyRows.slice(0, 200).forEach((row, rIdx) => {
        const rowStr = row
          .map((cell) => {
            let str = String(cell !== undefined && cell !== null ? cell : '')
              .replace(/\r?\n/g, ' ')
              .trim();
            // Rút gọn ô quá dài (> 200 ký tự) để tránh làm phình tệp text quá mức
            if (str.length > 200) {
              str = str.slice(0, 197) + '...';
            }
            return str;
          })
          .join(' | ');
        textParts.push(`| ${rowStr} |`);
        if (rIdx === 0) {
          const sep = row.map(() => '---').join(' | ');
          textParts.push(`| ${sep} |`);
        }
      });

      if (nonEmptyRows.length > 100) {
        textParts.push(
          `(Đã rút gọn hiển thị 100 dòng đầu tiên trong tổng số ${nonEmptyRows.length} dòng của bảng tính)`,
        );
      }
    });

    const fullText = textParts.join('\n').trim();
    if (!fullText) {
      throw new BadRequestException(`Tệp Excel "${fileName}" không có dữ liệu bảng tính hợp lệ.`);
    }

    return {
      fileName,
      fileType: 'excel',
      extractedText: fullText,
      sheetsCount: sheetNames.length,
      sizeBytes,
    };
  }

  /**
   * Đọc tệp PDF và trích xuất text
   */
  private async parsePdf(buffer: Buffer, fileName: string, sizeBytes: number): Promise<ParsedFileResult> {
    try {
      // Dùng dynamic require để tương thích đa phiên bản pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfModule = require('pdf-parse');
      let text = '';
      let pagesCount = 1;

      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        const data = await parser.getText();
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
        text = (data?.text || '').trim();
        pagesCount = data?.total || 1;
      } else if (typeof pdfModule === 'function') {
        const data = await pdfModule(buffer);
        text = (data?.text || '').trim();
        pagesCount = data?.numpages || 1;
      }

      if (!text) {
        throw new BadRequestException(
          `Tệp PDF "${fileName}" không chứa văn bản có thể đọc được (có thể là tệp scan dạng ảnh hoặc có bảo mật).`,
        );
      }

      return {
        fileName,
        fileType: 'pdf',
        extractedText: text,
        pagesCount,
        sizeBytes,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Lỗi đọc tệp PDF "${fileName}": ${err?.message || err}`);
    }
  }

  /**
   * Đọc tệp Word (.docx) và trích xuất văn bản
   */
  private async parseWord(buffer: Buffer, fileName: string, sizeBytes: number): Promise<ParsedFileResult> {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();

    if (!text) {
      throw new BadRequestException(`Tệp Word "${fileName}" không có nội dung văn bản hợp lệ.`);
    }

    return {
      fileName,
      fileType: 'word',
      extractedText: text,
      sizeBytes,
    };
  }
}
