import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Package,
  X,
  Thermometer,
  FlaskConical,
  Waves,
  Check,
  Sparkles,
  ShieldAlert,
  Send,
  Bot,
  Wrench,
  Search,
  Building2,
  Layers,
  Pill,
  Trash2,
  AlertCircle,
  ClipboardList,
  BookOpen,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { chatbotService } from '../../services/chatbot.service';
import type { WaterWarningRecord, TreatmentAction, ChemicalItem, Farm, Pond, AIChatMessage } from './WaterTreatment';

export interface TreatmentUpdate {
  id: string;
  technicianName: string;
  treatment: string;
  observation?: string;
  result?: string;
  createdAt: string;
  eventType?: 'STARTED' | 'INTERVENTION' | 'RESOLVED';
  itemsUsed?: {
    name: string;
    quantity: number;
    unit: string;
  }[];
}

export interface WaterTreatmentWorkspaceProps {
  record: WaterWarningRecord;
  onBack: () => void;
  onSaved?: (updatedRecord: WaterWarningRecord) => void;
  ponds?: Pond[];
  farms?: Farm[];
  currentUserRole?: string;
  currentUserId?: string;
}

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface SelectedTreatmentItem {
  inventoryId: string;
  item: ChemicalItem;
  quantity: string;
  error?: string;
}

interface FieldErrors {
  treatmentNote?: string;
  resultNote?: string;
}

