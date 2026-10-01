import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ClipboardCheck, MapPin, Thermometer, Waves } from 'lucide-react';
import './PondPreview.css';

const demoPonds = [
  {
    id: 'A1', x: 55.3, y: 28.5, cropDay: 45, cycleDay: 5,
    temperature: '29,2', feed: 42, mortality: 12, sampleSize: 82,
    task: 'Lấy mẫu, cân và đếm để cập nhật kích cỡ tôm.',
    history: [34, 36, 38, 40, 42],
  },
  {
    id: 'A2', x: 71.5, y: 28.5, cropDay: 38, cycleDay: 3,
    temperature: '28,8', feed: 35, mortality: 8, sampleSize: 96,
    task: 'Ghi lượng thức ăn, tôm hao và nhiệt độ trong ngày.',
    history: [29, 30, 32, 33, 35],
  },
  {
    id: 'B1', x: 38, y: 55.5, cropDay: 52, cycleDay: 2,
    temperature: '30,1', feed: 48, mortality: 15, sampleSize: 68,
    task: 'Cập nhật nhật ký và đối chiếu lượng thức ăn đã dùng.',
    history: [40, 42, 44, 46, 48],
  },
  {
    id: 'B2', x: 55.3, y: 64, cropDay: 30, cycleDay: 5,
    temperature: '29,5', feed: 27, mortality: 6, sampleSize: 120,
    task: 'Cân mẫu và đếm số con để ghi nhận lần lấy mẫu mới.',
    history: [20, 22, 23, 25, 27],
  },
] as const;

export default function PondPreview() {
  const [selectedId, setSelectedId] = useState<string>('A1');
  const reduceMotion = useReducedMotion();
  const detailId = useId();
  const pond = demoPonds.find((item) => item.id === selectedId) ?? demoPonds[0];
  const feedTotal = pond.history.reduce<number>((total, value) => total + value, 0);

  return (
    <div className="pond-preview">
      <div className="pond-preview__toolbar">
        <div className="pond-preview__breadcrumb">
          <span className="pond-preview__brand"><Waves size={19} aria-hidden="true" /> SSFM</span>
          <span className="pond-preview__divider" aria-hidden="true">/</span>
          <span>Tổng quan ao nuôi</span>
        </div>
        <span className="pond-preview__demo-label">Dữ liệu minh họa</span>
      </div>

      <div className="pond-preview__body">
        <div className="pond-preview__map" role="group" aria-label="Chọn ao để xem dữ liệu minh họa">
          <div className="pond-preview__map-stage">
            <img
              className="pond-preview__map-image"
              src="/map-bg.png"
              alt="Toàn cảnh các ao nuôi tròn trong trang trại, nhìn từ trên cao"
              width="1024"
              height="1024"
              loading="lazy"
              decoding="async"
            />
            {demoPonds.map((item) => (
              <button
                key={item.id}
                type="button"
                className="pond-preview__marker"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                aria-label={`Xem ao ${item.id}`}
                aria-pressed={selectedId === item.id}
                aria-controls={detailId}
                onClick={() => setSelectedId(item.id)}
              >
                <span aria-hidden="true" className="pond-preview__marker-dot" />
                {item.id}
              </button>
            ))}
          </div>
          <div className="pond-preview__map-label">
            <MapPin size={16} aria-hidden="true" /> Bản đồ trang trại
          </div>
          <p className="pond-preview__map-hint">Chọn một ao để khám phá nhật ký nuôi</p>
        </div>

        <section className="pond-preview__details" id={detailId} aria-label={`Nhật ký minh họa ao ${pond.id}`}>
          <motion.div
            key={pond.id}
            className="pond-preview__detail-content"
            initial={reduceMotion ? false : { opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <div className="pond-preview__detail-heading">
              <div>
                <p className="pond-preview__eyebrow">NHẬT KÝ VỤ NUÔI</p>
                <h3>Ao {pond.id}</h3>
              </div>
              <span className="pond-preview__crop-day">Ngày nuôi <strong>{pond.cropDay}</strong></span>
            </div>

            <dl className="pond-preview__metrics">
              <div>
                <dt><Thermometer size={15} aria-hidden="true" /> Nhiệt độ</dt>
                <dd>{pond.temperature}<span>°C</span></dd>
              </div>
              <div>
                <dt>Thức ăn hôm nay</dt>
                <dd>{pond.feed}<span>kg</span></dd>
              </div>
              <div>
                <dt>Tôm hao hôm nay</dt>
                <dd>{pond.mortality}<span>con</span></dd>
              </div>
              <div>
                <dt>Kích cỡ mẫu gần nhất</dt>
                <dd>{pond.sampleSize}<span>con/kg</span></dd>
              </div>
            </dl>

            <div className="pond-preview__task">
              <ClipboardCheck size={20} aria-hidden="true" />
              <div>
                <h4>Ngày {pond.cycleDay} trong chu kỳ 5 ngày</h4>
                <p>{pond.task}</p>
              </div>
            </div>

            <div className="pond-preview__feed">
              <div className="pond-preview__feed-heading">
                <h4>Thức ăn 5 ngày gần nhất</h4>
                <span>{feedTotal} kg</span>
              </div>
              <div className="pond-preview__chart" aria-hidden="true">
                {pond.history.map((value, index) => (
                  <div className="pond-preview__chart-column" key={index}>
                    <span className="pond-preview__chart-value">{value}</span>
                    <div className="pond-preview__chart-track">
                      <div className="pond-preview__chart-bar" style={{ height: `${value / 50 * 100}%` }} />
                    </div>
                    <span className="pond-preview__chart-day">N{pond.cropDay - 4 + index}</span>
                  </div>
                ))}
              </div>
              <table className="pond-preview__sr-only">
                <caption>Lượng thức ăn ao {pond.id} trong 5 ngày gần nhất, tổng {feedTotal} kg</caption>
                <thead><tr><th scope="col">Ngày nuôi</th><th scope="col">Thức ăn (kg)</th></tr></thead>
                <tbody>
                  {pond.history.map((value, index) => (
                    <tr key={index}><th scope="row">{pond.cropDay - 4 + index}</th><td>{value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          <Link className="pond-preview__login" to="/login">
            Đăng nhập để quản lý ao <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <p className="pond-preview__sr-only" role="status" aria-live="polite" aria-atomic="true">
        Đang xem ao {pond.id}, ngày nuôi {pond.cropDay}. Thông tin nhật ký đã được cập nhật.
      </p>
    </div>
  );
}
