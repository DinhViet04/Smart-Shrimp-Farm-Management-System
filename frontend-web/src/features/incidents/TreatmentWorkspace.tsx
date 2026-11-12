import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  FlaskConical,
  Layers,
  Maximize2,
  Minimize2,
  Package,
  Pill,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentUpdate } from '../../services/incident.service';
import { inventoryService } from '../../services/inventory.service';
import { chatbotService } from '../../services/chatbot.service';

interface InventoryItem {
  id: string;
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantity: number;
  unit: string;
  minThreshold: number;
  description?: string;
  supplier?: { name: string } | null;
}

interface TreatmentWorkspaceProps {
  incident: Incident;
  onBack: () => void;
  currentUserRole: string;
  currentUserId?: string;
}

interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface SelectedTreatmentItem {
  inventoryId: string;
  item: InventoryItem;
  quantity: string;
  error?: string;
}

interface FieldErrors {
  treatmentNote?: string;
  resultNote?: string;
}

interface DetectedMedicine {
  inventoryId: string;
  item: InventoryItem;
  quantity: string;
  selected: boolean;
  error?: string;
  note?: string;
}

interface OutOfStockItem {
  name: string;
  rawLine: string;
}

/**
 * Format inline text: removes raw markdown **bold**, `code`, and clean arrows
 */
function renderInlineText(text: string): ReactNode {
  if (!text) return null;

  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {inner}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="rounded-md bg-sky-100/80 px-1.5 py-0.5 font-mono text-[11px] text-sky-900 font-semibold"
        >
          {inner}
        </code>
      );
    }
    return part;
  });
}

function cleanDosageText(raw: string): string {
  return raw
    .replace(/\b\d+\s*[×x*]\s*\d+\s*=\s*\d+\s*(?:g|ml)\b/gi, '')
    .replace(/tổng cộng/gi, '')
    .replace(/→/g, '•')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Làm sạch và chuyển đổi hướng dẫn điều trị của AI thành văn bản tiếng Việt
 * chuẩn chỉnh, dễ đọc trong ô "Biện pháp can thiệp đã thực hiện".
 * Loại bỏ toàn bộ các dấu hiệu code markdown (###, **, *, __, →, phép tính rườm rà).
 */
function cleanTreatmentNoteForHumans(raw: string): string {
  if (!raw) return '';

  const lines = raw.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      continue;
    }

    // Bỏ dòng tiêu đề markdown phần 3 nếu lặp lại
    if (/^#+\s*(?:3[.)]\s*)?(?:Hướng dẫn điều trị|Phác đồ điều trị)/i.test(line)) {
      continue;
    }

    // Bỏ tất cả ký hiệu header '#' ở đầu dòng
    line = line.replace(/^#+\s*/, '');

    // Bỏ toàn bộ ký hiệu markdown in đậm / in nghiêng: **text**, *text*, __text__
    line = line.replace(/\*\*(.*?)\*\*/g, '$1');
    line = line.replace(/\*(.*?)\*/g, '$1');
    line = line.replace(/__(.*?)__/g, '$1');

    // Chuyển đổi mũi tên '→' thành ': '
    line = line.replace(/→/g, ': ');

    // Làm sạch phép toán nhân chia rườm rà như '3000 × 2 = 6000 g'
    line = line.replace(/\b\d+\s*[×x*]\s*\d+\s*=\s*\d+\s*(?:g|ml)\b/gi, '');
    line = line.replace(/\s{2,}/g, ' ').trim();

    // Chuẩn hóa các đề mục lớn thành tiêu đề rõ ràng
    if (/^Các bước điều trị[:\s]*/i.test(line)) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      result.push('1. QUY TRÌNH CAN THIỆP ĐIỀU TRỊ:');
      continue;
    }
    if (/^Thời điểm tạt.*?thức ăn[:\s]*/i.test(line) || /^Thời điểm tạt[:\s]*/i.test(line)) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      result.push('2. THỜI ĐIỂM TẠT THUỐC & CHẾ ĐỘ CHO ĂN:');
      continue;
    }
    if (/^Chỉ số môi trường.*?theo dõi[:\s]*/i.test(line)) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      result.push('3. CHỈ SỐ MÔI TRƯỜNG NƯỚC CẦN THEO DÕI SÁT:');
      continue;
    }

    // Chuẩn hóa định dạng danh sách có thứ tự hoặc gạch đầu dòng
    if (/^\d+\.\s*/.test(line)) {
      result.push(line);
    } else if (/^[-*•]\s*/.test(line)) {
      result.push('- ' + line.replace(/^[-*•]\s*/, ''));
    } else {
      result.push(line);
    }
  }

  let finalNote = result.join('\n').trim();

  // Đảm bảo có tiêu đề đầu trang sạch đẹp
  if (!finalNote.startsWith('KẾ HOẠCH ĐIỀU TRỊ')) {
    finalNote = 'KẾ HOẠCH ĐIỀU TRỊ & THEO DÕI SỰ CỐ:\n\n' + finalNote;
  }

  // Dọn dẹp khoảng trống thừa (tối đa 1 dòng trống giữa các đoạn)
  finalNote = finalNote.replace(/\n{3,}/g, '\n\n');

  return finalNote;
}

interface MedicineBlock {
  name: string;
  inStock: boolean;
  stockQty?: string;
  purpose?: string;
  dosage?: string;
  usage?: string;
  extra: string[];
}