/**
 * Format inline text: removes raw markdown **bold**, `code` and converts into bold elements
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
        <code key={idx} className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded text-[11px] font-mono">
          {inner}
        </code>
      );
    }
    return part;
  });
}

interface ChemicalBlock {
  name: string;
  inStock: boolean;
  purpose?: string;
  dosage?: string;
  totalUsage?: string;
  note?: string;
  extra: string[];
}

function WaterClinicalReportRenderer({ content }: { content: string }) {
  const isStructuredReport = useMemo(() => {
    return (
      (content.includes('Đánh giá') || content.includes('Chẩn đoán') || content.includes('Nguy cơ')) &&
      (content.includes('Phác đồ') || content.includes('hóa chất') || content.includes('vi sinh') || content.includes('kho'))
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

    // --- Parse Section 1: Causes & Risk ---
    const s1Causes: { title: string; desc: string }[] = [];
    let s1RiskText = '';

    const s1Lines = section1Raw.split('\n');
    let isParsingRisk = false;

    s1Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.toLowerCase().includes('mức độ rủi ro') || trimmed.toLowerCase().includes('đánh giá rủi ro')) {
        isParsingRisk = true;
        const inlineRisk = trimmed.replace(/^[#*\-\s]*(?:mức độ rủi ro|đánh giá rủi ro)[:\s*]*/i, '').trim();
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
      } else if (trimmed.length > 5 && !trimmed.startsWith('#')) {
        s1Causes.push({ title: '', desc: trimmed.replace(/\*\*/g, '') });
      }
    });

    // --- Parse Section 2: Chemicals (In-stock vs Out-of-stock) ---
    const inStockList: ChemicalBlock[] = [];
    const outOfStockList: ChemicalBlock[] = [];
    let currentStockType: 'IN' | 'OUT' = 'IN';
    let currentChem: ChemicalBlock | null = null;

    const commitChem = () => {
      if (currentChem && currentChem.name) {
        if (currentChem.inStock) {
          inStockList.push(currentChem);
        } else {
          outOfStockList.push(currentChem);
        }
      }
      currentChem = null;
    };

    const s2Lines = section2Raw.split('\n');
    s2Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (
        (trimmed.includes('CÓ SẴN TRONG KHO') || trimmed.includes('CÓ SẴN')) &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('1.') &&
        !trimmed.startsWith('2.')
      ) {
        commitChem();
        currentStockType = 'IN';
        return;
      }

      if (
        (trimmed.includes('KHO CHƯA CÓ') || trimmed.includes('CHƯA CÓ TRONG KHO') || trimmed.includes('mua bổ sung')) &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('1.') &&
        !trimmed.startsWith('2.')
      ) {
        commitChem();
        currentStockType = 'OUT';
        return;
      }

      const isNewChemHeader =
        (/^\d+\.\s*/.test(trimmed) || /^-\s*\*\*/.test(trimmed) || /^-\s*Hóa chất/i.test(trimmed)) &&
        !trimmed.toLowerCase().includes('công dụng') &&
        !trimmed.toLowerCase().includes('liều lượng') &&
        !trimmed.toLowerCase().includes('tổng lượng') &&
        !trimmed.toLowerCase().includes('lưu ý') &&
        !trimmed.toLowerCase().includes('cách sử dụng');

      if (isNewChemHeader) {
        commitChem();
        let chemName = trimmed.replace(/^[\s*\-#\d.]+/, '').replace(/\*\*/g, '').trim();
        if (chemName.endsWith(':')) chemName = chemName.slice(0, -1).trim();
        const isExplicitOutOfStock = /\[kho chưa có\]|\[chưa có\]/i.test(chemName);
        chemName = chemName.replace(/\[.*?\]/g, '').trim();

        currentChem = {
          name: chemName,
          inStock: isExplicitOutOfStock ? false : currentStockType === 'IN',
          extra: [],
        };
        return;
      }

      if (currentChem) {
        const cleanLine = trimmed.replace(/^[\s*\-#\d.]+/, '');
        const lower = cleanLine.toLowerCase();
        if (lower.includes('công dụng')) {
          currentChem.purpose = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (lower.includes('liều lượng đề xuất') || lower.includes('liều lượng') || lower.includes('liều dùng')) {
          currentChem.dosage = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (lower.includes('tổng lượng cần dùng') || lower.includes('tổng lượng')) {
          currentChem.totalUsage = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (lower.includes('lưu ý') || lower.includes('cần mua')) {
          currentChem.note = cleanLine.replace(/^[^*:]*[:*]+\s*/i, '').replace(/\*\*/g, '').trim();
        } else {
          currentChem.extra.push(cleanLine.replace(/\*\*/g, '').trim());
        }
      }
    });
    commitChem();

    // --- Parse Section 3: Intervention Process & Metrics ---
    const stepGroups: { groupTitle: string; items: string[] }[] = [];
    const metrics: string[] = [];
    let closingAdvice = '';

    const s3Lines = section3Raw.split('\n');
    let currentGroup: { groupTitle: string; items: string[] } | null = null;
    let s3Phase: 'STEPS' | 'METRICS' | 'ADVICE' = 'STEPS';

    s3Lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.toLowerCase().includes('chỉ số cần đo lại') || trimmed.toLowerCase().includes('theo dõi')) {
        if (currentGroup) {
          stepGroups.push(currentGroup);
          currentGroup = null;
        }
        s3Phase = 'METRICS';
        return;
      }

      if (trimmed.toLowerCase().startsWith('hãy thực hiện') || trimmed.toLowerCase().includes('đảm bảo môi trường ao')) {
        if (currentGroup) {
          stepGroups.push(currentGroup);
          currentGroup = null;
        }
        s3Phase = 'ADVICE';
        return;
      }

      if (s3Phase === 'STEPS') {
        if (/^\d+\./.test(trimmed) || trimmed.includes('Buổi sáng') || trimmed.includes('Buổi chiều') || trimmed.includes('Chạy quạt')) {
          if (currentGroup) stepGroups.push(currentGroup);
          const cleanGroupTitle = trimmed.replace(/^[\s*\-#\d.]+/, '').replace(/\*\*/g, '').trim();
          currentGroup = { groupTitle: cleanGroupTitle, items: [] };
        } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const itemText = trimmed.replace(/^[\s*\-#]+/, '').replace(/\*\*/g, '').trim();
          if (currentGroup) {
            currentGroup.items.push(itemText);
          } else {
            currentGroup = { groupTitle: 'Quy trình tạt hóa chất & vận hành:', items: [itemText] };
          }
        }
      } else if (s3Phase === 'METRICS') {
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
          metrics.push(trimmed.replace(/^[\s*\-#\d.]+/, '').replace(/\*\*/g, '').trim());
        } else {
          metrics.push(trimmed.replace(/\*\*/g, '').trim());
        }
      } else if (s3Phase === 'ADVICE') {
        closingAdvice += (closingAdvice ? ' ' : '') + trimmed.replace(/\*\*/g, '').trim();
      }
    });
    if (currentGroup) stepGroups.push(currentGroup);

    return {
      causes: s1Causes,
      riskText: s1RiskText,
      inStockList,
      outOfStockList,
      stepGroups,
      metrics,
      closingAdvice,
    };
  }, [content]);

  // Fallback: If not structured report
  if (!isStructuredReport || (parsed.causes.length === 0 && parsed.inStockList.length === 0 && parsed.outOfStockList.length === 0 && parsed.stepGroups.length === 0)) {
    const paragraphs = content.split('\n\n');
    return (
      <div className="space-y-3 font-sans text-xs leading-relaxed text-slate-700">
        {paragraphs.map((p, pIdx) => {
          const trimmed = p.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('#')) {
            const cleanHeader = trimmed.replace(/^#+\s*/, '');
            return (
              <h4 key={pIdx} className="font-extrabold text-sky-950 text-xs sm:text-sm mt-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
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
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
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
    <div className="space-y-3 font-sans text-xs">
      {/* ── MỤC 1: ĐÁNH GIÁ MỨC ĐỘ & NGUY CƠ ── */}
      <div className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-sky-100">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
            <Waves className="w-3.5 h-3.5" />
          </div>
          <h4 className="font-extrabold text-sky-950 text-xs sm:text-[13px] tracking-tight">
            1. Đánh giá chất lượng nước & Nguy cơ
          </h4>
        </div>

        {parsed.causes.length > 0 && (
          <div className="space-y-1.5 mb-2.5">
            {parsed.causes.map((c, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-xl bg-white border border-sky-100 hover:border-sky-300 transition-colors"
              >
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                <div className="flex-1 leading-relaxed">
                  {c.title && <span className="font-bold text-sky-900 mr-1.5">{c.title}:</span>}
                  <span className="text-slate-700 font-medium">{c.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {parsed.riskText && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <span className="font-bold text-amber-950">Mức độ rủi ro: </span>
              <span className="font-medium text-amber-900">{parsed.riskText}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── MỤC 2: PHÁC ĐỒ HÓA CHẤT & VI SINH ── */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50/40 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-indigo-100">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
            <FlaskConical className="w-3.5 h-3.5" />
          </div>
          <h4 className="font-extrabold text-indigo-950 text-xs sm:text-[13px] tracking-tight">
            2. Phác đồ hóa chất & Vi sinh ao nuôi
          </h4>
        </div>

        {/* CÓ SẴN TRONG KHO */}
        {parsed.inStockList.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-1.5 px-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Vật tư có sẵn trong kho ({parsed.inStockList.length})
              </span>
            </div>

            <div className="space-y-2">
              {parsed.inStockList.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-emerald-200 bg-white p-2.5 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-black text-emerald-700 border border-emerald-200">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                    </div>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 uppercase">
                      Có sẵn
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 pl-0.5">
                    {item.purpose && (
                      <p className="flex items-start gap-1">
                        <span className="font-bold text-slate-700 shrink-0">Công dụng:</span>
                        <span>{item.purpose}</span>
                      </p>
                    )}
                    {item.dosage && (
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-900 font-bold text-[10px]">
                        <span className="shrink-0">💧 Liều đề xuất:</span>
                        <span className="text-sky-700">{item.dosage}</span>
                      </div>
                    )}
                    {item.totalUsage && (
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[10px]">
                        <span className="shrink-0">⚖️ Tổng lượng:</span>
                        <span className="text-emerald-700">{item.totalUsage}</span>
                      </div>
                    )}
                    {item.note && (
                      <p className="flex items-start gap-1 text-slate-500 italic">
                        <span className="font-bold text-slate-600 shrink-0">Lưu ý:</span>
                        <span>{item.note}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KHO CHƯA CÓ */}
        {parsed.outOfStockList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                Vật tư kho chưa có — Cần mua bổ sung ({parsed.outOfStockList.length})
              </span>
            </div>

            <div className="space-y-2">
              {parsed.outOfStockList.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-100 text-[10px] font-black text-amber-800 border border-amber-200">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-amber-950 text-xs">{item.name}</span>
                    </div>
                    <span className="rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-black text-amber-900 uppercase">
                      Chưa có trong kho
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 pl-0.5">
                    {item.purpose && (
                      <p className="flex items-start gap-1">
                        <span className="font-bold text-slate-700 shrink-0">Công dụng:</span>
                        <span>{item.purpose}</span>
                      </p>
                    )}
                    {item.dosage && (
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-amber-200 text-amber-950 font-bold text-[10px]">
                        <span className="shrink-0">Liều lượng đề xuất:</span>
                        <span className="text-amber-800">{item.dosage}</span>
                      </div>
                    )}
                    {item.totalUsage && (
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-amber-100/70 border border-amber-300 text-amber-950 font-bold text-[10px]">
                        <span className="shrink-0">⚖️ Tổng lượng cần dùng:</span>
                        <span className="text-amber-900">{item.totalUsage}</span>
                      </div>
                    )}
                    {item.note && (
                      <p className="flex items-start gap-1 text-amber-800 italic">
                        <span className="font-bold text-amber-900 shrink-0">Lưu ý:</span>
                        <span>{item.note}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MỤC 3: QUY TRÌNH CAN THIỆP & CHỈ SỐ THEO DÕI ── */}
      <div className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/80 via-white to-sky-50/40 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-teal-100">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs">
            <ClipboardList className="w-3.5 h-3.5" />
          </div>
          <h4 className="font-extrabold text-teal-950 text-xs sm:text-[13px] tracking-tight">
            3. Quy trình can thiệp & Chỉ số theo dõi
          </h4>
        </div>

        {/* Step groups */}
        {parsed.stepGroups.length > 0 && (
          <div className="space-y-2 mb-2.5">
            {parsed.stepGroups.map((group, gIdx) => (
              <div key={gIdx} className="rounded-xl bg-white border border-teal-100/90 p-2.5 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-black shrink-0">
                    {gIdx + 1}
                  </span>
                  <span className="font-bold text-teal-950 text-xs">{group.groupTitle}</span>
                </div>
                {group.items.length > 0 && (
                  <ul className="space-y-1 pl-6">
                    {group.items.map((item, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                        <span>{renderInlineText(item)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Re-measurement metrics */}
        {parsed.metrics.length > 0 && (
          <div className="p-2.5 rounded-xl bg-sky-50/90 border border-sky-200/80 text-sky-950 text-xs space-y-1.5 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-sky-900">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[11px]">Các chỉ số cần đo lại sau 2 - 4 giờ:</span>
            </div>
            <ul className="space-y-1 pl-1">
              {parsed.metrics.map((m, mIdx) => (
                <li key={mIdx} className="flex items-start gap-1.5 text-[11px] text-slate-700 font-medium">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span>{renderInlineText(m)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Closing advice */}
        {parsed.closingAdvice && (
          <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-[11px] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{parsed.closingAdvice}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WaterTreatmentWorkspace({
  record,
  onBack,
  onSaved,
  ponds = [],
  farms = [],
}: WaterTreatmentWorkspaceProps) {
  // ── User Information ────────────────────────────────────────────────────────
  const [currentUser] = useState<any>(() => {
    try {
      const str = localStorage.getItem('user');
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  });

  // ── Local Record Detail ─────────────────────────────────────────────────────
  const [currentRecord, setCurrentRecord] = useState<WaterWarningRecord>(record);

  // Synchronize when record prop changes
  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  // ── Pond & Volume Computation ───────────────────────────────────────────────
  const matchedPond = useMemo(() => {
    return (
      ponds.find((p) => p.id === currentRecord.pondId || p.name === currentRecord.pondName) || null
    );
  }, [ponds, currentRecord]);

  const matchedFarm = useMemo(() => {
    if (matchedPond?.farmId) {
      return farms.find((f) => f.id === matchedPond.farmId) || null;
    }
    return null;
  }, [farms, matchedPond]);

  const farmDisplayName = matchedFarm?.name || currentRecord.farmName || 'Trang trại';
  const pondDisplayName = matchedPond?.name || currentRecord.pondName || 'Ao nuôi';
  const areaSize = Number(matchedPond?.areaSize) || 1000;
  const depth = Number(matchedPond?.depth) || 1.2;
  const waterVolume = Math.round(areaSize * depth * 10) / 10;

  // ── Inventory & Prescription State (Giống hệt TreatmentWorkspace) ───────────
  const [inventory, setInventory] = useState<ChemicalItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventorySearch, setInventorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CHEMICAL' | 'MEDICINE'>('ALL');

  // Multi-item selection state
  const [selectedItems, setSelectedItems] = useState<SelectedTreatmentItem[]>(() => {
    if (record.treatment) {
      return [
        {
          inventoryId: record.treatment.chemicalId,
          item: {
            id: record.treatment.chemicalId,
            name: record.treatment.chemicalName,
            stock: 999,
            unit: record.treatment.unit,
            category: 'Hóa chất xử lý nước',
          },
          quantity: record.treatment.quantity.toString(),
        },
      ];
    }
    return [];
  });

  const [treatmentNote, setTreatmentNote] = useState(record.treatment?.note || '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ── AI Copilot State ────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiChatInput, setAiChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Fetch Inventory ─────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const invRes = await inventoryService.getAll();
      const rawItems = Array.isArray(invRes) ? invRes : (invRes as any)?.data || [];

      const filtered = rawItems
        .filter((item: any) => item.category === 'CHEMICAL' || item.category === 'MEDICINE')
        .map((item: any) => ({
          id: item.id,
          name: item.itemName || item.name || 'Hóa chất/Vi sinh',
          stock: Number(item.quantity) || 0,
          unit: item.unit || 'kg',
          category: item.category === 'MEDICINE' ? 'Chế phẩm vi sinh / Thuốc' : 'Hóa chất xử lý nước',
        }));

      setInventory(filtered);
    } catch {
      setInventory([
        { id: 'c1', name: 'Vôi Dolomite (CaMg(CO3)2)', stock: 500, unit: 'kg', category: 'Hóa chất xử lý nước' },
        { id: 'c2', name: 'Yucca Zeolite hấp thu khí độc', stock: 120, unit: 'lít', category: 'Hóa chất xử lý nước' },
        { id: 'c3', name: 'Men vi sinh Bacillus phân hủy bùn đáy', stock: 45, unit: 'gói', category: 'Chế phẩm vi sinh / Thuốc' },
        { id: 'c4', name: 'Oxy viên cấp tốc (Sodium Percarbonate)', stock: 80, unit: 'kg', category: 'Hóa chất xử lý nước' },
        { id: 'c5', name: 'Khoáng tạt tổng hợp tạo kiềm', stock: 250, unit: 'kg', category: 'Hóa chất xử lý nước' },
        { id: 'c6', name: 'BKC 80% diệt khuẩn nước', stock: 60, unit: 'lít', category: 'Hóa chất xử lý nước' },
      ]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Available inventory filtered by category & search
  const availableInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchCat =
        categoryFilter === 'ALL'
          ? true
          : categoryFilter === 'CHEMICAL'
            ? item.category.includes('Hóa chất')
            : item.category.includes('vi sinh') || item.category.includes('Thuốc');
      return matchSearch && matchCat;
    });
  }, [inventory, inventorySearch, categoryFilter]);

  // ── Inventory Item Add / Remove / Quantity Handlers ─────────────────────────
  const handleAddItem = (itemId: string) => {
    if (!itemId) return;
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (selectedItems.some((si) => si.inventoryId === item.id)) {
      addToast('Mặt hàng đã tồn tại', `"${item.name}" đã có trong đơn điều trị.`, 'error');
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        inventoryId: item.id,
        item,
        quantity: '',
      },
    ]);

    setTreatmentNote((prev) => {
      const newLine = `- Áp dụng: ${item.name}`;
      if (!prev || !prev.trim()) return newLine;
      if (prev.toLowerCase().includes(item.name.toLowerCase())) return prev;
      return `${prev}\n${newLine}`;
    });
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = selectedItems.find((si) => si.inventoryId === id);
    setSelectedItems((prev) => prev.filter((si) => si.inventoryId !== id));

    if (itemToRemove) {
      setTreatmentNote((prev) => {
        if (!prev) return prev;
        const name = itemToRemove.item.name.toLowerCase();
        return prev
          .split('\n')
          .filter((line) => !line.toLowerCase().includes(name))
          .join('\n')
          .trim();
      });
    }
  };

  const handleItemQuantityChange = (id: string, val: string) => {
    setSelectedItems((prev) =>
      prev.map((si) => {
        if (si.inventoryId !== id) return si;
        const num = Number(val);
        let error: string | undefined;
        if (val && (!isNaN(num) && num > si.item.stock)) {
          error = `Vượt tồn kho (Hiện có: ${si.item.stock} ${si.item.unit})`;
        }
        return { ...si, quantity: val, error };
      })
    );
  };

  // ── AI Analysis Runner ──────────────────────────────────────────────────────
  const runAIAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError('');

    const prompt = `Phân tích và hướng dẫn xử lý sự cố môi trường nước ao nuôi tôm:
- Ao nuôi: "${pondDisplayName}" thuộc "${farmDisplayName}".
- Thể tích nước ước tính: ${waterVolume} m³ (Diện tích: ${areaSize} m², Độ sâu: ${depth} m).
- Thời gian đo: ${currentRecord.time} ngày ${currentRecord.date}.
- Tình trạng cảnh báo: ${currentRecord.hazardLevel === 'DANGER' ? 'MỨC NGUY HIỂM' : 'MỨC CẢNH BÁO'} (${currentRecord.summaryText}).
- Các chỉ số đo lường chi tiết:
  + Nhiệt độ: ${currentRecord.parameters.temperature} °C
  + Độ pH: ${currentRecord.parameters.ph}
  + Oxy hòa tan (DO): ${currentRecord.parameters.dissolvedOxygen} mg/L
  + Độ mặn: ${currentRecord.parameters.salinity} ppt
  + Độ kiềm: ${currentRecord.parameters.alkalinity} mg/L
  + Khí độc NH3: ${currentRecord.parameters.nh3} mg/L
  ${currentRecord.parameters.h2s ? `+ Khí độc H2S: ${currentRecord.parameters.h2s} mg/L` : ''}
  ${currentRecord.parameters.transparency ? `+ Độ trong: ${currentRecord.parameters.transparency} cm` : ''}

Hãy thực hiện đầy đủ các nội dung theo cấu trúc sau:
1. Đánh giá mức độ & Nguy cơ: Chẩn đoán nguyên nhân và đánh giá nguy cơ đối với tôm (sốc môi trường, ngạt, ngộ độc).
2. Phác đồ hóa chất & vi sinh:
   - Với hóa chất CÓ SẴN TRONG KHO: Ghi rõ [CÓ SẴN], tên sản phẩm, công dụng và tính toán liều lượng chuẩn cho thể tích ao ${waterVolume} m³ (ví dụ: cần 25 kg vôi Dolomite).
   - Với hóa chất KHO CHƯA CÓ: Ghi rõ [KHO CHƯA CÓ], đề xuất bổ sung kèm liều lượng chuẩn.
3. Quy trình can thiệp & Chỉ số theo dõi:
   - Các bước tạt men/hóa chất, thời điểm (sáng sớm hay chiều mát), số giờ chạy quạt nước.
   - Các chỉ số cần đo lại sau 2 - 4 giờ.`;

    try {
      const res = await chatbotService.ask(prompt, currentRecord.pondId);
      setChatHistory([
        {
          id: 'init-env-ai',
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
  }, [currentRecord, pondDisplayName, farmDisplayName, waterVolume, areaSize, depth]);

  useEffect(() => {
    runAIAnalysis();
  }, [runAIAnalysis]);

  // ── Two-way Chat with AI ────────────────────────────────────────────────────
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
      const prompt = `Đối với sự cố môi trường "${currentRecord.summaryText}" tại ao ${pondDisplayName} (Thể tích nước: ${waterVolume} m³): ${q.trim()}.
(Lưu ý: Đối chiếu trực tiếp với kho hóa chất/chế phẩm sinh học trang trại, tính toán liều lượng chính xác theo thể tích nước và hướng dẫn cách can thiệp an toàn).`;

      const res = await chatbotService.ask(prompt, currentRecord.pondId);
      const aiMsg: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, aiMsg]);
    } catch {
      addToast('Lỗi kết nối', 'Không thể kết nối tới AI lúc này. Vui lòng thử lại.', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // ── 1-Click Apply AI Plan into Prescription ───────────────────────────────
  const handleApplyAIPlan = (aiText: string) => {
    let matchedChem = inventory.find((item) =>
      aiText.toLowerCase().includes(item.name.toLowerCase())
    );

    if (!matchedChem) {
      if (aiText.toLowerCase().includes('dolomite') || aiText.toLowerCase().includes('vôi')) {
        matchedChem = inventory.find(
          (i) => i.name.toLowerCase().includes('vôi') || i.name.toLowerCase().includes('dolomite')
        );
      } else if (aiText.toLowerCase().includes('yucca')) {
        matchedChem = inventory.find((i) => i.name.toLowerCase().includes('yucca'));
      } else if (aiText.toLowerCase().includes('vi sinh') || aiText.toLowerCase().includes('men vi sinh')) {
        matchedChem = inventory.find(
          (i) => i.name.toLowerCase().includes('vi sinh') || i.category.includes('Thuốc')
        );
      } else if (aiText.toLowerCase().includes('oxy viên') || aiText.toLowerCase().includes('oxygen')) {
        matchedChem = inventory.find((i) => i.name.toLowerCase().includes('oxy'));
      } else if (aiText.toLowerCase().includes('khoáng') || aiText.toLowerCase().includes('bicarbonate')) {
        matchedChem = inventory.find(
          (i) => i.name.toLowerCase().includes('khoáng') || i.name.toLowerCase().includes('bicarbonate')
        );
      }
    }

    // Extract dosage
    const qtyRegex = /(?:dùng|tạt|cần|liều lượng|đánh|sử dụng)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|lít|l|gói|bao)/i;
    const match = aiText.match(qtyRegex);
    const parsedQty = match && match[1] ? match[1].replace(',', '.') : '15';

    if (matchedChem) {
      if (!selectedItems.some((si) => si.inventoryId === matchedChem!.id)) {
        setSelectedItems((prev) => [
          ...prev,
          {
            inventoryId: matchedChem!.id,
            item: matchedChem!,
            quantity: parsedQty,
          },
        ]);
      }
    }

    // Extract technical directives note
    let noteText = '';
    const section3Match = aiText.match(/(?:^|\n)(?:#{1,4}\s*)?3[.)]\s*([^\n]+)/i);
    if (section3Match && section3Match.index !== undefined) {
      const contentStartIndex = section3Match.index + section3Match[0].length;
      noteText = aiText.slice(contentStartIndex).trim();
    } else {
      noteText =
        'Can thiệp theo phác đồ Chuyên Gia AI: Tạt đều mặt ao lúc chiều mát, kết hợp chạy quạt nước 2 tiếng và đo lại kiểm tra sau 3 giờ.';
    }

    const cleanedNote = noteText.replace(/[*#_`]/g, '').trim().slice(0, 500);
    setTreatmentNote(cleanedNote);

    addToast(
      'Áp dụng thành công',
      matchedChem
        ? `Đã trích xuất "${matchedChem.name}" (${parsedQty} ${matchedChem.unit}) và hướng dẫn can thiệp vào đơn xử lý!`
        : 'Đã trích xuất phác đồ và chỉ dẫn kỹ thuật vào đơn xử lý!',
      'success'
    );
  };

  // ── Form Validation ─────────────────────────────────────────────────────────
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
        } else if (qty > si.item.stock) {
          err = `Vượt tồn kho (${si.item.stock} ${si.item.unit})`;
          hasItemError = true;
        }
        return { ...si, error: err };
      });
      setSelectedItems(updated);
    } else if (!treatmentNote.trim()) {
      errors.treatmentNote = 'Vui lòng nhập biện pháp can thiệp hoặc chọn hóa chất từ kho.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && !hasItemError;
  };

  // ── Execute Single-Step Treatment & Deduct Inventory ───────────────────────
  const handleExecuteTreatment = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      // 1. Deduct all selected items from backend inventory store
      for (const si of selectedItems) {
        const qty = Number(si.quantity);
        if (!isNaN(qty) && qty > 0) {
          try {
            await inventoryService.recordUsage(si.inventoryId, {
              quantityUsed: qty,
              usageDate: new Date().toISOString(),
              notes: `[Xử lý môi trường - ${pondDisplayName}] ${treatmentNote.trim()}`,
              pondId: currentRecord.pondId,
            });
          } catch {
            /* ignore individual network drop */
          }
        }
      }

      const now = new Date();
      const timeStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      // 2. Build updated TreatmentAction
      const updatedTreatment: TreatmentAction = {
        chemicalId: selectedItems[0]?.inventoryId || 'tech-op',
        chemicalName:
          selectedItems.map((si) => `${si.quantity} ${si.item.unit} ${si.item.name}`).join(', ') ||
          'Can thiệp kỹ thuật',
        quantity: Number(selectedItems[0]?.quantity) || 1,
        unit: selectedItems[0]?.item.unit || 'lần',
        note: treatmentNote.trim() || 'Đã can thiệp xử lý chất lượng nước ao nuôi.',
        technicianName: currentUser?.fullName || 'KTV. Kỹ thuật ao nuôi',
        timestamp: timeStr,
      };

      const savedMapStr = localStorage.getItem('water_treatments_map');
      const treatmentsMap: Record<string, TreatmentAction> = savedMapStr ? JSON.parse(savedMapStr) : {};
      treatmentsMap[currentRecord.id] = updatedTreatment;
      localStorage.setItem('water_treatments_map', JSON.stringify(treatmentsMap));

      const updatedRecord: WaterWarningRecord = {
        ...currentRecord,
        status: 'TREATED',
        treatment: updatedTreatment,
      };
      setCurrentRecord(updatedRecord);

      // 3. Update local inventory stock view
      setInventory((prev) =>
        prev.map((item) => {
          const matched = selectedItems.find((si) => si.inventoryId === item.id);
          if (matched) {
            const used = Number(matched.quantity) || 0;
            return { ...item, stock: Math.max(0, item.stock - used) };
          }
          return item;
        })
      );

      addToast(
        'Hoàn tất can thiệp thành công!',
        `Đã ghi nhận xử lý nước ao ${pondDisplayName}, trừ tồn kho vật tư và chuyển vào Lịch sử.`,
        'success'
      );

      if (onSaved) {
        onSaved(updatedRecord);
      }
    } catch {
      addToast('Lỗi lưu trữ', 'Không thể hoàn tất thao tác. Vui lòng thử lại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 font-sans antialiased text-slate-800">
      {/* ── Toast Alert Container ─────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-6 z-[200] flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border text-xs sm:text-sm animate-in slide-in-from-right-8 duration-300 backdrop-blur-xl ${
                t.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                  : t.type === 'error'
                    ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                    : 'bg-indigo-50/95 border-indigo-200 text-indigo-900'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
              {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
              {t.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs uppercase tracking-wider">{t.title}</h4>
                <p className="mt-0.5 font-medium text-xs opacity-90">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── BREADCRUMB & CLINICAL HEADER BAR (Identical to TreatmentWorkspace) ─ */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100/60 backdrop-blur-xl space-y-4">
        {/* Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:-translate-x-0.5 group"
              title="Quay lại danh sách cảnh báo môi trường"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
              <span>Quay lại</span>
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                Quá trình xử lý môi trường nước
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchInventory();
                runAIAnalysis();
              }}
              disabled={aiLoading || loadingInventory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
              title="Làm mới dữ liệu từ hệ thống"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
              <span>Đồng bộ</span>
            </button>
          </div>
        </div>

        {/* Center Clinical Case Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 p-5 sm:p-6 text-center shadow-2xs">
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-80 h-24 bg-indigo-100/50 blur-2xl rounded-full" />

          {/* Clinical Eyebrow Badge */}
          <div className="relative mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/90 px-3 py-1 text-[11px] font-extrabold text-indigo-700 shadow-2xs">
            <Droplets className="w-3.5 h-3.5 text-indigo-600" />
            <span className="tracking-wide uppercase">Vấn đề chất lượng nước đang xử lý</span>
          </div>

          {/* Main Title */}
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {currentRecord.summaryText}
            </h1>
            {currentRecord.status === 'TREATED' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đã hoàn tất xử lý
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Chờ xử lý cấp bách
              </span>
            )}
          </div>

          {/* Quick Metrics Ribbon (Telemetry Chips - Exactly like Shrimp Health) */}
          <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-700 border border-slate-200/80 font-bold shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{farmDisplayName}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-cyan-800 border border-cyan-200/80 font-bold shadow-2xs">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              <span>Ao: <strong>{pondDisplayName}</strong></span>
              {waterVolume > 0 && (
                <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-100">
                  {waterVolume.toLocaleString('vi-VN')} m³
                </span>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-800 border border-indigo-200/80 font-bold shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Diện tích {areaSize} m² · Sâu {depth}m</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-600 border border-slate-200/80 font-semibold shadow-2xs">
              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentRecord.status === 'TREATED' ? 'Đã can thiệp' : 'Chờ can thiệp (1 bước)'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── BẢNG THÔNG SỐ ĐO LƯỜNG THỰC TẾ & CẢNH BÁO AO (FULL WIDTH HÀNG TRÊN) ──── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Thông Số Đo Lường Thực Tế Tại Ao Nuôi</h3>
              <p className="text-[11px] text-slate-400">Các chỉ số ô đỏ là các thông số vượt ngưỡng an toàn cần can thiệp</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/60 shrink-0">
            Đo lúc: <strong>{currentRecord.time}</strong> ({currentRecord.date})
          </span>
        </div>

        {/* Cảnh báo tóm tắt */}
        <div className="rounded-2xl bg-amber-50/60 p-4 border border-amber-200/80 text-xs font-semibold leading-relaxed text-slate-800 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-amber-900 font-extrabold uppercase tracking-wider text-[11px]">
              Tình trạng cảnh báo môi trường:
            </strong>
            <span className="text-slate-800 font-medium">{currentRecord.summaryText}</span>
          </div>
        </div>

        {/* Grid 6 chỉ số nước: 2 cột mobile, 3 cột tablet, 6 cột desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {[
            {
              key: 'dissolvedOxygen',
              label: 'Oxy hòa tan (DO)',
              val: currentRecord.parameters.dissolvedOxygen,
              unit: 'mg/L',
              icon: <Waves className="w-3.5 h-3.5" />,
              ideal: '> 4.0 mg/L',
            },
            {
              key: 'ph',
              label: 'Độ pH',
              val: currentRecord.parameters.ph,
              unit: '',
              icon: <FlaskConical className="w-3.5 h-3.5" />,
              ideal: '7.5 - 8.5',
            },
            {
              key: 'alkalinity',
              label: 'Độ kiềm',
              val: currentRecord.parameters.alkalinity,
              unit: 'mg/L',
              icon: <FlaskConical className="w-3.5 h-3.5" />,
              ideal: '100 - 160 mg/L',
            },
            {
              key: 'nh3',
              label: 'Khí độc NH3',
              val: currentRecord.parameters.nh3,
              unit: 'mg/L',
              icon: <AlertTriangle className="w-3.5 h-3.5" />,
              ideal: '< 0.30 mg/L',
            },
            {
              key: 'salinity',
              label: 'Độ mặn',
              val: currentRecord.parameters.salinity,
              unit: 'ppt',
              icon: <Droplets className="w-3.5 h-3.5" />,
              ideal: '10 - 25 ppt',
            },
            {
              key: 'temperature',
              label: 'Nhiệt độ',
              val: currentRecord.parameters.temperature,
              unit: '°C',
              icon: <Thermometer className="w-3.5 h-3.5" />,
              ideal: '25 - 30°C',
            },
          ].map((param) => {
            const isTriggered = currentRecord.triggeredParams.includes(param.key);

            return (
              <div
                key={param.key}
                className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                  isTriggered
                    ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                }`}
              >
                {isTriggered && (
                  <div className="absolute top-2 right-2">
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[8px] font-black uppercase tracking-wider">
                      Vượt ngưỡng
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
                  <span className={isTriggered ? 'text-rose-600' : 'text-teal-600'}>{param.icon}</span>
                  <span className={isTriggered ? 'text-rose-900 font-extrabold' : 'text-slate-700'}>
                    {param.label}
                  </span>
                </div>

                <div className={`text-xl font-black ${isTriggered ? 'text-rose-600' : 'text-slate-900'}`}>
                  {param.val}{' '}
                  <span className="text-xs font-semibold text-slate-500">{param.unit}</span>
                </div>

                <div className="mt-1 text-[10px] font-bold text-slate-400">
                  Ngưỡng: <span className="text-slate-600 font-extrabold">{param.ideal}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTENT (2 COLUMNS: 7 cols trái, 5 cols phải) ──── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* ── CỘT TRÁI: PHÁC ĐỒ CAN THIỆP & KÊ ĐƠN VẬT TƯ (7 Cột) ── */}
        <div className="space-y-5 col-span-12 lg:col-span-7">
          {/* Card 2: Phác Đồ Can Thiệp & Kê Đơn Vật Tư Xử Lý Nước */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-6">
            {/* Header: Title, Pond Water Volume, Prescription Counter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-200/70 shadow-xs">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Kê đơn vật tư & phác đồ can thiệp
                    </h2>
                    {currentRecord.status === 'TREATED' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ XỬ LÝ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                        <Clock className="w-3 h-3 text-amber-600" /> CHỜ CAN THIỆP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                    <span>Áp dụng cho: <strong className="text-slate-700">{pondDisplayName}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-bold border border-teal-200/60 text-[11px]">
                      <Droplets className="w-3 h-3 text-teal-600" />
                      Thể tích nước: {waterVolume.toLocaleString('vi-VN')} m³
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {selectedItems.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã kê {selectedItems.length} mặt hàng
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200 shadow-2xs">
                    <Package className="w-3.5 h-3.5" />
                    Chưa chọn vật tư
                  </span>
                )}
              </div>
            </div>

            {/* Khối Chọn Hóa Chất & Vật Tư Từ Kho */}
            {currentRecord.status !== 'TREATED' && (
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-slate-50/30 p-4 space-y-4">
                {/* Thanh điều hướng kho: Tab loại & Gợi ý nhanh */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-teal-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Kho dược phẩm & vật tư xử lý:
                    </span>
                  </div>

                  {/* Filter tabs theo danh mục */}
                  <div className="inline-flex items-center rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('ALL')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        categoryFilter === 'ALL'
                          ? 'bg-teal-50 text-teal-700 font-extrabold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Tất cả ({inventory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('MEDICINE')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        categoryFilter === 'MEDICINE'
                          ? 'bg-emerald-50 text-emerald-700 font-extrabold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Pill className="w-3 h-3 text-emerald-600" />
                      Vi sinh / Men
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('CHEMICAL')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        categoryFilter === 'CHEMICAL'
                          ? 'bg-blue-50 text-blue-700 font-extrabold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FlaskConical className="w-3 h-3 text-blue-600" />
                      Hóa chất / Khoáng
                    </button>
                  </div>
                </div>

                {/* Search Box & Select Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                  <div className="relative sm:col-span-5">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="Tìm theo tên vật tư / hoạt chất..."
                      className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 shadow-2xs"
                    />
                    {inventorySearch && (
                      <button
                        type="button"
                        onClick={() => setInventorySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-7">
                    <select
                      value=""
                      onChange={(e) => handleAddItem(e.target.value)}
                      disabled={loadingInventory}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer shadow-2xs"
                    >
                      <option value="">+ Chọn mặt hàng từ kho để thêm vào đơn...</option>
                      {availableInventory.map((item) => {
                        const isChosen = selectedItems.some((si) => si.inventoryId === item.id);
                        const isLowStock = item.stock <= 5;
                        return (
                          <option key={item.id} value={item.id} disabled={isChosen}>
                            [{item.category.includes('vi sinh') ? 'Vi sinh' : 'Hóa chất'}] {item.name} — Còn: {item.stock} {item.unit} {isLowStock ? '⚠️ (Sắp hết)' : ''} {isChosen ? '✓ (Đã có trong đơn)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Danh Sách Mặt Hàng Đã Kê Đơn */}
                {selectedItems.length > 0 ? (
                  <div className="space-y-3 pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between px-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                        <span className="font-extrabold text-slate-800">
                          Bảng kê đơn thực tế ({selectedItems.length} mặt hàng):
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer hover:underline"
                      >
                        Xóa tất cả
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {selectedItems.map((si) => {
                        const isMedicine = si.item.category.includes('vi sinh') || si.item.category.includes('Thuốc');
                        const qtyNum = Number(si.quantity);
                        const concPer1000m3 = !isNaN(qtyNum) && qtyNum > 0 && waterVolume > 0
                          ? ((qtyNum / waterVolume) * 1000).toFixed(1)
                          : null;

                        return (
                          <div
                            key={si.inventoryId}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 transition-all hover:border-teal-300 hover:shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black border ${
                                    isMedicine
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  {isMedicine ? <Pill className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
                                  {isMedicine ? 'Vi sinh / Men' : 'Hóa chất'}
                                </span>
                                <span className="font-black text-sm text-slate-900 tracking-tight">
                                  {si.item.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                  Tồn kho: <strong className="text-teal-700 font-black">{si.item.stock} {si.item.unit}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(si.inventoryId)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa khỏi đơn"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Dòng nhập liều lượng & nồng độ tính toán */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                              <label className="sm:col-span-4 text-xs font-extrabold text-slate-700 flex items-center gap-1">
                                <span>Liều lượng xuất kho</span>
                                <span className="text-rose-500">*</span>:
                              </label>

                              <div className="sm:col-span-8 flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={si.quantity}
                                    onChange={(e) => handleItemQuantityChange(si.inventoryId, e.target.value)}
                                    placeholder={`Nhập số lượng (tối đa ${si.item.stock})...`}
                                    className={`w-full rounded-xl border py-2 pl-3.5 pr-14 text-xs font-black text-slate-800 outline-none transition-colors ${
                                      si.error
                                        ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                                        : 'border-slate-200 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
                                    }`}
                                  />
                                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                                    {si.item.unit}
                                  </span>
                                </div>

                                {concPer1000m3 && (
                                  <span className="shrink-0 text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 hidden md:inline-block">
                                    ~{concPer1000m3} {si.item.unit}/1.000m³
                                  </span>
                                )}
                              </div>
                            </div>

                            {si.error && (
                              <p className="text-right text-xs font-bold text-rose-600 flex items-center justify-end gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {si.error}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-7 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-700">Chưa có hóa chất hoặc chế phẩm nào trong đơn</p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Chọn từ danh sách kho ở trên hoặc nhấn nút <strong>"Áp dụng phác đồ"</strong> từ gợi ý Chuyên Gia AI bên phải.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Khối Ghi chú thao tác & Nút hành động */}
            {currentRecord.status === 'TREATED' ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-emerald-950">
                      Phiếu can thiệp đã hoàn tất
                    </h3>
                    <p className="text-xs text-emerald-700 font-medium">
                      Người thực hiện: <strong>{currentRecord.treatment?.technicianName || 'KTV'}</strong> • {currentRecord.treatment?.timestamp}
                    </p>
                  </div>
                </div>

                {currentRecord.treatment?.chemicalName && (
                  <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Vật tư / Hóa chất đã xuất kho
                    </div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">📦</span>
                      <span>{currentRecord.treatment.chemicalName}</span>
                    </div>
                  </div>
                )}

                {currentRecord.treatment?.note && (
                  <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Biện pháp can thiệp đã thực hiện
                    </div>
                    <div className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-line">
                      {currentRecord.treatment.note}
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Khuyến nghị theo dõi:</strong> Dữ liệu chất lượng nước sẽ được cập nhật tự động khi bạn tiến hành đo đạc ở cữ đo tiếp theo tại màn hình <em>Ghi nhận thông số</em>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onBack}
                  className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại danh sách cảnh báo</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Hướng dẫn thao tác */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                      Biện pháp can thiệp & Hướng dẫn thao tác{' '}
                      {selectedItems.length === 0 && <span className="text-rose-500">*</span>}
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        treatmentNote.length > 10000 ? 'text-rose-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {treatmentNote.length.toLocaleString('vi-VN')} / 10.000 ký tự
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    maxLength={10000}
                    value={treatmentNote}
                    onChange={(e) => {
                      setTreatmentNote(e.target.value);
                      if (fieldErrors.treatmentNote) setFieldErrors((p) => ({ ...p, treatmentNote: undefined }));
                    }}
                    placeholder="Ghi rõ thời điểm tạt, thời gian chạy quạt nước, cách thức hòa tan..."
                    className={`w-full rounded-2xl border p-3.5 text-xs outline-none transition-colors ${
                      fieldErrors.treatmentNote
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                        : 'border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
                    } font-medium leading-relaxed`}
                  />
                  {fieldErrors.treatmentNote && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {fieldErrors.treatmentNote}
                    </p>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80 flex items-start gap-2.5 text-xs text-sky-900">
                  <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Cơ chế can thiệp 1 bước:</strong> Sau khi hoàn tất can thiệp và xuất kho, hiệu quả phục hồi chất lượng nước ao nuôi sẽ được tự động đối chiếu qua lần đo thông số môi trường kế tiếp.
                  </p>
                </div>

                {/* 1 Nút bấm duy nhất: Hoàn tất can thiệp & Trừ kho */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteTreatment}
                    disabled={submitting}
                    className="w-full rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-800 py-3.5 px-6 text-sm font-black text-white shadow-md shadow-teal-600/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang lưu can thiệp & Xuất kho vật tư...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>
                          {selectedItems.length > 0
                            ? `Hoàn tất can thiệp & Trừ kho (${selectedItems.length} mặt hàng)`
                            : 'Hoàn tất can thiệp kỹ thuật'}
                        </span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-400 font-medium mt-1.5">
                    Hệ thống sẽ tự động trừ kho tương ứng và lưu lịch sử xử lý môi trường
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CỘT PHẢI: CHUYÊN GIA MÔI TRƯỜNG NƯỚC AI & SỔ TAY KỸ THUẬT (5 Cột) ───────── */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="rounded-3xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/40 shadow-sm overflow-hidden flex flex-col max-h-[580px]">
            {/* AI Specialist Header */}
            <div className="flex items-center justify-between border-b border-sky-100 p-4 bg-white/80 backdrop-blur-xs">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-xs border border-sky-200 p-1">
                  <Bot className="w-6 h-6 text-sky-600" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-sky-950 tracking-tight">
                      Chuyên Gia Môi Trường Nước AI
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-100 text-[10px] font-bold text-sky-700">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Trợ lý
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-700 font-medium">
                    Tự động tính liều theo thể tích {waterVolume.toLocaleString('vi-VN')} m³ nước
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={runAIAnalysis}
                disabled={aiLoading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                title="Phân tích lại chỉ số môi trường"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* AI Content & Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[300px]">
              {aiLoading && chatHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md border border-sky-200">
                    <Bot className="w-7 h-7 text-sky-600 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-black text-sky-950">AI đang phân tích thông số môi trường...</h4>
                  <p className="max-w-xs text-[11px] text-sky-700/80 leading-relaxed font-medium">
                    Đang tính toán liều lượng cho thể tích {waterVolume > 0 ? `${waterVolume.toLocaleString('vi-VN')} m³` : 'ao nuôi'} và đối chiếu kho hóa chất trang trại...
                  </p>
                </div>
              ) : aiError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Lỗi phân tích AI
                  </p>
                  <p>{aiError}</p>
                  <button
                    onClick={runAIAnalysis}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`w-full max-w-[96%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-sky-600 text-white rounded-br-none shadow font-semibold ml-auto'
                            : 'bg-white text-slate-800 border border-sky-200/90 rounded-bl-none shadow-xs space-y-3'
                        }`}
                      >
                        {msg.sender === 'ai' ? (
                          <>
                            <div className="flex items-center gap-1.5 pb-2 border-b border-sky-100 text-[11px] font-black text-sky-950">
                              <Bot className="w-4 h-4 text-sky-600" />
                              <span>Phác đồ xử lý môi trường chuyên sâu:</span>
                            </div>

                            <WaterClinicalReportRenderer content={msg.text} />

                            {/* 1-Click Apply AI Plan Button */}
                            <div className="pt-2.5 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-sky-700 font-bold flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                Phác đồ phù hợp với tình trạng ao?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleApplyAIPlan(msg.text)}
                                className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-xs hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Áp dụng vào đơn xử lý</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans font-medium">{msg.text}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 px-1 font-medium">{msg.timestamp}</span>
                    </div>
                  ))}

                  {aiLoading && (
                    <div className="flex items-center gap-2 text-xs text-sky-800 font-bold p-3 rounded-xl bg-sky-50 border border-sky-200/70">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                      <span>Chuyên gia AI đang soạn câu trả lời chuyên sâu...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input Field */}
            <div className="p-3.5 border-t border-sky-100 bg-white/95 backdrop-blur-xs">
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
                  placeholder="Hỏi chuyên gia AI thêm về phác đồ ao này..."
                  disabled={aiLoading}
                  className="flex-1 rounded-2xl border border-sky-200 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 shadow-2xs font-medium"
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

          {/* Hộp 2: Sổ Tay Ngưỡng Kỹ Thuật & Cẩm Nang Can Thiệp (Lấp đầy khoảng trống dưới AI Chat) */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-200/60 shadow-2xs">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Sổ Tay Ngưỡng Kỹ Thuật Ao Nuôi
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Quy chuẩn chất lượng nước an toàn cho tôm thẻ / sú
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                TCVN 13656
              </span>
            </div>

            {/* Bảng tra cứu ngưỡng an toàn */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                  <span>Oxy hòa tan (DO)</span>
                  <span className="text-teal-700 font-black">&gt; 4.0 mg/L</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">Cấp cứu ngay nếu &lt; 3.0 mg/L</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                  <span>Độ pH nước</span>
                  <span className="text-teal-700 font-black">7.5 - 8.5</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">Biên độ ngày/đêm &lt; 0.5</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                  <span>Độ kiềm (Alkalinity)</span>
                  <span className="text-teal-700 font-black">100 - 160</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">mg/L CaCO3 giúp cứng vỏ</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                  <span>Khí độc NH3</span>
                  <span className="text-teal-700 font-black">&lt; 0.30 mg/L</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">Độc tính tăng mạnh khi pH cao</p>
              </div>
            </div>

            {/* Lưu ý kỹ thuật vận hành */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950 space-y-1.5">
              <div className="font-extrabold flex items-center gap-1.5 text-amber-900 text-[11px] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Quy tắc vàng khi can thiệp nước:
              </div>
              <ul className="space-y-1.5 text-[11px] text-amber-900/90 leading-relaxed list-disc list-inside">
                <li><strong>Sự cố Oxy / Khí độc:</strong> Bật toàn bộ quạt nước liên tục, giảm 50% hoặc ngưng cữ ăn gần nhất.</li>
                <li><strong>Tạt men vi sinh:</strong> Đánh vi sinh vào 20h - 22h đêm để phân hủy mùn bã hữu cơ đáy ao hiệu quả.</li>
                <li><strong>Hóa chất cải tạo:</strong> Tạt vôi/khoáng vào sáng sớm hoặc chiều mát, tránh trưa nắng gắt.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
