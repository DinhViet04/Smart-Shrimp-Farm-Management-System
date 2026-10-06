import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Scale,
  DollarSign,
  Package,
  Target,
  Activity,
  Sparkles,
  Edit2,
} from 'lucide-react';
import { cropService, type Crop, type HarvestSummaryResponse } from '../services/crop.service';

interface HarvestDetailModalProps {
  isOpen: boolean;
  crop: Crop;
  onClose: () => void;
  onEditHarvest?: (crop: Crop) => void;
}

const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
};

export default function HarvestDetailModal({
  isOpen,
  crop,
  onClose,
  onEditHarvest,
}: HarvestDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'inventory' | 'comparison'>('summary');
  const [harvestSummary, setHarvestSummary] = useState<HarvestSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !crop) return;
    let isMounted = true;
    setLoading(true);

    cropService
      .getHarvestSummary(crop.id)
      .then((res) => {
        if (isMounted) setHarvestSummary(res);
      })
      .catch((err) => {
        console.error('Error fetching harvest summary details:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, crop]);

  if (!isOpen) return null;

  const actualKg = crop.actualHarvestKg || 0;
  const actualSize = crop.actualHarvestSize || 0;
  const actualCount = crop.actualHarvestCount || (actualKg > 0 && actualSize > 0 ? Math.round(actualKg * actualSize) : 0);
  const actualPrice = crop.actualHarvestPricePerKg || 0;
  const actualRevenue = crop.actualHarvestRevenue || (actualKg > 0 && actualPrice > 0 ? Math.round(actualKg * actualPrice) : 0);
  const actualCost = crop.actualHarvestCost || (harvestSummary?.summary.totalCost ?? 0);
  const actualProfit = crop.actualHarvestProfit !== null && crop.actualHarvestProfit !== undefined
    ? crop.actualHarvestProfit
    : actualRevenue - actualCost;
  const actualFcr = crop.actualHarvestFcr || (actualKg > 0 && harvestSummary?.summary.totalFeedKg ? parseFloat((harvestSummary.summary.totalFeedKg / actualKg).toFixed(2)) : 0);
  const actualSurvival = crop.actualHarvestSurvivalRate || (crop.initialShrimpCount > 0 && actualCount > 0 ? parseFloat(((actualCount / crop.initialShrimpCount) * 100).toFixed(1)) : 0);

  const tons = (actualKg / 1000).toFixed(2);
  const docDays = crop.actualHarvestDate
    ? Math.max(1, Math.round((new Date(crop.actualHarvestDate).getTime() - new Date(crop.startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : (crop.expectedDurationDays || 90);

  // Targets
  const targetBiomassKg = (crop.targetSurvivalRate && crop.targetHarvestSize && crop.initialShrimpCount)
    ? Math.round(((crop.initialShrimpCount * crop.targetSurvivalRate) / 100) / crop.targetHarvestSize)
    : null;
  const targetFcr = (crop.targetTotalFeedKg && targetBiomassKg && targetBiomassKg > 0)
    ? parseFloat((crop.targetTotalFeedKg / targetBiomassKg).toFixed(2))
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[92vh] flex flex-col relative">
        {/* Top Gradient Banner */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-400 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0 bg-slate-50/50">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 mt-0.5">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Báo Cáo Thu Hoạch Vụ Nuôi: {crop.pond?.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {crop.pond?.farm?.name || 'Trang trại'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Đã thu hoạch
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Ngày thả: <strong className="text-slate-700">{new Date(crop.startDate).toLocaleDateString('vi-VN')}</strong> •
                Ngày thu: <strong className="text-slate-700">{crop.actualHarvestDate ? new Date(crop.actualHarvestDate).toLocaleDateString('vi-VN') : 'Đã hoàn tất'}</strong> •
                Thời gian nuôi: <strong className="text-emerald-700">{docDays} ngày</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200/80 px-6 gap-2 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            Tổng Kết Thu Hoạch & Lời / Lỗ
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            Đối Chiếu Chỉ Tiêu Ban Đầu
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Vật Tư Kho Đã Sử Dụng
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Sản lượng */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
                  <span className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider block">
                    Sản lượng thu
                  </span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {actualKg > 0 ? actualKg.toLocaleString() : '--'}{' '}
                    <span className="text-xs font-normal text-slate-500">kg</span>
                  </div>
                  <span className="text-xs font-black text-blue-700 mt-0.5 block">
                    ≈ {tons} tấn
                  </span>
                </div>

                {/* 2. Size tôm */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Size tôm
                  </span>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    {actualSize > 0 ? actualSize : '--'}{' '}
                    <span className="text-xs font-normal text-slate-500">con/kg</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 mt-0.5 block">
                    ~ {actualSize > 0 ? (1000 / actualSize).toFixed(1) : 0} g/con
                  </span>
                </div>

                {/* 3. Tỷ lệ sống */}
                <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
                  <span className="text-[10.5px] font-bold text-purple-700 uppercase tracking-wider block">
                    Tỷ lệ sống
                  </span>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    {actualSurvival > 0 ? `${actualSurvival}%` : '--'}
                  </div>
                  <span className="text-xs font-bold text-purple-700 mt-0.5 block">
                    {actualCount > 0 ? actualCount.toLocaleString() : '--'} con
                  </span>
                </div>

                {/* 4. FCR */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
                  <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider block">
                    Hệ số FCR
                  </span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    {actualFcr > 0 ? actualFcr : '--'}
                  </div>
                  <span className="text-xs font-bold text-amber-700 mt-0.5 block">
                    Thức ăn: {crop.harvestFeedKg ? `${crop.harvestFeedKg.toLocaleString()} kg` : '--'}
                  </span>
                </div>
              </div>

              {/* Financial Box */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-black text-white">Kết Quả Tài Chính Vụ Nuôi</h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    Giá bán: <strong className="text-emerald-400">{formatVND(actualPrice)} đ/kg</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-400 block">Doanh Thu Thu Hoạch</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 block">
                      {formatVND(actualRevenue)} đ
                    </span>
                    <span className="text-[10.5px] text-slate-400 mt-1 block">
                      {actualKg.toLocaleString()} kg × {formatVND(actualPrice)} đ
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-400 block">Tổng Chi Phí Vật Tư</span>
                    <span className="text-xl font-black text-amber-400 mt-1 block">
                      {formatVND(actualCost)} đ
                    </span>
                    <span className="text-[10.5px] text-slate-400 mt-1 block">
                      Thức ăn + Thuốc + Hóa chất
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl border ${
                      actualProfit >= 0
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span className="text-xs block text-slate-300">
                      {actualProfit >= 0 ? 'Tổng Tiền Lời (+)' : 'Tổng Tiền Lỗ (-)'}
                    </span>
                    <span
                      className={`text-xl font-black mt-1 block ${
                        actualProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {actualProfit >= 0 ? `+${formatVND(actualProfit)}` : formatVND(actualProfit)} đ
                    </span>
                    <span className="text-[10.5px] mt-1 block">
                      {actualProfit >= 0 ? '🎉 Vụ nuôi đạt lợi nhuận dương' : '⚠️ Vụ nuôi bị thâm hụt tài chính'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note */}
              {crop.harvestNote && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Ghi chú thu hoạch:</span>
                  <p className="text-slate-600 leading-relaxed">{crop.harvestNote}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPARISON */}
          {activeTab === 'comparison' && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-3.5">Chỉ tiêu</th>
                      <th className="p-3.5 text-center">Chỉ tiêu ban đầu</th>
                      <th className="p-3.5 text-center">Thực tế thu hoạch</th>
                      <th className="p-3.5 text-center">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Size */}
                    <tr>
                      <td className="p-3.5 font-bold text-slate-800">Kích cỡ tôm (con/kg)</td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {crop.targetHarvestSize ? `${crop.targetHarvestSize} con/kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-blue-700">
                        {actualSize ? `${actualSize} con/kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {crop.targetHarvestSize && actualSize ? (
                          actualSize <= crop.targetHarvestSize ? (
                            <span className="text-emerald-600">Đạt kích cỡ mục tiêu</span>
                          ) : (
                            <span className="text-amber-600">Nhỏ hơn kế hoạch</span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* Survival Rate */}
                    <tr>
                      <td className="p-3.5 font-bold text-slate-800">Tỷ lệ sống (%)</td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {crop.targetSurvivalRate ? `${crop.targetSurvivalRate}%` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-emerald-700">
                        {actualSurvival ? `${actualSurvival}%` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {crop.targetSurvivalRate && actualSurvival ? (
                          actualSurvival >= crop.targetSurvivalRate ? (
                            <span className="text-emerald-600">Vượt chỉ tiêu sống</span>
                          ) : (
                            <span className="text-rose-600">Hụt tỷ lệ sống</span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* Biomass */}
                    <tr>
                      <td className="p-3.5 font-bold text-slate-800">Sản lượng (kg)</td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {targetBiomassKg ? `${targetBiomassKg.toLocaleString()} kg (~${(targetBiomassKg / 1000).toFixed(2)} tấn)` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-blue-700">
                        {actualKg ? `${actualKg.toLocaleString()} kg (~${tons} tấn)` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {targetBiomassKg && actualKg ? (
                          actualKg >= targetBiomassKg ? (
                            <span className="text-emerald-600">Vượt sản lượng kế hoạch</span>
                          ) : (
                            <span className="text-amber-600">Hụt sản lượng dự kiến</span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* FCR */}
                    <tr>
                      <td className="p-3.5 font-bold text-slate-800">Hệ số FCR</td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {targetFcr ? `~${targetFcr}` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-purple-700">
                        {actualFcr ? actualFcr : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {targetFcr && actualFcr ? (
                          actualFcr <= targetFcr ? (
                            <span className="text-emerald-600">Chuyển đổi thức ăn tối ưu</span>
                          ) : (
                            <span className="text-rose-600">Tiêu tốn thức ăn cao</span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY BREAKDOWN */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Đang tải chi tiết vật tư kho...
                </div>
              ) : harvestSummary ? (
                <div className="space-y-4">
                  {/* Feed */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-600" /> Thức ăn đã cho ăn
                      </span>
                      <span className="text-xs font-bold text-blue-700">
                        {formatVND(harvestSummary.summary.totalFeedCost)} đ
                      </span>
                    </div>
                    {harvestSummary.summary.feedLogs.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-t border-slate-200/60">
                        <span className="text-slate-700 font-medium">{item.itemName}</span>
                        <span className="text-slate-500 font-bold">
                          {item.quantityUsed.toLocaleString()} {item.unit} • {formatVND(item.totalCost)} đ
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Medicine */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-rose-600" /> Thuốc thú y thủy sản
                      </span>
                      <span className="text-xs font-bold text-rose-700">
                        {formatVND(harvestSummary.summary.totalMedicineCost)} đ
                      </span>
                    </div>
                    {harvestSummary.summary.medicineLogs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Không có thuốc điều trị</p>
                    ) : (
                      harvestSummary.summary.medicineLogs.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-t border-slate-200/60">
                          <span className="text-slate-700 font-medium">{item.itemName}</span>
                          <span className="text-slate-500 font-bold">
                            {item.quantityUsed.toLocaleString()} {item.unit} • {formatVND(item.totalCost)} đ
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Chemical */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" /> Hóa chất xử lý nước
                      </span>
                      <span className="text-xs font-bold text-purple-700">
                        {formatVND(harvestSummary.summary.totalChemicalCost)} đ
                      </span>
                    </div>
                    {harvestSummary.summary.chemicalLogs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Không có hóa chất sử dụng</p>
                    ) : (
                      harvestSummary.summary.chemicalLogs.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-t border-slate-200/60">
                          <span className="text-slate-700 font-medium">{item.itemName}</span>
                          <span className="text-slate-500 font-bold">
                            {item.quantityUsed.toLocaleString()} {item.unit} • {formatVND(item.totalCost)} đ
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Không tìm thấy chi tiết nhật ký kho của vụ này.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          {onEditHarvest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditHarvest(crop);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all border border-blue-200/90 shadow-2xs cursor-pointer flex items-center gap-1.5 hover:scale-105"
            >
              <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa số liệu thu hoạch
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Đóng báo cáo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