function ClinicalReportRenderer({ content, isExpanded = false }: { content: string; isExpanded?: boolean }) {
  const isStructuredReport = useMemo(() => {
    return (
      content.includes('Chẩn đoán') &&
      (content.includes('Đối chiếu') || content.includes('kho trang trại') || content.includes('Thuốc/hóa chất'))
    );
  }, [content]);

  const parsed = useMemo(() => {
    let section1Raw = '';
    let section2Raw = '';
    let section3Raw = '';

    const p1Match = content.match(/(?:^|\n)(?:#{1,4}\s*)?1[.)]\s*([^\n]+)/i);
    const p2Match = content.match(/(?:^|\n)(?:#{1,4}\s*)?2[.)]\s*([^\n]+)/i);
    const p3Match = content.match(/(?:^|\n)(?:#{1,4}\s*)?3[.)]\s*([^\n]+)/i);

    const idx1 = p1Match?.index ?? -1;
    const idx2 = p2Match?.index ?? -1;
    const idx3 = p3Match?.index ?? -1;

    if (idx1 >= 0 && idx2 > idx1) {
      section1Raw = content.slice(idx1 + (p1Match?.[0].length || 0), idx2).trim();
      if (idx3 > idx2) {
        section2Raw = content.slice(idx2 + (p2Match?.[0].length || 0), idx3).trim();
        section3Raw = content.slice(idx3 + (p3Match?.[0].length || 0)).trim();
      } else {
        section2Raw = content.slice(idx2 + (p2Match?.[0].length || 0)).trim();
      }
    } else {
      section1Raw = content;
    }

    const s1Causes: { title: string; desc: string }[] = [];
    let s1RiskText = '';

    const s1Lines = section1Raw.split('\n');
    let isParsingRisk = false;

    s1Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.includes('Mức độ rủi ro') || trimmed.includes('mức độ rủi ro')) {
        isParsingRisk = true;
        const inlineRisk = trimmed.replace(/^[#*\-\s]*Mức độ rủi ro[:\s*]*/i, '').trim();
        if (inlineRisk) s1RiskText = inlineRisk;
        return;
      }

      if (isParsingRisk) {
        s1RiskText += (s1RiskText ? ' ' : '') + trimmed.replace(/^[\s*\-#\d.]+/, '');
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        const clean = trimmed.replace(/^[\s*\-#\d.]+/, '');
        const colonIdx = clean.indexOf(':');
        if (colonIdx > 0 && colonIdx < 50) {
          const title = clean.slice(0, colonIdx).replace(/\*\*/g, '').trim();
          const desc = clean.slice(colonIdx + 1).replace(/\*\*/g, '').trim();
          s1Causes.push({ title, desc });
        } else {
          s1Causes.push({ title: '', desc: clean.replace(/\*\*/g, '').trim() });
        }
      }
    });

    const inStockList: MedicineBlock[] = [];
    const outOfStockList: MedicineBlock[] = [];

    let currentStockType: 'IN' | 'OUT' = 'IN';
    let currentMed: MedicineBlock | null = null;

    const s2Lines = section2Raw.split('\n');

    const commitMed = () => {
      if (currentMed && currentMed.name) {
        if (currentMed.inStock) {
          inStockList.push(currentMed);
        } else {
          outOfStockList.push(currentMed);
        }
      }
      currentMed = null;
    };

    s2Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (
        trimmed.includes('CÓ SẴN TRONG KHO') &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('1.') &&
        !trimmed.startsWith('2.')
      ) {
        commitMed();
        currentStockType = 'IN';
        return;
      }

      if (
        (trimmed.includes('KHO CHƯA CÓ') ||
          trimmed.includes('CHƯA CÓ TRONG KHO') ||
          trimmed.includes('Cần mua bổ sung')) &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('1.') &&
        !trimmed.startsWith('2.')
      ) {
        commitMed();
        currentStockType = 'OUT';
        return;
      }

      const isNewMedHeader =
        (/^\d+\.\s*\*\*/.test(trimmed) || /^-\s*\*\*/.test(trimmed)) &&
        !trimmed.includes('Tồn kho') &&
        !trimmed.includes('Công dụng') &&
        !trimmed.includes('Liều lượng') &&
        !trimmed.includes('Cách sử dụng');

      if (isNewMedHeader) {
        commitMed();
        const medName = trimmed.replace(/^[\s*\-#\d.]+/, '').replace(/\*\*/g, '').trim();
        currentMed = {
          name: medName,
          inStock: currentStockType === 'IN',
          extra: [],
        };
        return;
      }

      if (currentMed) {
        const cleanLine = trimmed.replace(/^[\s*\-#\d.]+/, '');
        if (cleanLine.toLowerCase().includes('tồn kho')) {
          currentMed.stockQty = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (cleanLine.toLowerCase().includes('công dụng')) {
          currentMed.purpose = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (cleanLine.toLowerCase().includes('liều lượng')) {
          currentMed.dosage = cleanDosageText(
            cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim()
          );
        } else if (cleanLine.toLowerCase().includes('cách sử dụng') || cleanLine.toLowerCase().includes('cách dùng')) {
          currentMed.usage = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else {
          currentMed.extra.push(cleanLine.replace(/\*\*/g, '').trim());
        }
      }
    });
    commitMed();

    const treatmentSteps: string[] = [];
    let feedingNote = '';
    const waterMetrics: { label: string; value: string }[] = [];

    const s3Lines = section3Raw.split('\n');
    let s3Mode: 'STEPS' | 'FEEDING' | 'METRICS' | 'OTHER' = 'STEPS';

    s3Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.toLowerCase().includes('các bước điều trị')) {
        s3Mode = 'STEPS';
        return;
      }
      if (trimmed.toLowerCase().includes('thời điểm tạt') || trimmed.toLowerCase().includes('thức ăn')) {
        s3Mode = 'FEEDING';
        return;
      }
      if (trimmed.toLowerCase().includes('chỉ số môi trường') || trimmed.toLowerCase().includes('nước cần theo dõi')) {
        s3Mode = 'METRICS';
        return;
      }

      if (s3Mode === 'STEPS') {
        if (/^\d+\./.test(trimmed) || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          treatmentSteps.push(trimmed.replace(/^[\s*\-#\d.]+/, '').replace(/\*\*/g, '').trim());
        }
      } else if (s3Mode === 'FEEDING') {
        feedingNote += (feedingNote ? '\n' : '') + trimmed.replace(/^[\s*\-#]+/, '').replace(/\*\*/g, '').trim();
      } else if (s3Mode === 'METRICS') {
        const clean = trimmed.replace(/^[\s*\-#\d.]+/, '');
        const colonIdx = clean.indexOf(':');
        if (colonIdx > 0 && colonIdx < 30) {
          const label = clean.slice(0, colonIdx).replace(/\*\*/g, '').trim();
          const value = clean.slice(colonIdx + 1).replace(/\*\*/g, '').trim();
          waterMetrics.push({ label, value });
        }
      }
    });

    return {
      causes: s1Causes,
      riskText: s1RiskText,
      inStockList,
      outOfStockList,
      treatmentSteps,
      feedingNote,
      waterMetrics,
    };
  }, [content]);

  if (!isStructuredReport) {
    const paragraphs = content.split('\n\n');
    return (
      <div className={`space-y-2.5 font-sans ${isExpanded ? 'text-sm' : 'text-xs'} leading-relaxed text-slate-700`}>
        {paragraphs.map((p, pIdx) => {
          const trimmed = p.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('#')) {
            const cleanHeader = trimmed.replace(/^#+\s*/, '');
            return (
              <h4 key={pIdx} className="font-bold text-sky-950 text-sm mt-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <span>{renderInlineText(cleanHeader)}</span>
              </h4>
            );
          }

          const lines = trimmed.split('\n');
          if (lines.some((l) => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()))) {
            return (
              <ul key={pIdx} className="space-y-1.5 pl-1">
                {lines.map((l, lIdx) => {
                  const itemText = l.replace(/^[\s*\-#\d.]+/, '').trim();
                  return (
                    <li key={lIdx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                      <span className="flex-1">{renderInlineText(itemText)}</span>
                    </li>
                  );
                })}
              </ul>
            );
          }

          return <p key={pIdx}>{renderInlineText(trimmed)}</p>;
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-4 font-sans ${isExpanded ? 'text-sm' : 'text-xs'}`}>
      {/* ── MỤC 1: CHẨN ĐOÁN NGUYÊN NHÂN & RỦI RO ── */}
      <div className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-sky-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
            <Stethoscope className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-sky-950 text-sm tracking-tight">
            1. Chẩn đoán nguyên nhân & Đánh giá rủi ro
          </h3>
        </div>

        <div className="space-y-2 mb-3">
          {parsed.causes.map((c, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-sky-100 hover:border-sky-300 transition-colors"
            >
              <div className="mt-1 h-2 w-2 rounded-full bg-sky-500 flex-shrink-0" />
              <div className="flex-1 leading-relaxed">
                {c.title && <span className="font-bold text-sky-900 mr-1.5">{c.title}:</span>}
                <span className="text-slate-700 font-medium">{c.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {parsed.riskText && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed text-xs">
              <span className="font-bold text-amber-950">Mức độ rủi ro: </span>
              <span className="font-medium text-amber-900">{parsed.riskText}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── MỤC 2: ĐỐI CHIẾU DANH MỤC THUỐC & KHO THỰC TẾ ── */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50/40 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Package className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-indigo-950 text-sm tracking-tight">
            2. Đối chiếu danh mục kho & Đề xuất liều dùng
          </h3>
        </div>

        {parsed.inStockList.length > 0 && (
          <div className="space-y-2.5 mb-4">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Vật tư có sẵn trong kho trang trại ({parsed.inStockList.length})
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {parsed.inStockList.map((med, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-[11px] font-black text-emerald-700 border border-emerald-200">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-900 text-[13px]">{med.name}</h4>
                    </div>
                    {med.stockQty && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        📦 Tồn kho: {med.stockQty}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pl-1">
                    {med.purpose && (
                      <p className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-800 flex-shrink-0">Công dụng:</span>
                        <span>{med.purpose}</span>
                      </p>
                    )}
                    {med.dosage && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-900 font-bold text-xs">
                        <span className="flex-shrink-0">💊 Liều đề xuất:</span>
                        <span className="text-sky-700">{med.dosage}</span>
                      </div>
                    )}
                    {med.usage && (
                      <p className="flex items-start gap-1.5 text-slate-500">
                        <span className="font-bold text-slate-700 flex-shrink-0">Cách dùng:</span>
                        <span>{med.usage}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {parsed.outOfStockList.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-extrabold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Vật tư kho chưa có — Cần mua bổ sung ({parsed.outOfStockList.length})
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {parsed.outOfStockList.map((med, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-[11px] font-black text-amber-800 border border-amber-200">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-amber-950 text-[13px]">{med.name}</h4>
                    </div>
                    <span className="rounded-lg bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase">
                      Chưa có trong kho
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pl-1">
                    {med.purpose && (
                      <p className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-800 flex-shrink-0">Công dụng:</span>
                        <span>{med.purpose}</span>
                      </p>
                    )}
                    {med.dosage && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white border border-amber-200 text-amber-950 font-bold text-xs">
                        <span className="flex-shrink-0">Liều lượng khuyến cáo:</span>
                        <span className="text-amber-800">{med.dosage}</span>
                      </div>
                    )}
                    {med.usage && (
                      <p className="flex items-start gap-1.5 text-slate-600">
                        <span className="font-bold text-slate-800 flex-shrink-0">Cách dùng:</span>
                        <span>{med.usage}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MỤC 3: HƯỚNG DẪN ĐIỀU TRỊ & CHỈ SỐ THEO DÕI ── */}
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/40 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <ClipboardList className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-emerald-950 text-sm tracking-tight">
            3. Hướng dẫn các bước điều trị & Chỉ số theo dõi
          </h3>
        </div>

        {parsed.treatmentSteps.length > 0 && (
          <div className="space-y-2 mb-3.5">
            <p className="font-bold text-slate-800 text-xs px-1">Quy trình can thiệp theo thứ tự:</p>
            <div className="space-y-2">
              {parsed.treatmentSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-white border border-emerald-100/90 shadow-2xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-black flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-slate-700 font-medium leading-relaxed flex-1">{renderInlineText(step)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {parsed.feedingNote && (
          <div className="p-3 rounded-xl bg-sky-50/90 border border-sky-200/80 text-sky-950 text-xs space-y-1 mb-3.5">
            <div className="flex items-center gap-1.5 font-bold text-sky-900 mb-1">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Thời điểm tạt thuốc & Chế độ cho ăn:</span>
            </div>
            <div className="text-slate-700 font-medium leading-relaxed whitespace-pre-line pl-1">
              {renderInlineText(parsed.feedingNote)}
            </div>
          </div>
        )}

        {parsed.waterMetrics.length > 0 && (
          <div>
            <p className="font-bold text-slate-800 text-xs px-1 mb-2 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-teal-600" />
              <span>Chỉ số môi trường nước cần theo dõi sát sao:</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {parsed.waterMetrics.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-white border border-slate-200/90 p-2.5 text-center shadow-2xs"
                >
                  <span className="block text-[11px] font-extrabold text-teal-800 uppercase tracking-wider mb-1">
                    {m.label}
                  </span>
                  <span className="block text-xs font-bold text-slate-800">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TreatmentWorkspace({
  incident,
  onBack,
  currentUserRole,
  currentUserId,
}: TreatmentWorkspaceProps) {
  const [incidentDetail, setIncidentDetail] = useState<Incident>(incident);
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Inventory & Prescription state
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedTreatmentItem[]>([]);
  const [treatmentNote, setTreatmentNote] = useState<string>('');
  const [observationNote, setObservationNote] = useState<string>('');
  const [resultNote, setResultNote] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MEDICINE' | 'CHEMICAL'>('ALL');

  // Validation & Submission
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [isShrimpRecovered, setIsShrimpRecovered] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // AI Diagnostic State
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string>('');
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);

  // Metadata ao & vụ nuôi
  const pond = incidentDetail.crop?.pond || incident.crop?.pond;
  const pondId = pond?.id;
  const pondName = pond?.name || 'Ao nuôi';
  const farmName = pond?.farm?.name || 'Trang trại';
  const stage = incidentDetail.crop?.stage === 'NURSERY' ? 'Ương giống' : 'Thương phẩm';

  // Tính thể tích nước ao (m³) & DOC
  const areaSize = Number(pond?.areaSize) || 0;
  const depth = Number(pond?.depth) || 1.2;
  const waterVolume = Math.round(areaSize * depth * 10) / 10;

  const docDays = useMemo(() => {
    if (!incidentDetail.crop?.startDate) return null;
    const start = new Date(incidentDetail.crop.startDate);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [incidentDetail.crop?.startDate]);

  // Quyền hạn cập nhật điều trị
  const canUpdateTreatment =
    currentUserRole === 'TECHNICIAN'
      ? incidentDetail.assignedToId === currentUserId
      : currentUserRole === 'FARM_MANAGER';

  // Modal xác nhận áp dụng phác đồ AI vào điều trị
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const [detectedMedicines, setDetectedMedicines] = useState<DetectedMedicine[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [modalTreatmentNote, setModalTreatmentNote] = useState('');

  // Quy đổi đơn vị tương thích với tồn kho thực tế
  const normalizeDosageUnit = (num: number, rawUnit: string, targetUnit: string): string => {
    let converted = num;
    const raw = rawUnit.toLowerCase();
    const target = targetUnit.toLowerCase();

    if ((raw === 'g' || raw === 'gam') && target === 'kg') {
      converted = Math.round((num / 1000) * 100) / 100;
    } else if (raw === 'ml' && (target === 'lít' || target === 'lit' || target === 'l')) {
      converted = Math.round((num / 1000) * 100) / 100;
    } else if (raw === 'kg' && (target === 'g' || target === 'gam')) {
      converted = Math.round(num * 1000);
    } else if ((raw === 'lít' || raw === 'lit' || raw === 'l') && target === 'ml') {
      converted = Math.round(num * 1000);
    }

    return converted > 0 ? String(converted) : '';
  };

  // Trích xuất định lượng chuẩn xác từ phân tích AI dựa trên thể tích ao nuôi
  const extractDosageForInventoryItem = (inv: InventoryItem, fullText: string, vol: number): string => {
    const fullName = inv.itemName.toLowerCase();
    const mainKeyword = inv.itemName.split(/[&\-\/(]/)[0].trim().toLowerCase();
    const lowerText = fullText.toLowerCase();

    let searchWord = '';
    if (lowerText.includes(fullName)) searchWord = fullName;
    else if (mainKeyword.length >= 4 && lowerText.includes(mainKeyword)) searchWord = mainKeyword;

    if (!searchWord) return '';

    // Lấy các phân đoạn văn bản xung quanh các lần xuất hiện của tên thuốc (mỗi đoạn 600 ký tự)
    let pos = -1;
    const snippets: string[] = [];
    while ((pos = lowerText.indexOf(searchWord, pos + 1)) !== -1) {
      snippets.push(fullText.slice(pos, pos + 600));
    }

    // Bổ sung thêm toàn bộ phần 3 (Các bước điều trị) vì AI thường ghi liều tạt thực tế ở đó
    const sec3Idx = fullText.search(/(?:###?\s*3[.)]|3[.)]\s*Hướng dẫn)/i);
    if (sec3Idx !== -1) {
      snippets.push(fullText.slice(sec3Idx));
    }

    for (const snippet of snippets) {
      // Mẫu 1: Chỉ định rõ lượng cần dùng cho cả ao nuôi (Ví dụ: "cần dùng: **1,5 lít**", "Ao ... cần dùng: 15 kg", "tổng lượng: 3 kg")
      const p1 = /(?:cần dùng|tổng cộng|cho ao|cần tạt|cần trộn|lượng dùng|tổng lượng|tổng liều|liều tạt ao)\s*[:=→\->\s]*\**(\d+(?:[.,]\d+)?)\s*\**\s*(kg|g|lít|lit|l\b|ml|chai|can|gói|bao|viên)/i;
      let m = snippet.match(p1);
      if (m) {
        return normalizeDosageUnit(parseFloat(m[1].replace(',', '.')), m[2].toLowerCase(), inv.unit);
      }

      // Mẫu 2: Phép suy ra mũi tên (Ví dụ: "→ Ao A1 1500 m³ cần dùng: **1,5 lít**" hoặc "→ **15 kg**")
      const p2 = /(?:→|->|=>)\s*(?:[^\n]*?)\b(?:cần dùng|dùng|tạt|tổng)?\s*[:\s]*\**(\d+(?:[.,]\d+)?)\s*\**\s*(kg|g|lít|lit|l\b|ml|chai|can|gói|bao|viên)/i;
      m = snippet.match(p2);
      if (m) {
        return normalizeDosageUnit(parseFloat(m[1].replace(',', '.')), m[2].toLowerCase(), inv.unit);
      }

      // Mẫu 3: Lời gọi hành động trực tiếp trong phần điều trị (Ví dụ: "Yucca Schidigera: Tạt 1,5 lít", "Tạt Nova-Minerals: Sử dụng 15 kg")
      const escapedWord = searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const p3a = new RegExp(`(?:${escapedWord})[^.\\n]{0,80}?(?:tạt|sử dụng|dùng|trộn|đánh)\\s*\\**(\\d+(?:[.,]\\d+)?)\\s*\\**\\s*(kg|g|lít|lit|l\\b|ml|chai|can|gói|bao|viên)`, 'i');
      m = snippet.match(p3a);
      if (m) {
        return normalizeDosageUnit(parseFloat(m[1].replace(',', '.')), m[2].toLowerCase(), inv.unit);
      }

      const p3b = new RegExp(`(?:tạt|sử dụng|dùng|trộn|đánh)\\s*[^.\\n]{0,50}?(?:${escapedWord})[^.\\n]{0,50}?\\**(\\d+(?:[.,]\\d+)?)\\s*\\**\\s*(kg|g|lít|lit|l\\b|ml|chai|can|gói|bao|viên)`, 'i');
      m = snippet.match(p3b);
      if (m) {
        return normalizeDosageUnit(parseFloat(m[1].replace(',', '.')), m[2].toLowerCase(), inv.unit);
      }

      // Mẫu 4: Tự động tính toán theo thể tích nước ao nếu AI chỉ cho liều suất theo 1.000 m³ (Ví dụ: "Liều chuẩn: 1 lít/1000 m³", "2 kg / 1.000 m3")
      const p4 = /(\d+(?:[.,]\d+)?)\s*(kg|g|lít|lit|l\b|ml|chai|can|gói|bao|viên)\s*(?:\/|\s*trên\s*|\s*cho\s*)\s*1[.,]?000\s*m[3³]/i;
      m = snippet.match(p4);
      if (m && vol > 0) {
        const baseRate = parseFloat(m[1].replace(',', '.'));
        const calculated = Math.round((baseRate * (vol / 1000)) * 100) / 100;
        return normalizeDosageUnit(calculated, m[2].toLowerCase(), inv.unit);
      }
    }

    return '';
  };

  // Phân tích và bóc tách thông minh phác đồ AI
  const parseAIPlan = (text: string) => {
    const detected: DetectedMedicine[] = [];
    const outOfStock: OutOfStockItem[] = [];

    // 1. Quét đối chiếu danh mục thuốc trong kho của trang trại
    inventories
      .filter((inv) => inv.category === 'MEDICINE' || inv.category === 'CHEMICAL')
      .forEach((inv) => {
        const fullName = inv.itemName.toLowerCase();
        // Lấy từ khóa chính (trước các ký tự &, -, /, dấu ngoặc)
        const mainKeyword = inv.itemName
          .split(/[&\-\/(]/)[0]
          .trim()
          .toLowerCase();

        const isFullNameMatched = text.toLowerCase().includes(fullName);
        const isKeywordMatched = mainKeyword.length >= 4 && text.toLowerCase().includes(mainKeyword);

        if (isFullNameMatched || isKeywordMatched) {
          // Trích xuất định lượng chuẩn xác tự động tính cho thể tích ao
          const suggestedQty = extractDosageForInventoryItem(inv, text, waterVolume);

          // Kiểm tra tồn kho thực tế
          let error: string | undefined;
          if (suggestedQty) {
            const num = Number(suggestedQty);
            if (num > inv.quantity) {
              error = `Vượt tồn kho (Hiện có: ${inv.quantity} ${inv.unit})`;
            }
          }

          detected.push({
            inventoryId: inv.id,
            item: inv,
            quantity: suggestedQty,
            selected: true,
            error,
            note: suggestedQty
              ? `Liều đề xuất: ${suggestedQty} ${inv.unit} (Tồn kho: ${inv.quantity} ${inv.unit})`
              : `Tồn kho: ${inv.quantity} ${inv.unit}`,
          });
        }
      });

    // 2. Quét các thuốc AI khuyên dùng nhưng KHO CHƯA CÓ
    const lines = text.split('\n');
    lines.forEach((line) => {
      if (
        line.includes('KHO HIỆN CHƯA CÓ') ||
        line.includes('chưa có trong kho') ||
        line.includes('Cần mua bổ sung') ||
        line.includes('mua thêm')
      ) {
        const cleanLine = line
          .replace(/^[\s*\-#\d.]+/, '')
          .replace(/\[KHO HIỆN CHƯA CÓ THUỐC NÀY - Cần mua bổ sung\]/i, '')
          .trim();
        if (cleanLine.length > 5) {
          outOfStock.push({
            name: cleanLine.split(/[:(-]/)[0].trim(),
            rawLine: cleanLine,
          });
        }
      }
    });

    // 3. Trích xuất ĐẦY ĐỦ toàn bộ nội dung Phần 3: "Hướng dẫn điều trị và theo dõi" do AI phân tích
    let extractedNote = '';

    // Tìm vị trí bắt đầu của Phần 3 (Hỗ trợ định dạng: "### 3.", "## 3.", "3. Hướng dẫn...", v.v.)
    const section3Match = text.match(/(?:^|\n)(?:#{1,4}\s*)?3[.)]\s*([^\n]+)/i);

    if (section3Match && section3Match.index !== undefined) {
      // Bắt đầu từ sau dòng tiêu đề phần 3
      const contentStartIndex = section3Match.index + section3Match[0].length;
      let rawSection3 = text.slice(contentStartIndex).trim();

      // Nếu có phần 4 tiếp theo (ví dụ: "### 4." hoặc "\n4. "), chỉ cắt đến trước phần 4
      const nextSectionMatch = rawSection3.match(/(?:^|\n)(?:#{1,4}\s*)?4[.)]\s+[A-ZÀ-Ỵ]/);
      if (nextSectionMatch && nextSectionMatch.index !== undefined) {
        rawSection3 = rawSection3.slice(0, nextSectionMatch.index).trim();
      }

      if (rawSection3) {
        extractedNote = cleanTreatmentNoteForHumans(rawSection3);
      }
    }

    // Nếu không khớp regex số 3, tìm các tiêu đề tương tự
    if (!extractedNote) {
      const altMatch = text.match(/(?:^|\n)(?:#{1,4}\s*)?(?:Hướng dẫn các bước điều trị|Phác đồ điều trị|Các bước điều trị|Hướng dẫn điều trị)[^\n]*/i);
      if (altMatch && altMatch.index !== undefined) {
        const altStartIndex = altMatch.index + altMatch[0].length;
        let altContent = text.slice(altStartIndex).trim();
        extractedNote = cleanTreatmentNoteForHumans(altContent);
      }
    }

    // Fallback nếu vẫn không tìm thấy
    if (!extractedNote) {
      extractedNote = `KẾ HOẠCH ĐIỀU TRỊ & THEO DÕI SỰ CỐ:\n\n` +
        `Phác đồ điều trị cho ${pondName} (Thể tích: ${waterVolume > 0 ? `${waterVolume} m³` : 'ao nuôi'}, DOC: ${docDays ? `${docDays} ngày` : 'chưa rõ'}):\n` +
        detected.map((d) => `- ${d.item.itemName}: ${d.quantity ? `${d.quantity} ${d.item.unit}` : 'theo hướng dẫn'}`).join('\n');
    }

    // Giới hạn an toàn tối đa 10000 ký tự theo yêu cầu
    if (extractedNote.length > 10000) {
      extractedNote = extractedNote.slice(0, 10000);
    }

    return { detected, outOfStock, extractedNote };
  };

  // Trích xuất danh sách thuốc/hóa chất thực sự được Bác sĩ AI đề xuất từ tin nhắn AI mới nhất
  const latestAiPlan = useMemo(() => {
    const lastAIMessage = [...chatHistory].reverse().find((m) => m.sender === 'ai')?.text || '';
    if (!lastAIMessage) {
      return { detected: [] as DetectedMedicine[], outOfStock: [] as OutOfStockItem[] };
    }
    const { detected, outOfStock } = parseAIPlan(lastAIMessage);
    return { detected, outOfStock };
  }, [chatHistory, inventories, waterVolume]);

  const handleOpenApplyModal = (aiText: string) => {
    const { detected, outOfStock, extractedNote } = parseAIPlan(aiText);
    setDetectedMedicines(detected);
    setOutOfStockItems(outOfStock);
    setModalTreatmentNote(extractedNote);
    setApplyModalOpen(true);
  };

  const handleConfirmApplyAIPlan = () => {
    const selectedToApply = detectedMedicines.filter((dm) => dm.selected);

    // Kiểm tra có thuốc nào bị lỗi vượt tồn kho không
    const hasOverStockError = selectedToApply.some((dm) => {
      const q = Number(dm.quantity);
      return !isNaN(q) && q > dm.item.quantity;
    });

    if (hasOverStockError) {
      setNotice({
        type: 'error',
        message: 'Có vật tư vượt quá số lượng tồn kho thực tế. Vui lòng điều chỉnh lại trước khi áp dụng.',
      });
      return;
    }

    // Hợp nhất vào selectedItems của đơn điều trị
    setSelectedItems((prev) => {
      const updated = [...prev];
      selectedToApply.forEach((dm) => {
        const existingIdx = updated.findIndex((si) => si.inventoryId === dm.inventoryId);
        if (existingIdx >= 0) {
          if (dm.quantity) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              quantity: dm.quantity,
              error: undefined,
            };
          }
        } else {
          updated.push({
            inventoryId: dm.inventoryId,
            item: dm.item,
            quantity: dm.quantity || '',
          });
        }
      });
      return updated;
    });

    // Cập nhật biện pháp can thiệp đã thực hiện
    if (modalTreatmentNote.trim()) {
      setTreatmentNote(modalTreatmentNote.trim());
    }

    setApplyModalOpen(false);
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));

    const appliedCount = selectedToApply.length;
    const missingCount = outOfStockItems.length;

    let successMsg = `Đã áp dụng phác đồ AI: Thêm ${appliedCount} loại thuốc/hóa chất vào đơn điều trị.`;
    if (missingCount > 0) {
      successMsg += ` (Lưu ý: Có ${missingCount} mặt hàng kho chưa có, cần mua bổ sung).`;
    }
    setNotice({
      type: 'success',
      message: successMsg,
    });

    // Cuộn mượt màn hình sang khu vực Kê đơn thuốc
    setTimeout(() => {
      const target = document.getElementById('prescription-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // 1. Tải chi tiết sự cố và danh mục kho thuốc/hóa chất
  const loadData = useCallback(async () => {
    setLoadingDetail(true);
    setLoadingInventory(true);
    let targetFarmId = incidentDetail.crop?.pond?.farm?.id || incident.crop?.pond?.farm?.id;
    try {
      const detail = await incidentService.getById(incident.id);
      setIncidentDetail(detail);
      if (detail.crop?.pond?.farm?.id) {
        targetFarmId = detail.crop.pond.farm.id;
      }
    } catch {
      // Giữ nguyên fallback props
    } finally {
      setLoadingDetail(false);
    }

    if (targetFarmId) {
      try {
        const invData = await inventoryService.getAll('', 'ALL', targetFarmId);
        const items: InventoryItem[] = Array.isArray(invData)
          ? invData
          : (invData as any).data || (invData as any).content || [];
        setInventories(items);
      } catch (err) {
        console.error('Lỗi tải danh mục kho:', err);
      } finally {
        setLoadingInventory(false);
      }
    } else {
      setLoadingInventory(false);
    }
  }, [incident.id, incident.crop?.pond?.farm?.id, incidentDetail.crop?.pond?.farm?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tự động tắt thông báo sau 5 giây
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Phím tắt ESC để đóng modal hoặc thu nhỏ khung chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (applyModalOpen) {
          setApplyModalOpen(false);
        } else if (isAiExpanded) {
          setIsAiExpanded(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiExpanded, applyModalOpen]);

  // 2. Tự động kích hoạt Bác sĩ AI phân tích lâm sàng khi mở Workspace
  const runAIAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    const prompt = `Phân tích sự cố thủy sản: "${incident.title}". 
Mô tả chi tiết: "${incident.description}". 
Địa điểm: ${pondName} - ${farmName} (Thể tích nước: ${waterVolume > 0 ? `${waterVolume} m³` : 'chưa xác định'}, DOC: ${docDays ? `${docDays} ngày` : 'chưa rõ'}).
Hãy thực hiện các nội dung sau:
1. Chẩn đoán các nguyên nhân có thể gây ra sự cố này và mức độ rủi ro.
2. Đối chiếu trực tiếp với danh mục thuốc & hóa chất hiện có trong kho trang trại:
   - Với thuốc/hóa chất CÓ SẴN TRONG KHO: Ghi rõ [CÓ SẴN TRONG KHO], tồn kho thực tế, công dụng và tính toán liều lượng cho thể tích ao ${waterVolume} m³ (ví dụ: cần dùng 6 kg).
   - Với thuốc/hóa chất KHO CHƯA CÓ: Ghi rõ [KHO HIỆN CHƯA CÓ THUỐC NÀY - Cần mua bổ sung], kèm công dụng, hoạt chất, liều lượng chuẩn và cách dùng.
3. Hướng dẫn các bước điều trị, thời điểm tạt/trộn thức ăn và các chỉ số môi trường nước cần theo dõi sát sao.
(Lưu ý: Trình bày câu chữ rõ ràng, dễ hiểu cho người nuôi tôm, tránh các công thức toán học rườm rà hay ký hiệu phức tạp).`;

    try {
      const res = await chatbotService.ask(prompt, pondId);
      setChatHistory([
        {
          id: 'init-ai-1',
          sender: 'ai',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể lấy kết quả phân tích từ AI.');
    } finally {
      setAiLoading(false);
    }
  }, [incident.title, incident.description, pondName, farmName, waterVolume, docDays, pondId]);

  const aiInitializedRef = useRef(false);

  useEffect(() => {
    if (!loadingDetail && !aiInitializedRef.current) {
      aiInitializedRef.current = true;
      runAIAnalysis();
    }
  }, [loadingDetail, runAIAnalysis]);

  // Gửi câu hỏi thêm cho AI
  const handleAskAI = async (customQuestion?: string) => {
    const q = customQuestion || aiChatInput;
    if (!q.trim() || aiLoading) return;
    if (!customQuestion) setAiChatInput('');

    const userMsg: AIChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const prompt = `Đối với sự cố "${incident.title}" tại ${pondName} (${waterVolume > 0 ? `Thể tích ao: ${waterVolume} m³` : ''}): ${q.trim()}.
(Lưu ý: Đối chiếu trực tiếp với kho thuốc/hóa chất trang trại, tính toán liều lượng chính xác và hướng dẫn cách dùng an toàn).`;
      const res = await chatbotService.ask(prompt, pondId);
      const aiMsg: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, aiMsg]);
    } catch {
      setNotice({ type: 'error', message: 'Không thể kết nối tới AI lúc này. Vui lòng thử lại.' });
    } finally {
      setAiLoading(false);
    }
  };

  // Danh mục kho thuốc/hóa chất đã lọc theo category và search
  const availableInventory = useMemo(() => {
    return inventories.filter((item) => {
      const isMedOrChem = item.category === 'MEDICINE' || item.category === 'CHEMICAL';
      if (!isMedOrChem) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (inventorySearch.trim()) {
        const query = inventorySearch.toLowerCase();
        return (
          item.itemName.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [inventories, categoryFilter, inventorySearch]);

  // Thêm thuốc vào đơn
  const handleAddItem = (id: string) => {
    if (!id) return;
    const item = inventories.find((i) => i.id === id);
    if (!item) return;
    if (selectedItems.some((si) => si.inventoryId === id)) {
      setNotice({ type: 'error', message: `"${item.itemName}" đã có sẵn trong đơn điều trị.` });
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        inventoryId: id,
        item,
        quantity: '',
      },
    ]);
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  // Xóa thuốc khỏi đơn
  const handleRemoveItem = (id: string) => {
    const itemToRemove = selectedItems.find((si) => si.inventoryId === id);
    setSelectedItems((prev) => prev.filter((si) => si.inventoryId !== id));

    // Tự động dọn dòng "- Áp dụng: [Tên thuốc]" trong biện pháp can thiệp nếu có
    if (itemToRemove) {
      setTreatmentNote((prev) => {
        if (!prev) return prev;
        const name = itemToRemove.item.itemName.toLowerCase();
        return prev
          .split('\n')
          .filter((line) => !line.toLowerCase().includes(name))
          .join('\n')
          .trim();
      });
    }
  };

  // Nhập liều lượng
  const handleItemQuantityChange = (id: string, val: string) => {
    setSelectedItems((prev) =>
      prev.map((si) => {
        if (si.inventoryId !== id) return si;
        const num = Number(val);
        let error: string | undefined;
        if (val && (!isNaN(num) && num > si.item.quantity)) {
          error = `Vượt tồn kho (Hiện có: ${si.item.quantity} ${si.item.unit})`;
        }
        return { ...si, quantity: val, error };
      })
    );
  };

  // Áp dụng nhanh thuốc được AI gợi ý
  const quickApplyMedicine = (medName: string, suggestedDose?: string) => {
    const match = inventories.find(
      (inv) =>
        inv.itemName.toLowerCase().includes(medName.toLowerCase()) ||
        medName.toLowerCase().includes(inv.itemName.toLowerCase())
    );

    const actualName = match?.itemName || medName;

    // 1. Kiểm tra nếu thuốc đã có sẵn trong đơn điều trị thì không thêm và không chèn lại ghi chú
    if (match && selectedItems.some((si) => si.inventoryId === match.id)) {
      setNotice({
        type: 'error',
        message: `"${actualName}" đã có trong đơn điều trị.`,
      });
      return;
    }

    // 2. Thêm vào danh sách vật tư xuất kho với định lượng đề xuất từ AI nếu có
    if (match) {
      const lastAIMessage = [...chatHistory].reverse().find((m) => m.sender === 'ai')?.text || '';
      const suggestedQty = suggestedDose || (lastAIMessage ? extractDosageForInventoryItem(match, lastAIMessage, waterVolume) : '');

      let itemError: string | undefined;
      if (suggestedQty) {
        const num = Number(suggestedQty);
        if (num > match.quantity) {
          itemError = `Vượt tồn kho (Hiện có: ${match.quantity} ${match.unit})`;
        }
      }

      setSelectedItems((prev) => [
        ...prev,
        {
          inventoryId: match.id,
          item: match,
          quantity: suggestedQty || '',
          error: itemError,
        },
      ]);
      setNotice({
        type: 'success',
        message: suggestedQty
          ? `Đã thêm "${actualName}" vào đơn điều trị: ${suggestedQty} ${match.unit} (Tồn kho: ${match.quantity} ${match.unit})`
          : `Đã thêm "${actualName}" vào đơn điều trị (Tồn kho: ${match.quantity} ${match.unit})`,
      });
    }

    // 3. Bổ sung vào biện pháp can thiệp (chỉ thêm nếu chưa có nội dung về thuốc này)
    setTreatmentNote((prev) => {
      const newLine = `- Áp dụng: ${actualName}`;
      if (!prev || !prev.trim()) {
        return `- Áp dụng phác đồ AI: ${actualName}`;
      }
      if (prev.toLowerCase().includes(actualName.toLowerCase())) {
        return prev;
      }
      return `${prev}\n${newLine}`;
    });

    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  // Xác thực biểu mẫu
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    let hasItemError = false;

    if (selectedItems.length > 0) {
      const updated = selectedItems.map((si) => {
        const qty = Number(si.quantity);
        let err: string | undefined;
        if (!si.quantity || isNaN(qty) || qty <= 0) {
          err = 'Vui lòng nhập liều lượng > 0';
          hasItemError = true;
        } else if (qty > si.item.quantity) {
          err = `Vượt tồn kho (${si.item.quantity} ${si.item.unit})`;
          hasItemError = true;
        }
        return { ...si, error: err };
      });
      setSelectedItems(updated);
    } else if (!treatmentNote.trim()) {
      errors.treatmentNote = 'Vui lòng nhập biện pháp điều trị hoặc chọn thuốc/hóa chất từ kho.';
    }

    // Kiểm tra độ dài tối đa 10.000 ký tự cho biện pháp can thiệp
    if (treatmentNote && treatmentNote.length > 10000) {
      errors.treatmentNote = 'Nội dung biện pháp không được vượt quá 10.000 ký tự.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && !hasItemError;
  };

  // Lưu đợt điều trị hoặc Hoàn tất đóng ca
  const handleRecordTreatment = async (shouldResolve = false) => {
    if (shouldResolve) {
      if (!isShrimpRecovered) {
        setNotice({
          type: 'error',
          message: 'Chỉ hoàn tất điều trị khi tôm đã hết bệnh! Nếu tôm vẫn đang trong phác đồ, vui lòng chọn "Lưu đợt điều trị (Tiếp tục theo dõi)".',
        });
        return;
      }
      if (!resultNote.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          resultNote: 'Vui lòng nhập đánh giá lâm sàng xác nhận tôm đã hết bệnh (ví dụ: tôm bắt mồi mạnh, đường ruột đầy, gan nâu đen, tỷ lệ bệnh 0%).',
        }));
        setNotice({
          type: 'error',
          message: 'Vui lòng nhập đánh giá lâm sàng xác nhận tôm đã hết bệnh trước khi hoàn tất điều trị.',
        });
        return;
      }
    }

    if (!validateForm()) {
      setNotice({
        type: 'error',
        message: 'Vui lòng kiểm tra lại liều lượng vật tư kho hoặc phương pháp điều trị.',
      });
      return;
    }

    if (shouldResolve) setResolving(true);
    else setSubmitting(true);
    setNotice(null);

    try {
      if (incidentDetail.status === 'OPEN') {
        try {
          await incidentService.startTreatment(incidentDetail.id);
        } catch {
          // Bỏ qua nếu đã bắt đầu
        }
      }

      let finalNote = treatmentNote.trim();
      const usageSummaries: string[] = [];

      // Khấu trừ kho vật tư cho từng mặt hàng đã chọn
      if (selectedItems.length > 0) {
        for (const si of selectedItems) {
          const qtyNum = Number(si.quantity);
          const usagePayload: { quantityUsed: number; notes?: string; pondId?: string } = {
            quantityUsed: qtyNum,
            notes: `[Điều trị sự cố ${pondName}: ${incidentDetail.title}] ${finalNote || 'Xuất kho điều trị'}`,
          };
          if (pondId && typeof pondId === 'string' && pondId.trim()) {
            usagePayload.pondId = pondId.trim();
          }
          await inventoryService.recordUsage(si.inventoryId, usagePayload);
          usageSummaries.push(`${si.item.itemName} (${qtyNum} ${si.item.unit})`);
        }
      }

      if (!finalNote && usageSummaries.length > 0) {
        finalNote = `Sử dụng: ${usageSummaries.join(', ')} để điều trị.`;
      }

      let fullTreatmentText = finalNote;
      if (usageSummaries.length > 0) {
        const usagePrefix = `[Xuất kho ${pondName}: ${usageSummaries.join(', ')}]`;
        fullTreatmentText = finalNote ? `${usagePrefix} ${finalNote}` : usagePrefix;
      }

      if (shouldResolve) {
        await incidentService.resolve(incidentDetail.id, {
          treatment: fullTreatmentText || 'Đã hoàn tất quá trình điều trị (Xác nhận tôm đã hết bệnh).',
          result: resultNote.trim() || undefined,
        });
        setNotice({
          type: 'success',
          message: '🎉 Chúc mừng! Đã hoàn tất điều trị thành công. Sự cố đã chuyển sang Lịch sử & Nhật ký điều trị.',
        });
      } else {
        await incidentService.addUpdate(incidentDetail.id, {
          treatment: fullTreatmentText,
          observation: observationNote.trim() || undefined,
          result: resultNote.trim() || undefined,
        });
        setNotice({
          type: 'success',
          message: selectedItems.length > 0
            ? `Đã lưu đợt điều trị và xuất kho ${selectedItems.length} loại vật tư! Bạn có thể tiếp tục can thiệp các đợt tiếp theo.`
            : 'Đã lưu đợt điều trị thành công! Sự cố tiếp tục được theo dõi trong Quá trình điều trị.',
        });
      }

      // Reset form
      setSelectedItems([]);
      setTreatmentNote('');
      setObservationNote('');
      setResultNote('');
      setIsShrimpRecovered(false);
      setFieldErrors({});
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Có lỗi xảy ra khi ghi nhận điều trị.',
      });
    } finally {
      setSubmitting(false);
      setResolving(false);
    }
  };

  // Mở lại sự cố
  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập lý do mở lại sự cố.' });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      await incidentService.reopen(incidentDetail.id, reopenReason.trim());
      setReopenReason('');
      setNotice({ type: 'success', message: 'Đã mở lại sự cố thành công!' });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể mở lại sự cố.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-16">
      {/* Toast Alert nổi */}
      {notice && (
        <div
          className={`fixed right-6 top-6 z-[200] flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-8 fade-in duration-300 ${notice.type === 'error'
            ? 'border-rose-200 bg-rose-50/95 text-rose-800'
            : 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
            }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          )}
          <p className="text-xs font-bold leading-snug">{notice.message}</p>
          <button
            onClick={() => setNotice(null)}
            className="ml-auto text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── BREADCRUMB & CLINICAL HEADER BAR ── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100/60 backdrop-blur-xl space-y-4">
        {/* Navigation row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:-translate-x-0.5 group"
              title="Quay lại danh sách sự cố"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
              <span>Quay lại</span>
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5 text-xs">

              <span className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">Quá trình điều trị</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loadingDetail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
              title="Làm mới dữ liệu từ hệ thống"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDetail ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
              <span>Đồng bộ</span>
            </button>
          </div>
        </div>

        {/* Center Clinical Case Card (Khối vấn đề sức khỏe tôm) */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 p-5 sm:p-6 text-center shadow-2xs">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-80 h-24 bg-indigo-100/50 blur-2xl rounded-full" />

          {/* Clinical eyebrow badge */}
          <div className="relative mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/90 px-3 py-1 text-[11px] font-extrabold text-indigo-700 shadow-2xs">
            <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
            <span className="tracking-wide uppercase">Vấn đề sức khỏe tôm đang xử lý</span>
          </div>

          {/* Main Title */}
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {incidentDetail.title}
            </h1>
            {incidentDetail.status === 'RESOLVED' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đã hoàn tất điều trị
              </span>
            )}
          </div>

          {/* Quick Metrics Ribbon (Telemetry Chips) */}
          <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-700 border border-slate-200/80 font-bold shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{farmName}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-cyan-800 border border-cyan-200/80 font-bold shadow-2xs">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              <span>Ao: <strong>{pondName}</strong></span>
              {waterVolume > 0 && (
                <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-100">
                  {waterVolume} m³
                </span>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-800 border border-indigo-200/80 font-bold shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>{stage}</span>
              {docDays && (
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                  DOC {docDays} ngày
                </span>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-600 border border-slate-200/80 font-semibold shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{incidentDetail.updates?.length || 0} đợt can thiệp</span>
            </span>
          </div>
        </div>

      </div>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      {/* Layout: 2 cột trên desktop - Trái (đơn điều trị) + Phải (AI luôn sticky) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* CỘT TRÁI: ĐƠN ĐIỀU TRỊ / VẬT TƯ / TIMELINE (7 Cột) */}
        <div className="space-y-5 col-span-12 lg:col-span-7">
          {/* Card 1: Dấu hiệu lâm sàng ao nuôi */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Dấu hiệu & Triệu chứng phát hiện</h3>
                  <p className="text-[11px] text-slate-400">Ghi nhận từ lúc báo cáo sự cố tại ao</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                Báo cáo: {new Date(incidentDetail.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>

            <div className="mt-3.5 rounded-2xl bg-amber-50/50 p-4 border border-amber-200/70 text-xs font-semibold leading-relaxed text-slate-800">
              {incidentDetail.description}
            </div>


          </div>

          {/* Card 2: Bảng Kê Đơn Thuốc & Trừ Kho Vật Tư */}
          <div id="prescription-section" className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5 scroll-mt-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-2xs">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Kê đơn thuốc & điều trị
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Chọn thuốc, nhập liều lượng thực tế và khấu trừ tự động vào kho
                  </p>
                </div>
              </div>
              <Package className="h-5 w-5 text-indigo-400" />
            </div>

            {!canUpdateTreatment && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs font-bold text-amber-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Chú ý: Bạn không được phân công xử lý sự cố này nên chỉ có quyền theo dõi.</span>
              </div>
            )}

            {incidentDetail.status === 'RESOLVED' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-900">Sự cố đã hoàn tất điều trị thành công!</h4>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      Tôm đã khỏe mạnh bình thường và hồ sơ đã được lưu trữ vào Lịch sử & Nhật ký điều trị.
                    </p>
                    {incidentDetail.resolvedAt && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-2">
                        Thời gian hoàn tất: {new Date(incidentDetail.resolvedAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>

                {(currentUserRole === 'FARM_MANAGER' || canUpdateTreatment) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Mở lại sự cố nếu tái phát
                    </h4>
                    <textarea
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      rows={2}
                      placeholder="Nhập lý do mở lại sự cố (ví dụ: phát hiện triệu chứng tái phát sau 3 ngày)..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-amber-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleReopen}
                      disabled={submitting}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Đang mở lại...' : 'Mở lại sự cố'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Khối chọn thuốc từ kho */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-indigo-600" />
                      <span>Vật tư xuất kho cho đợt điều trị này:</span>
                    </label>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('ALL')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'ALL'
                          ? 'bg-indigo-50 text-indigo-700 font-extrabold'
                          : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('MEDICINE')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'MEDICINE'
                          ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                          : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        <Pill className="w-3 h-3 text-emerald-600" /> Thuốc
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('CHEMICAL')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'CHEMICAL'
                          ? 'bg-blue-50 text-blue-700 font-extrabold'
                          : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        <FlaskConical className="w-3 h-3 text-blue-600" /> Hóa chất
                      </button>
                    </div>
                  </div>

                  {/* Search & Select Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="relative sm:col-span-5">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Tìm thuốc / hóa chất..."
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <select
                        value=""
                        onChange={(e) => handleAddItem(e.target.value)}
                        disabled={!canUpdateTreatment || loadingInventory}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="">+ Chọn mặt hàng từ kho để thêm vào đơn...</option>
                        {availableInventory.map((item) => {
                          const isChosen = selectedItems.some((si) => si.inventoryId === item.id);
                          return (
                            <option key={item.id} value={item.id} disabled={isChosen}>
                              [{item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}] {item.itemName} — Còn: {item.quantity} {item.unit} {isChosen ? '✓ (Đã có trong đơn)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Danh sách vật tư đã chọn */}
                  {selectedItems.length > 0 ? (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between px-1 text-xs">
                        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Đã kê ({selectedItems.length} mặt hàng):
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedItems([])}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          Xóa hết
                        </button>
                      </div>

                      {selectedItems.map((si) => (
                        <div
                          key={si.inventoryId}
                          className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 transition-all hover:border-indigo-200"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${si.item.category === 'MEDICINE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}
                              >
                                {si.item.category === 'MEDICINE' ? <Pill className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
                                {si.item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}
                              </span>
                              <span className="font-extrabold text-xs text-slate-900">{si.item.itemName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-500">
                                Tồn kho: <strong className="text-indigo-600 font-extrabold">{si.item.quantity} {si.item.unit}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(si.inventoryId)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa khỏi đơn"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-600 shrink-0">
                              Liều lượng dùng <span className="text-rose-500">*</span>:
                            </label>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={si.quantity}
                                onChange={(e) => handleItemQuantityChange(si.inventoryId, e.target.value)}
                                placeholder={`Nhập liều lượng (tối đa ${si.item.quantity})...`}
                                className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-3 pr-14 text-xs font-bold text-slate-800 outline-none transition-colors ${si.error
                                  ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                                  }`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 pointer-events-none">
                                {si.item.unit}
                              </span>
                            </div>
                          </div>

                          {si.error && (
                            <p className="text-right text-xs font-bold text-rose-600 flex items-center justify-end gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {si.error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-6 text-center text-xs text-slate-400">
                      <Package className="w-6 h-6 text-slate-300" />
                      <p className="font-semibold text-slate-500">Chưa chọn thuốc / hóa chất từ kho</p>
                      <p className="text-[11px] text-slate-400">
                        Bạn có thể chọn mặt hàng ở menu trên hoặc bấm <strong>"Thêm vào đơn"</strong> từ gợi ý Bác sĩ AI.
                      </p>
                    </div>
                  )}
                </div>

                {/* Khối Ghi chú Lâm sàng & Phương pháp điều trị */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                        Biện pháp can thiệp đã thực hiện {selectedItems.length === 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <span className={`text-[11px] font-semibold ${treatmentNote.length > 10000 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                        {treatmentNote.length.toLocaleString('vi-VN')} / 10.000 ký tự
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      maxLength={10000}
                      value={treatmentNote}
                      onChange={(e) => {
                        setTreatmentNote(e.target.value);
                        if (fieldErrors.treatmentNote) setFieldErrors((p) => ({ ...p, treatmentNote: undefined }));
                      }}
                      placeholder="Mô tả cách thức pha loãng, thời điểm tạt ao hoặc trộn thức ăn cho tôm..."
                      disabled={!canUpdateTreatment}
                      className={`w-full rounded-2xl border p-3.5 text-xs outline-none transition-colors ${fieldErrors.treatmentNote
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                        : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                        } disabled:opacity-60 font-medium leading-relaxed`}
                    />
                    {fieldErrors.treatmentNote && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.treatmentNote}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Quan sát phản ứng của tôm sau can thiệp <span className="text-slate-400 font-normal">(tùy chọn)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={observationNote}
                      onChange={(e) => setObservationNote(e.target.value)}
                      placeholder="Ví dụ: Tôm bớt tấp mé, bơi nhanh hơn sau 3 giờ tạt thuốc..."
                      disabled={!canUpdateTreatment}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-xs outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                        Kết quả & Đánh giá lâm sàng{' '}
                        {isShrimpRecovered ? (
                          <span className="text-rose-600 font-bold">* (Bắt buộc để đóng ca bệnh)</span>
                        ) : (
                          <span className="text-slate-400 font-normal">(tùy chọn)</span>
                        )}
                      </label>
                      {isShrimpRecovered && (
                        <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ✓ Chế độ nghiệm thu khỏi bệnh
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={resultNote}
                      onChange={(e) => {
                        setResultNote(e.target.value);
                        if (fieldErrors.resultNote) setFieldErrors((p) => ({ ...p, resultNote: undefined }));
                      }}
                      placeholder={
                        isShrimpRecovered
                          ? 'Nhập xác nhận tôm đã hết bệnh (ví dụ: Tôm ăn mạnh trở lại, đường ruột đầy đặn, gan nâu đen đặc trưng, không còn tôm tấp mé hoặc rớt đáy)...'
                          : 'Ghi nhận kết quả sau đợt dùng thuốc này...'
                      }
                      disabled={!canUpdateTreatment}
                      className={`w-full rounded-2xl border p-3.5 text-xs outline-none transition-colors ${fieldErrors.resultNote
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                        : isShrimpRecovered
                          ? 'border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                        } disabled:opacity-60 font-medium`}
                    />
                    {fieldErrors.resultNote && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.resultNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* Khối Nghiệm thu lâm sàng: Xác nhận khỏi bệnh */}
                <div
                  className={`rounded-2xl border p-4 transition-all ${isShrimpRecovered
                    ? 'border-emerald-300 bg-emerald-50/90 shadow-sm'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="confirmShrimpRecovered"
                      checked={isShrimpRecovered}
                      onChange={(e) => {
                        setIsShrimpRecovered(e.target.checked);
                        if (!e.target.checked && fieldErrors.resultNote) {
                          setFieldErrors((p) => ({ ...p, resultNote: undefined }));
                        }
                      }}
                      disabled={!canUpdateTreatment}
                      className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="confirmShrimpRecovered" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                        <ShieldCheck className={`w-4.5 h-4.5 ${isShrimpRecovered ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>Xác nhận tôm đã hết bệnh hoàn toàn & sức khỏe ao nuôi phục hồi</span>
                      </span>

                    </label>
                  </div>
                </div>

                {/* Nút Hành Động Điều Trị */}
                {canUpdateTreatment && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    {/* Nút 1: Lưu đợt điều trị */}
                    <button
                      type="button"
                      onClick={() => handleRecordTreatment(false)}
                      disabled={submitting || resolving}
                      className="flex-1 rounded-2xl bg-indigo-600 py-3.5 px-4 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang lưu đợt điều trị...</span>
                        </>
                      ) : (
                        <>
                          <Stethoscope className="w-4 h-4" />
                          <span>
                            {selectedItems.length > 0
                              ? `Lưu đợt điều trị & Trừ kho (${selectedItems.length} loại)`
                              : 'Lưu đợt điều trị (Tiếp tục theo dõi)'}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Nút 2: Hoàn tất điều trị */}
                    <button
                      type="button"
                      onClick={() => handleRecordTreatment(true)}
                      disabled={submitting || resolving}
                      className={`flex-1 rounded-2xl py-3.5 px-4 text-xs font-bold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${isShrimpRecovered
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                        : 'bg-slate-700 hover:bg-slate-800'
                        }`}
                      title={!isShrimpRecovered ? 'Vui lòng tích chọn "Xác nhận tôm đã hết bệnh" phía trên' : undefined}
                    >
                      {resolving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang hoàn tất...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Hoàn tất điều trị (Tôm đã khỏi bệnh)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Timeline các đợt điều trị */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Dòng thời gian các đợt điều trị ({incidentDetail.updates?.length || 0})
                </h3>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {incidentDetail.updates && incidentDetail.updates.length > 0 ? (
                incidentDetail.updates.map((upd: IncidentUpdate, idx: number) => (
                  <div
                    key={upd.id}
                    className="relative rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-2 transition-all hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[10px]">
                          {idx + 1}
                        </span>
                        <strong className="text-slate-800 text-xs">{upd.author?.fullName || 'Kỹ thuật viên'}</strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          {upd.eventType === 'STARTED'
                            ? 'Bắt đầu xử lý'
                            : upd.eventType === 'RESOLVED'
                              ? 'Nghiệm thu khỏi bệnh'
                              : 'Đợt can thiệp'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(upd.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 leading-relaxed font-semibold pl-8">
                      {upd.treatment}
                    </p>

                    {upd.observation && (
                      <div className="pl-8 text-xs text-slate-500 font-medium">
                        <span className="font-bold text-slate-600">Quan sát:</span> {upd.observation}
                      </div>
                    )}

                    {upd.result && (
                      <div className="pl-8 text-xs text-emerald-700 font-bold bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                        <span className="font-extrabold text-emerald-800">Kết quả lâm sàng:</span> {upd.result}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  Chưa có nhật ký điều trị nào được ghi nhận cho sự cố này.
                </div>
              )}
            </div>
          </div>

          {/* Mobile-only: AI Advisor section (hiện ở dưới nội dung chính trên mobile) */}
          <div className="lg:hidden rounded-3xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/40 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3 border-b border-sky-100 pb-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow border border-sky-200 p-1">
                <img src="/assets/treatment-robot-shrimp.png" alt="AI" className="h-full w-full object-contain" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-sky-950">Bác Sĩ Tôm AI</h3>
                <p className="text-[11px] text-sky-600 font-medium">Trợ lý phác đồ điều trị thông minh</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAiExpanded(true)}
                  className="flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-xs text-xs font-bold"
                  title="Mở rộng khung chat toàn màn hình (Dễ nhìn hơn)"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Mở rộng</span>
                </button>
                <button
                  type="button"
                  onClick={runAIAnalysis}
                  disabled={aiLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Phân tích lại ca bệnh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3 text-xs">
              {aiLoading && chatHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-sky-700 font-medium">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                  AI đang phân tích ca bệnh...
                </div>
              ) : chatHistory.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[95%] rounded-2xl p-3 text-xs leading-relaxed ${msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none shadow font-semibold'
                    : 'bg-white text-slate-800 border border-sky-200/90 rounded-bl-none shadow'
                    }`}>
                    {msg.sender === 'ai' ? (
                      <ClinicalReportRenderer content={msg.text} isExpanded={false} />
                    ) : (
                      <div className="whitespace-pre-wrap font-medium leading-relaxed">{msg.text}</div>
                    )}
                    {msg.sender === 'ai' && (
                      <div className="mt-2.5 pt-2 border-t border-sky-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-sky-700 font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Phác đồ phù hợp?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenApplyModal(msg.text)}
                          disabled={incidentDetail.status === 'RESOLVED' || !canUpdateTreatment}
                          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs hover:from-sky-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>Áp dụng vào đơn</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAskAI(); }} className="flex items-center gap-2 pt-1 border-t border-sky-100">
              <input
                type="text"
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                placeholder="Hỏi Bác sĩ AI về phác đồ, liều dùng..."
                disabled={aiLoading}
                className="flex-1 rounded-2xl border border-sky-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-sky-500 shadow-xs font-medium"
              />
              <button
                type="submit"
                disabled={!aiChatInput.trim() || aiLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-all shadow cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* CỘT PHẢI: BÁC SĨ TÔM - luôn hiển thị trên desktop, sticky khi cuộn */}
        <div className="hidden lg:block lg:col-span-5">
          {/* Wrapper sticky: luôn bám vào viewport khi cuộn trang */}
          <div className="sticky top-2" style={{ height: 'calc(100vh - 8rem)', maxHeight: '820px' }}>
            <div className="flex flex-col rounded-3xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/40 p-4 shadow-sm h-full overflow-hidden">
              {/* Header AI Copilot */}
              <div className="flex items-center justify-between border-b border-sky-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-xs border border-sky-200 p-1">
                    <img
                      src="/assets/treatment-robot-shrimp.png"
                      alt="Trợ lý Tôm AI"
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-sky-950">Bác Sĩ Tôm</h2>

                    </div>

                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAiExpanded(true)}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-2xs text-xs font-bold"
                    title="Mở rộng khung chat (Xem to hơn, dễ nhìn hơn)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Mở rộng</span>
                  </button>
                  <button
                    type="button"
                    onClick={runAIAnalysis}
                    disabled={aiLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Phân tích lại ca bệnh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* AI Messages View - Chứa cả vật tư kho đề xuất để lướt tự nhiên theo nội dung */}
              <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1 text-xs">
                {/* Quick Medicine Recommendation - Card list layout */}
                <div className="rounded-2xl border border-sky-200/80 bg-white overflow-hidden shadow-2xs">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-sky-50 to-indigo-50/60 border-b border-sky-100/80">
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-sky-900">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Vật tư kho (Phác đồ AI)
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 bg-white/80 px-1.5 py-0.5 rounded-md border border-sky-100">
                      Tự động tính liều
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-2 space-y-1">
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-[11px] text-sky-700 italic py-1.5 px-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-sky-500 shrink-0" />
                        <span>AI đang đối chiếu kho thuốc...</span>
                      </div>
                    ) : latestAiPlan.detected.length === 0 ? (
                      <div className="py-1.5 px-1 space-y-1.5">
                        <span className="text-[11px] text-slate-400 italic block">
                          {chatHistory.length === 0 ? 'Đang chờ Bác sĩ AI phân tích...' : 'Kho chưa có thuốc khớp chỉ định AI.'}
                        </span>
                        {latestAiPlan.outOfStock.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-700 block">Cần mua bổ sung:</span>
                            {latestAiPlan.outOfStock.slice(0, 3).map((oos, idx) => (
                              <div key={idx} className="flex items-center px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
                                <span className="text-[10px] font-semibold text-amber-800 truncate">{oos.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      latestAiPlan.detected.map((det) => {
                        const isAdded = selectedItems.some((si) => si.inventoryId === det.inventoryId);
                        return (
                          <button
                            key={det.inventoryId}
                            type="button"
                            onClick={() => quickApplyMedicine(det.item.itemName, det.quantity)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] transition-all cursor-pointer active:scale-[0.99] text-left group ${
                              isAdded
                                ? 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70'
                                : 'border-slate-200/70 bg-slate-50/60 hover:bg-sky-50 hover:border-sky-200'
                            }`}
                            title={isAdded ? 'Đã có trong đơn điều trị' : 'Nhấn để thêm vào đơn'}
                          >
                            <Pill className={`w-3.5 h-3.5 shrink-0 ${isAdded ? 'text-emerald-500' : 'text-sky-400'}`} />
                            <span className="flex-1 min-w-0 text-slate-700 font-semibold leading-tight truncate">
                              {det.item.itemName}
                            </span>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {det.quantity && (
                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                  {det.quantity} {det.item.unit}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline">({det.item.quantity})</span>
                              {isAdded ? (
                                <span className="text-[10px] text-emerald-600 font-black">✓</span>
                              ) : (
                                <span className="text-[10px] text-sky-500 font-black group-hover:text-sky-700">+</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                {/* Chẩn đoán & Phác đồ AI - Card cùng style với khung vật tư kho */}
                <div className="rounded-2xl border border-sky-200/80 bg-white overflow-hidden shadow-2xs">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-sky-50 to-indigo-50/60 border-b border-sky-100/80">
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-sky-900">
                      <img
                        src="/assets/treatment-robot-shrimp.png"
                        alt="AI"
                        className="h-3.5 w-3.5 object-contain rounded-full bg-sky-100 border border-sky-200 p-0.5"
                      />
                      Chẩn đoán &amp; Phác đồ Bác sĩ AI
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 bg-white/80 px-1.5 py-0.5 rounded-md border border-sky-100">
                      {chatHistory.filter(m => m.sender === 'ai').length} phân tích
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-2">
                    {aiLoading && chatHistory.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md border border-sky-200">
                          <img
                            src="/assets/treatment-robot-shrimp.png"
                            alt="AI"
                            className="h-10 w-10 object-contain animate-bounce"
                          />
                        </div>
                        <h4 className="text-sm font-extrabold text-sky-950">AI đang phân tích ca bệnh...</h4>
                        <p className="max-w-xs text-xs text-sky-700/80 leading-relaxed font-medium">
                          Đang tính toán liều lượng cho thể tích {waterVolume > 0 ? `${waterVolume} m³` : 'ao nuôi'} và đối chiếu kho thuốc thực tế...
                        </p>
                      </div>
                    ) : aiError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-2 m-1">
                        <p className="font-extrabold flex items-center gap-1.5 text-rose-700">
                          <AlertCircle className="w-4 h-4" /> Không thể chẩn đoán
                        </p>
                        <p className="text-rose-600">{aiError}</p>
                        <button
                          onClick={runAIAnalysis}
                          className="rounded-xl bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
                        >
                          Thử lại
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chatHistory.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`w-full rounded-xl p-3 text-xs leading-relaxed ${msg.sender === 'user'
                                ? 'bg-sky-600 text-white rounded-br-none shadow-sm font-semibold'
                                : 'bg-slate-50/80 text-slate-800 border border-slate-200/70 rounded-bl-none'
                                }`}
                            >
                              {msg.sender === 'ai' && (
                                <div className="mb-2 flex items-center gap-1.5 border-b border-sky-100 pb-1.5 text-[11px] font-black text-sky-900">
                                  <img
                                    src="/assets/treatment-robot-shrimp.png"
                                    alt="AI Mascot"
                                    className="h-4 w-4 rounded-full object-contain bg-sky-50 border border-sky-200 p-0.5"
                                  />
                                  <span>Chẩn đoán &amp; Phác đồ Bác sĩ AI:</span>
                                </div>
                              )}
                              {msg.sender === 'ai' ? (
                                <ClinicalReportRenderer content={msg.text} isExpanded={false} />
                              ) : (
                                <div className="whitespace-pre-wrap font-sans font-medium leading-relaxed">
                                  {msg.text}
                                </div>
                              )}

                              {msg.sender === 'ai' && (
                                <div className="mt-2.5 pt-2 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] text-sky-700 font-semibold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Phác đồ phù hợp với tình trạng ao?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApplyModal(msg.text)}
                                    disabled={incidentDetail.status === 'RESOLVED' || !canUpdateTreatment}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:from-sky-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={
                                      incidentDetail.status === 'RESOLVED'
                                        ? 'Sự cố đã hoàn tất điều trị'
                                        : !canUpdateTreatment
                                          ? 'Bạn không có quyền cập nhật điều trị'
                                          : 'Tự động kiểm tra kho, tính liều lượng và áp dụng vào đơn điều trị'
                                    }
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Áp dụng vào điều trị</span>
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 px-1 font-medium">{msg.timestamp}</span>
                          </div>
                        ))}

                        {aiLoading && (
                          <div className="flex items-center gap-2 text-xs text-sky-800 font-bold p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                            <span>Bác sĩ Tôm đang soạn câu trả lời...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Chat Input */}
              <div className="pt-2 border-t border-sky-100/90">

                {/* Chat Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskAI();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    placeholder="Hỏi Bác sĩ AI về phác đồ, liều dùng..."
                    disabled={aiLoading}
                    className="flex-1 rounded-2xl border border-sky-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-100 shadow-2xs font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!aiChatInput.trim() || aiLoading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-40 transition-all shadow-sm shadow-sky-600/25 cursor-pointer"
                    title="Gửi câu hỏi"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BÁC SĨ TÔM MỞ RỘNG TOÀN MÀN HÌNH (DỄ NHÌN HƠN) ── */}
      {isAiExpanded && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl border border-sky-300 bg-gradient-to-b from-sky-50/90 via-white to-sky-50/50 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-sky-200/80 bg-white/90 px-6 py-4">
              <div className="flex items-center gap-3.5">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-sky-200 p-1.5">
                  <img
                    src="/assets/treatment-robot-shrimp.png"
                    alt="Bác Sĩ Tôm"
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-sky-950">Bác Sĩ Tôm AI</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      Khung làm việc mở rộng
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-sky-700 font-medium mt-0.5">
                    <span>Ao: <strong>{pondName}</strong> ({farmName})</span>
                    <span>•</span>
                    <span>Thể tích nước: <strong>{waterVolume > 0 ? `${waterVolume} m³` : 'Chưa rõ'}</strong></span>
                    {docDays && (
                      <>
                        <span>•</span>
                        <span>DOC: <strong>{docDays} ngày</strong> ({stage})</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runAIAnalysis}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-xs text-xs font-bold disabled:opacity-50"
                  title="Phân tích lại ca bệnh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Phân tích lại</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAiExpanded(false)}
                  className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-all cursor-pointer shadow-xs text-xs font-bold"
                  title="Thu nhỏ khung chat về thanh bên (ESC)"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Thu nhỏ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAiExpanded(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Đóng (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body Messages Container (Spacious, larger text-sm, comfortable reading) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Quick Medicine Recommendation - Card đồng nhất */}
              <div className="rounded-2xl border border-sky-200/80 bg-white overflow-hidden shadow-2xs">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-50 to-indigo-50/60 border-b border-sky-100/80">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-sky-900">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Vật tư kho (Phác đồ AI)
                  </span>
                  <span className="text-xs font-semibold text-sky-600 bg-white/80 px-2 py-0.5 rounded-md border border-sky-100">
                    Đối chiếu tồn kho thực tế
                  </span>
                </div>

                {/* Content */}
                <div className="p-3 space-y-1.5">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-xs text-sky-700 italic py-2 px-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500 shrink-0" />
                      <span>Bác sĩ AI đang đối chiếu thuốc trong kho...</span>
                    </div>
                  ) : latestAiPlan.detected.length === 0 ? (
                    <div className="py-2 px-1 space-y-2">
                      <span className="text-xs text-slate-400 italic block">
                        {chatHistory.length === 0 ? 'Đang chờ Bác sĩ AI phân tích ca bệnh...' : 'Kho hiện chưa có sẵn thuốc khớp với chỉ định AI.'}
                      </span>
                      {latestAiPlan.outOfStock.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Thuốc AI khuyên dùng (cần mua ngoài):
                          </span>
                          {latestAiPlan.outOfStock.map((oos, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                              <span className="text-xs font-semibold text-amber-800 truncate">{oos.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {latestAiPlan.detected.map((det) => {
                        const isAdded = selectedItems.some((si) => si.inventoryId === det.inventoryId);
                        return (
                          <button
                            key={det.inventoryId}
                            type="button"
                            onClick={() => quickApplyMedicine(det.item.itemName, det.quantity)}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all cursor-pointer active:scale-[0.99] text-left group ${
                              isAdded
                                ? 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70'
                                : 'border-slate-200/70 bg-slate-50/50 hover:bg-sky-50 hover:border-sky-200'
                            }`}
                            title={isAdded ? 'Thuốc này đã có trong đơn điều trị' : 'Nhấn để thêm vào đơn điều trị'}
                          >
                            <Pill className={`w-4 h-4 shrink-0 ${isAdded ? 'text-emerald-500' : 'text-sky-400'}`} />
                            <span className="flex-1 min-w-0 text-slate-700 font-semibold leading-tight truncate">
                              {det.item.itemName}
                            </span>
                            <div className="shrink-0 flex items-center gap-2">
                              {det.quantity && (
                                <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 whitespace-nowrap">
                                  Liều: {det.quantity} {det.item.unit}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 whitespace-nowrap">(Tồn: {det.item.quantity} {det.item.unit})</span>
                              {isAdded ? (
                                <span className="text-xs text-emerald-600 font-black flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Đã thêm
                                </span>
                              ) : (
                                <span className="text-xs text-sky-500 font-black group-hover:text-sky-700">+ Thêm</span>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* Thuốc cần mua ngoài */}
                      {latestAiPlan.outOfStock.length > 0 && (
                        <div className="mt-1 pt-2 border-t border-sky-100/80 space-y-1.5">
                          <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Cần mua bổ sung ngoài kho:
                          </span>
                          {latestAiPlan.outOfStock.map((oos, idx) => (
                            <div key={idx} className="flex items-center px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                              <span className="text-xs font-semibold text-amber-800 truncate">{oos.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Chẩn đoán & Phác đồ AI - Card đồng nhất */}
              <div className="rounded-2xl border border-sky-200/80 bg-white overflow-hidden shadow-2xs">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-50 to-indigo-50/60 border-b border-sky-100/80">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-sky-900">
                    <img
                      src="/assets/treatment-robot-shrimp.png"
                      alt="AI"
                      className="h-4 w-4 object-contain rounded-full bg-sky-100 border border-sky-200 p-0.5"
                    />
                    Chẩn đoán &amp; Phác đồ Bác sĩ AI
                  </span>
                  <span className="text-xs font-semibold text-sky-600 bg-white/80 px-2 py-0.5 rounded-md border border-sky-100">
                    {chatHistory.filter(m => m.sender === 'ai').length} phân tích
                  </span>
                </div>

                {/* Body */}
                <div className="p-3">
                  {aiLoading && chatHistory.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-md border border-sky-200">
                        <img
                          src="/assets/treatment-robot-shrimp.png"
                          alt="AI"
                          className="h-16 w-16 object-contain animate-bounce"
                        />
                      </div>
                      <h4 className="text-base font-extrabold text-sky-950">AI đang phân tích lâm sàng ca bệnh...</h4>
                      <p className="max-w-md text-sm text-sky-700/80 leading-relaxed font-medium">
                        Đang tính toán liều lượng cho thể tích {waterVolume > 0 ? `${waterVolume} m³` : 'ao nuôi'} và đối chiếu kho thuốc thực tế...
                      </p>
                    </div>
                  ) : aiError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 space-y-2 m-1">
                      <p className="font-extrabold flex items-center gap-1.5 text-rose-700">
                        <AlertCircle className="w-5 h-5" /> Không thể chẩn đoán
                      </p>
                      <p className="text-rose-600">{aiError}</p>
                      <button
                        onClick={runAIAnalysis}
                        className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatHistory.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col gap-1.5 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`w-full rounded-xl p-4 text-sm leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-sky-600 text-white rounded-br-none shadow font-semibold'
                                : 'bg-slate-50/80 text-slate-800 border border-slate-200/70 rounded-bl-none'
                            }`}
                          >
                            {msg.sender === 'ai' && (
                              <div className="mb-2.5 flex items-center gap-2 border-b border-sky-100 pb-2 text-xs font-black text-sky-900">
                                <img
                                  src="/assets/treatment-robot-shrimp.png"
                                  alt="AI Mascot"
                                  className="h-5 w-5 rounded-full object-contain bg-sky-50 border border-sky-200 p-0.5"
                                />
                                <span>Chẩn đoán &amp; Phác đồ Bác sĩ AI:</span>
                              </div>
                            )}
                            {msg.sender === 'ai' ? (
                              <ClinicalReportRenderer content={msg.text} isExpanded={true} />
                            ) : (
                              <div className="whitespace-pre-wrap font-sans font-medium leading-relaxed text-sm">
                                {msg.text}
                              </div>
                            )}

                            {msg.sender === 'ai' && (
                              <div className="mt-3 pt-3 border-t border-sky-100 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs text-sky-700 font-semibold flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                  Phác đồ phù hợp với tình trạng ao nuôi hiện tại?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApplyModal(msg.text)}
                                  disabled={incidentDetail.status === 'RESOLVED' || !canUpdateTreatment}
                                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-sky-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Áp dụng vào điều trị &amp; kê đơn</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 px-2 font-medium">{msg.timestamp}</span>
                        </div>
                      ))}

                      {aiLoading && (
                        <div className="flex items-center gap-2.5 text-sm text-sky-800 font-bold p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                          <span>Bác sĩ Tôm đang soạn câu trả lời chuyên sâu...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Interactive Chat Input */}
            <div className="p-4 border-t border-sky-200/80 bg-white/90">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAI();
                }}
                className="flex items-center gap-3"
              >
                <input
                  type="text"
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  placeholder="Hỏi Bác sĩ AI về phác đồ, liều dùng, loại thuốc thay thế..."
                  disabled={aiLoading}
                  className="flex-1 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-100 shadow-2xs font-medium"
                />
                <button
                  type="submit"
                  disabled={!aiChatInput.trim() || aiLoading}
                  className="flex h-11 px-5 shrink-0 items-center gap-2 rounded-2xl bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-40 transition-all shadow-sm shadow-sky-600/25 cursor-pointer text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Gửi</span>
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL XÁC NHẬN ÁP DỤNG PHÁC ĐỒ AI VÀO ĐIỀU TRỊ ── */}
      {applyModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-gradient-to-r from-sky-50 via-indigo-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-xs border border-sky-200 p-1">
                  <img
                    src="/assets/treatment-robot-shrimp.png"
                    alt="Bác Sĩ Tôm"
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Áp Dụng Phác Đồ Bác Sĩ AI Vào Điều Trị
                  </h3>
                  <p className="text-xs text-sky-700 font-medium">
                    Tự động đối chiếu kho vật tư và tính toán liều lượng theo số liệu ao nuôi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
              {/* Dữ kiện thực tế ao nuôi */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-sky-900">
                  <Waves className="w-3.5 h-3.5 text-sky-600" />
                  {pondName} ({farmName})
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-sky-800">
                  Thể tích nước: <strong>{waterVolume > 0 ? `${waterVolume} m³` : 'Chưa xác định'}</strong>
                </span>
                {docDays && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-indigo-700">
                      DOC: <strong>{docDays} ngày</strong> ({stage})
                    </span>
                  </>
                )}
              </div>

              {/* Danh sách vật tư có sẵn trong kho đề xuất */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Vật tư kho đề xuất ({detectedMedicines.filter((d) => d.selected).length}/{detectedMedicines.length})</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Chọn và tinh chỉnh liều lượng xuất kho</span>
                </div>

                {detectedMedicines.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">
                    Không phát hiện tên thuốc nào có sẵn trong kho từ phác đồ này của AI.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detectedMedicines.map((dm, idx) => (
                      <div
                        key={dm.inventoryId}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${dm.selected
                          ? 'border-indigo-200 bg-indigo-50/30'
                          : 'border-slate-200 bg-slate-50/50 opacity-60'
                          }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            id={`dm-${dm.inventoryId}`}
                            checked={dm.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDetectedMedicines((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item))
                              );
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <label htmlFor={`dm-${dm.inventoryId}`} className="text-xs font-bold text-slate-900 cursor-pointer block truncate">
                              {dm.item.itemName}
                            </label>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                              <span className="text-slate-500">Tồn kho thực tế:</span>
                              <strong className="text-emerald-700 font-extrabold">{dm.item.quantity} {dm.item.unit}</strong>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                {dm.item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}
                              </span>
                            </div>
                            {dm.error && (
                              <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {dm.error}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Input liều lượng */}
                        <div className="flex items-center gap-2 shrink-0 sm:self-center pl-6 sm:pl-0">
                          <span className="text-xs text-slate-500 font-medium">Liều dùng:</span>
                          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Nhập số"
                              value={dm.quantity}
                              disabled={!dm.selected}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = Number(val);
                                let err: string | undefined;
                                if (val && !isNaN(num) && num > dm.item.quantity) {
                                  err = `Vượt tồn kho (${dm.item.quantity} ${dm.item.unit})`;
                                }
                                setDetectedMedicines((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, quantity: val, error: err } : item))
                                );
                              }}
                              className="w-20 text-xs font-bold text-slate-800 outline-none disabled:opacity-50"
                            />
                            <span className="text-xs font-extrabold text-slate-500 pl-1">{dm.item.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cảnh báo thuốc AI khuyên dùng nhưng kho chưa có */}
              {outOfStockItems.length > 0 && (
                <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Vật tư khuyến nghị nhưng KHO CHƯA CÓ ({outOfStockItems.length} mặt hàng):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2 text-[11px] font-medium leading-relaxed">
                    {outOfStockItems.map((item, i) => (
                      <li key={i}>
                        <strong className="text-amber-950">{item.name}</strong>: {item.rawLine}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-800 italic pt-0.5">
                    * Các loại thuốc này không có sẵn để khấu trừ kho. Bạn cần liên hệ mua bổ sung hoặc tham vấn Bác sĩ AI về hoạt chất thay thế tạm thời.
                  </p>
                </div>
              )}

              {/* Biện pháp can thiệp đã thực hiện */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Biện pháp can thiệp đã thực hiện (Tự động điền vào hồ sơ):
                  </label>
                  <span className={`text-[11px] font-semibold ${modalTreatmentNote.length > 10000 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                    {modalTreatmentNote.length.toLocaleString('vi-VN')} / 10.000 ký tự
                  </span>
                </div>
                <textarea
                  rows={8}
                  maxLength={10000}
                  value={modalTreatmentNote}
                  onChange={(e) => setModalTreatmentNote(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-3.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium text-slate-800 leading-relaxed font-sans"
                  placeholder="Mô tả các bước thực hiện can thiệp..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmApplyAIPlan}
                disabled={detectedMedicines.filter((d) => d.selected).some((d) => !!d.error)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác nhận áp dụng vào điều trị</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
